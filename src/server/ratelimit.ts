import "server-only";
import { db } from "~/server/db";

type WindowSpec = "10s" | "1m" | "10m" | "1h" | "24h";

const WINDOWS: Record<WindowSpec, number> = {
  "10s": 10_000,
  "1m": 60_000,
  "10m": 10 * 60_000,
  "1h": 60 * 60_000,
  "24h": 24 * 60 * 60_000,
};

interface LimitOpts {
  window: WindowSpec;
  max: number;
}

/**
 * Database-backed fixed-window limiter.
 *
 * The timestamp is part of the primary key, so a new window starts without a
 * read/modify/write race. Prisma's atomic increment keeps concurrent requests
 * consistent across processes and Railway replicas.
 */
export async function limit(
  key: string,
  opts: LimitOpts,
): Promise<{ ok: boolean; retryAfter: number }> {
  const windowMs = WINDOWS[opts.window];
  const nowMs = Date.now();
  const windowStart = Math.floor(nowMs / windowMs) * windowMs;
  const expiresAt = new Date(windowStart + windowMs);
  const bucketKey = `${key}|${opts.window}|${windowStart}`;

  const bucket = await db.rateLimitBucket.upsert({
    where: { key: bucketKey },
    create: { key: bucketKey, hits: 1, expiresAt },
    update: { hits: { increment: 1 } },
    select: { hits: true },
  });

  // Cheap, deterministic cleanup: approximately one request in every 64.
  // Failure is deliberately non-fatal because cleanup must never take down a
  // user request.
  if ((nowMs >>> 0) % 64 === 0) {
    void db.rateLimitBucket
      .deleteMany({ where: { expiresAt: { lt: new Date(nowMs) } } })
      .catch(() => undefined);
  }

  return {
    ok: bucket.hits <= opts.max,
    retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - nowMs) / 1000)),
  };
}

export async function rateLimit(
  key: string,
): Promise<{ ok: boolean; retryAfter: number }> {
  return limit(key, { window: "1m", max: 5 });
}
