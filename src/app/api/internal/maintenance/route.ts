import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "~/env";
import { db } from "~/server/db";
import { pruneExpiredClaimablePortfolios } from "~/server/portfolio/claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const configured = env.MAINTENANCE_SECRET;
  const provided = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!configured || !provided) return false;
  const expected = createHash("sha256").update(configured).digest();
  const actual = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expected, actual);
}

/** Private Railway cron target. Cleanup never runs on a user request path. */
export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const retentionCutoff = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
  const [claimablePortfolios, rateLimits, spendHistory, releasedSlots] =
    await Promise.all([
      pruneExpiredClaimablePortfolios(),
      db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.llmSpendReservation.deleteMany({
        where: { createdAt: { lt: retentionCutoff } },
      }),
      db.workSlot.updateMany({
        where: { token: { not: null }, expiresAt: { lt: now } },
        data: { token: null, expiresAt: null },
      }),
    ]);

  return Response.json({
    ok: true,
    removed: {
      claimablePortfolios,
      rateLimits: rateLimits.count,
      spendHistory: spendHistory.count,
      releasedSlots: releasedSlots.count,
    },
  });
}
