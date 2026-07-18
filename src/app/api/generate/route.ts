import { type NextRequest } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { getSession } from "~/server/auth";
import { db } from "~/server/db";
import { limit } from "~/server/ratelimit";
import { clientIp } from "~/server/client-ip";
import { releaseGlobalSlot } from "~/server/generation-guard";
import { admitGeneration } from "~/server/generation-admission";
import {
  acquireGenerationLock,
  releaseGenerationLock,
} from "~/server/generation-lock";
import { runGeneration } from "~/server/portfolio/generate";
import { hasPremiumAccess } from "~/server/billing/access";
import {
  InvalidRequestBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "~/server/http/request-body";
import {
  recordReservedUsage,
  reserveGenerationBudget,
  settleGenerationBudget,
} from "~/server/llm/cost";

const MAX_GENERATE_BODY_BYTES = 4 * 1024;

// Prisma / Octokit / Anthropic are Node-only — do NOT run on the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Beta cap: hard ceiling on portfolios any one account may own. Lift this
// (or move it to a per-plan policy) when payments / plans land.
const PORTFOLIO_QUOTA_PER_USER = 1;

// Default vibe when the caller doesn't supply one. Haiku maps this prose to one
// approved world; templates remain deterministic and independently tested.
const DEFAULT_VIBE = "clean, modern, premium — let the work speak";

const bodySchema = z.object({
  username: z
    .string()
    .trim()
    .regex(
      /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i,
      "Invalid GitHub username",
    ),
  vibe: z.string().trim().min(10).max(100).optional(),
  mode: z.enum(["create", "replace"]).default("create"),
});

function json(data: unknown, status: number, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function sseFrame(ev: unknown): string {
  return `data: ${JSON.stringify(ev)}\n\n`;
}

export async function POST(req: NextRequest) {
  // Anonymous-first: a session is *not* required. An unauthenticated caller
  // generates an ownerless portfolio they later "claim" by signing in. A
  // signed-in caller generates straight into their account (current behavior).
  const session = await getSession(await nextHeaders());
  const ownerId = session?.user?.id ?? null;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(
      await readLimitedJson(req, MAX_GENERATE_BODY_BYTES),
    );
  } catch (e) {
    if (e instanceof RequestBodyTooLargeError) {
      return json({ error: "Request body is too large." }, 413);
    }
    const msg =
      e instanceof z.ZodError
        ? e.issues[0]?.message
        : e instanceof InvalidRequestBodyError
          ? e.message
          : "Invalid request";
    return json({ error: msg ?? "Invalid request" }, 400);
  }
  const { username, vibe, mode } = parsed;
  const replacing = mode === "replace";
  let replacePortfolioId: string | undefined;

  // ── Ownership + Premium policy ─────────────────────────────────────────
  // Anonymous callers have no account yet — the cap is enforced at claim
  // time instead (see /claim). Replace-in-place regeneration is authenticated,
  // Premium-only, and keeps the existing public URL/domain intact.
  if (replacing) {
    if (!ownerId) {
      return json(
        {
          error: "Sign in to regenerate your portfolio.",
          code: "unauthorized",
        },
        401,
      );
    }
    if (!(await hasPremiumAccess(db, ownerId))) {
      return json(
        {
          error: "Porfilo Premium is required to regenerate your portfolio.",
          code: "premium_required",
        },
        403,
      );
    }
    const existing = await db.portfolio.findUnique({
      where: { ownerId },
      select: { id: true },
    });
    if (!existing) {
      return json(
        { error: "No portfolio was found to regenerate.", code: "not_found" },
        404,
      );
    }
    replacePortfolioId = existing.id;
  } else if (ownerId) {
    const existing = await db.portfolio.count({ where: { ownerId } });
    if (existing >= PORTFOLIO_QUOTA_PER_USER) {
      return json(
        {
          error:
            "You already have a portfolio. Porfilo is in beta — only one portfolio per account for now.",
          code: "quota_reached",
        },
        409,
      );
    }
  }

  // ── Rate limits ────────────────────────────────────────────────────────
  //   - 3 generations / hour  keyed on user id (authed) or IP (anonymous)
  //   - 5 IP-bursts / minute    (catches scripted abuse on a shared NAT)
  //   - 1 generation / 10s / GitHub username   (cooldown to keep the cache warm)
  //
  // The IP is derived via clientIp() — NOT the raw leftmost X-Forwarded-For,
  // which a caller can forge to land every request in a fresh bucket.
  const ip = clientIp(req.headers);

  const hourly = await limit(`gen:hour:${ownerId ?? `anon:${ip}`}`, {
    window: "1h",
    max: 3,
  });
  if (!hourly.ok) {
    return json({ error: "Hourly limit reached. Try again later." }, 429, {
      "retry-after": String(hourly.retryAfter),
    });
  }

  const ipBurst = await limit(`gen:ipburst:${ip}`, {
    window: "1m",
    max: 5,
  });
  if (!ipBurst.ok) {
    return json({ error: "Too many requests. Slow down." }, 429, {
      "retry-after": String(ipBurst.retryAfter),
    });
  }

  const cooldown = await limit(`gen:cooldown:${username.toLowerCase()}`, {
    window: "10s",
    max: 1,
  });
  if (!cooldown.ok) {
    return json(
      { error: "That username was just generated. Wait a moment." },
      429,
      { "retry-after": String(cooldown.retryAfter) },
    );
  }

  // The generation lock table FKs to User, so it's only usable for signed-in
  // callers. Anonymous generation is protected by the IP/username limits above.
  if (ownerId) {
    const lock = await acquireGenerationLock(ownerId, username, {
      allowExistingPortfolio: replacing,
    });
    if (!lock.ok) {
      return json({ error: lock.error, code: lock.code }, lock.status, {
        ...(lock.retryAfter ? { "retry-after": String(lock.retryAfter) } : {}),
      });
    }
  }

  // ── Cross-replica concurrency slot ─────────────────────────────────────
  // Reserve scarce work before charging the global hourly counter. Rejected
  // requests therefore cannot burn the entire application's generation quota.
  const admission = await admitGeneration();
  if (!admission.ok) {
    if (ownerId) await releaseGenerationLock(ownerId);
    return json(
      {
        error: "We're at capacity right now. Please try again shortly.",
        code: "at_capacity",
      },
      503,
      { "retry-after": String(admission.retryAfter) },
    );
  }
  const generationLease = admission.lease;

  // Atomically reserve daily spend only after every admission gate passes.
  const budget = await reserveGenerationBudget();
  if (!budget.ok) {
    if (ownerId) await releaseGenerationLock(ownerId);
    await releaseGlobalSlot(generationLease);
    return json({ error: budget.message, code: "budget_reached" }, 503);
  }
  const budgetReservation = budget.reservation;

  // One-time claim token for anonymous runs. The plaintext is sent only to this
  // browser (in the `done` event); only its SHA-256 is persisted. Required at
  // /claim so knowledge of the public preview URL alone cannot take ownership.
  const claimToken = ownerId ? null : randomBytes(32).toString("base64url");
  const claimNonceHash = claimToken
    ? createHash("sha256").update(claimToken).digest("hex")
    : null;

  // -----------------------------------------------------------------------
  // Why TransformStream instead of `new ReadableStream({ start })`:
  //
  // `ReadableStream`'s consumer (Next.js, when adapting the Web Response to
  // a Node response) does not pull chunks from the controller's queue until
  // `start()` *resolves*. If `start()` is `async` and contains the whole
  // generator loop, NOTHING is sent over the wire until generation finishes
  // — every event gets buffered into the internal queue and flushed at the
  // very end. That's exactly the "all stages dim, then suddenly redirect"
  // bug we were seeing.
  //
  // A TransformStream sidesteps this: we hand Next.js the readable side
  // immediately, and a separate background async function writes into the
  // writable side as work progresses. Chunks are observable on the wire as
  // soon as `writer.write()` returns, regardless of how long the overall
  // job takes.
  // -----------------------------------------------------------------------
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  let closed = false;
  const safeWrite = async (chunk: Uint8Array) => {
    if (closed) return;
    try {
      await writer.write(chunk);
    } catch {
      closed = true;
    }
  };
  const safeClose = async () => {
    if (closed) return;
    closed = true;
    try {
      await writer.close();
    } catch {
      // already closed
    }
  };

  // Heartbeat every 8 s. Doubles as a stream-alive signal for clients behind
  // any intermediary that closes idle connections.
  const heartbeat = setInterval(() => {
    void safeWrite(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
  }, 8000);

  // Stop work + flush close when the client disconnects.
  req.signal.addEventListener(
    "abort",
    () => {
      clearInterval(heartbeat);
      void safeClose();
    },
    { once: true },
  );

  // Kick off the generation in the background. Crucially, this runs BEFORE
  // we return the Response — so by the time Next.js receives the response
  // body, there are already bytes in the pipe.
  void (async () => {
    try {
      // 2 KB of SSE-comment padding to bust any byte-threshold buffer that
      // still exists between us and the browser (Vercel edge, dev proxies,
      // some Chrome internal buffering on small first chunks). Comment lines
      // beginning with ":" are ignored by SSE clients.
      await safeWrite(encoder.encode(":" + " ".repeat(2048) + "\n\n"));

      // Immediate synthetic "open" event — the client transitions out of
      // its "connecting" state on this, before any backend work runs.
      await safeWrite(encoder.encode(sseFrame({ stage: "open" })));

      for await (const event of runGeneration(username, vibe ?? DEFAULT_VIBE, {
        ownerId,
        claimNonceHash,
        replacePortfolioId,
        onUsage: (usage) => recordReservedUsage(budgetReservation, usage),
        signal: req.signal,
      })) {
        if (closed) break;
        // Attach the plaintext claim token to the terminal event only.
        const out =
          event.stage === "done" && claimToken
            ? { ...event, claimToken }
            : event;
        await safeWrite(encoder.encode(sseFrame(out)));
      }
    } catch (err) {
      console.error("[generate] generation failed", err);
      await safeWrite(
        encoder.encode(
          sseFrame({
            stage: "error",
            error: "We couldn't generate that portfolio. Please try again.",
          }),
        ),
      );
    } finally {
      await settleGenerationBudget(budgetReservation).catch((error) => {
        console.error("[generate] failed to settle LLM budget", error);
      });
      if (ownerId) await releaseGenerationLock(ownerId);
      await releaseGlobalSlot(generationLease);
      clearInterval(heartbeat);
      await safeClose();
    }
  })();

  return new Response(readable, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      // Hint to nginx / Vercel edge / dev proxies to NOT buffer this stream.
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
