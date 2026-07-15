import "server-only";
import { db } from "~/server/db";

export const CLAIM_WINDOW_MS = 30 * 60 * 1000;

/** Remove anonymous previews whose one-time claim token has expired. */
export async function pruneExpiredClaimablePortfolios(): Promise<number> {
  const result = await db.portfolio.deleteMany({
    where: {
      ownerId: null,
      claimNonce: { not: null },
      createdAt: { lt: new Date(Date.now() - CLAIM_WINDOW_MS) },
    },
  });
  return result.count;
}
