import { type NextRequest } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { z } from "zod";
import { getSession } from "~/server/auth";
import { db } from "~/server/db";
import { limit } from "~/server/ratelimit";
import { checkBudget } from "~/server/llm/cost";
import { runGeneration } from "~/server/portfolio/generate";

// Prisma / Octokit / Anthropic are Node-only — do NOT run on the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Beta cap: hard ceiling on portfolios any one account may own. Lift this
// (or move it to a per-plan policy) when payments / plans land.
const PORTFOLIO_QUOTA_PER_USER = 1;

const bodySchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i, "Invalid GitHub username"),
  // 100-char cap matches the client field; vibe is currently informational
  // (TERMINAL_NEXUS is hard-pinned), but we still bound it to keep payloads small.
  vibe: z.string().trim().min(1, "Describe a vibe").max(100),
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
  const session = await getSession(await nextHeaders());
  if (!session?.user) {
    return json({ error: "Sign in to generate a portfolio." }, 401);
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Invalid request";
    return json({ error: msg ?? "Invalid request" }, 400);
  }
  const { username, vibe } = parsed;
  const ownerId = session.user.id;

  // ── Beta cap: one portfolio per account ────────────────────────────────
  // This is the authoritative server-side gate. The UI also disables the form
  // when a portfolio exists, but a determined client could call the API
  // directly, so the truth check lives here.
  const existing = await db.portfolio.count({ where: { ownerId } });
  if (existing >= PORTFOLIO_QUOTA_PER_USER) {
    return json(
      {
        error:
          "You already have a portfolio. PortHub is in beta — only one portfolio per account for now.",
        code: "quota_reached",
      },
      409,
    );
  }

  // ── Daily LLM budget kill-switch ───────────────────────────────────────
  const budget = checkBudget();
  if (budget) {
    return json({ error: budget, code: "budget_reached" }, 503);
  }

  // ── Rate limits ────────────────────────────────────────────────────────
  //   - 3 generations / hour / user (defence in depth on top of the quota above)
  //   - 5 IP-bursts / minute    (catches scripted abuse on a shared NAT)
  //   - 1 generation / 10s / GitHub username   (cooldown to keep the cache warm)
  const hourly = limit(`gen:hour:${ownerId}`, { window: "1h", max: 3 });
  if (!hourly.ok) {
    return json({ error: "Hourly limit reached. Try again later." }, 429, {
      "retry-after": String(hourly.retryAfter),
    });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ipBurst = limit(`gen:ipburst:${ip}`, { window: "1m", max: 5 });
  if (!ipBurst.ok) {
    return json({ error: "Too many requests. Slow down." }, 429, {
      "retry-after": String(ipBurst.retryAfter),
    });
  }

  const cooldown = limit(`gen:cooldown:${username.toLowerCase()}`, {
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

      for await (const event of runGeneration(username, vibe, { ownerId })) {
        if (closed) break;
        await safeWrite(encoder.encode(sseFrame(event)));
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : "Generation failed.";
      await safeWrite(encoder.encode(sseFrame({ stage: "error", error })));
    } finally {
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
