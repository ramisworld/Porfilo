import { type NextRequest } from "next/server";
import { z } from "zod";
import { headers as nextHeaders } from "next/headers";
import { getSession } from "~/server/auth";
import { githubUserExists } from "~/server/github/fetch";
import { limit } from "~/server/ratelimit";
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
 * Pre-flight check used by /generate before we kick off the SSE pipeline.
 * Returns { exists: boolean }; an invalid format is a 400.
 *
 * Auth required — anonymous callers can't grind through GitHub via this.
 * Per-user rate-limited (5 / 60s) to discourage typo-bursting.
 */
export async function POST(req: NextRequest) {
  const session = await getSession(await nextHeaders());
  if (!session?.user) return json({ error: "Unauthorized" }, 401);

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Invalid request";
    return json({ error: msg ?? "Invalid request", exists: false }, 400);
  }

  // Cheap pre-check: if this user already owns a portfolio (beta quota), no
  // point hitting GitHub. Surface the quota error to the client.
  const owned = await db.portfolio.count({ where: { ownerId: session.user.id } });
  if (owned >= 1) {
    return json(
      {
        error:
          "You already have a portfolio. PortHub is in beta — only one portfolio per account for now.",
        code: "quota_reached",
        exists: false,
      },
      409,
    );
  }

  const rl = limit(`validate:${session.user.id}`, { window: "1m", max: 10 });
  if (!rl.ok) {
    return json({ error: "Too many requests" }, 429, {
      "retry-after": String(rl.retryAfter),
    });
  }

  const exists = await githubUserExists(parsed.username);
  return json({ exists }, 200);
}
