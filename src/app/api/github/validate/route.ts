import { type NextRequest } from "next/server";
import { z } from "zod";
import { headers as nextHeaders } from "next/headers";
import { getSession } from "~/server/auth";
import { githubUserExists } from "~/server/github/fetch";
import { limit } from "~/server/ratelimit";
import { clientIp } from "~/server/client-ip";
import { db } from "~/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  username: z
    .string()
    .trim()
    .regex(
      /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i,
      "Invalid GitHub username",
    ),
});

function json(data: unknown, status: number, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/**
 * Pre-flight check used before kicking off the SSE pipeline.
 * Returns { exists: boolean }; an invalid format is a 400.
 *
 * Anonymous-first: an unauthenticated caller can validate a GitHub username
 * so the landing can pre-flight before generating. Rate-limited per IP (10 /
 * 60s) to discourage typo-bursting. Signed-in callers additionally get the
 * beta-cap check so we surface "you already have one" before hitting GitHub.
 */
export async function POST(req: NextRequest) {
  const session = await getSession(await nextHeaders());
  const userId = session?.user?.id ?? null;
  // Hardened client IP (never the forgeable leftmost X-Forwarded-For).
  const ip = clientIp(req.headers);

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (e) {
    const msg =
      e instanceof z.ZodError ? e.issues[0]?.message : "Invalid request";
    return json({ error: msg ?? "Invalid request", exists: false }, 400);
  }

  // Signed-in beta-cap pre-check: if this user already owns a portfolio, no
  // point hitting GitHub. Anonymous callers skip this (the cap is enforced
  // at claim time on /claim).
  if (userId) {
    const owned = await db.portfolio.count({ where: { ownerId: userId } });
    if (owned >= 1) {
      return json(
        {
          error:
            "You already have a portfolio. Porfilo is in beta — only one portfolio per account for now.",
          code: "quota_reached",
          exists: false,
        },
        409,
      );
    }
  }

  const rl = await limit(`validate:${userId ?? `anon:${ip}`}`, {
    window: "1m",
    max: 10,
  });
  if (!rl.ok) {
    return json({ error: "Too many requests" }, 429, {
      "retry-after": String(rl.retryAfter),
    });
  }

  const exists = await githubUserExists(parsed.username);
  return json({ exists }, 200);
}
