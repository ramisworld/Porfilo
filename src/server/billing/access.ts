import "server-only";
import type { db as DbType } from "~/server/db";
import { CUSTOM_DOMAIN_FEATURE_KEY } from "./constants";

type Db = typeof DbType;

/**
 * Whether the user may use custom domains.
 *
 * The single source of truth for the paywall — reused by the dashboard access
 * query, the success-page polling, AND the server-side gate on the domain
 * mutations. Access is granted only when a verified Stripe webhook has flipped
 * the row to "paid"; a merely `pending` row (checkout started, not completed)
 * returns false. Accounts with a custom domain created before billing launched
 * are grandfathered from the existing domain row.
 */
export async function hasCustomDomainAccess(
  db: Db,
  userId: string,
): Promise<boolean> {
  const [row, connectedDomain] = await Promise.all([
    db.featureAccess.findUnique({
      where: {
        userId_featureKey: { userId, featureKey: CUSTOM_DOMAIN_FEATURE_KEY },
      },
      select: { status: true },
    }),
    db.customDomain.findFirst({
      where: {
        portfolio: { ownerId: userId },
        type: "custom_domain",
      },
      select: { id: true },
    }),
  ]);

  // Grandfather domains connected before the paid entitlement launched. Their
  // existence proves the account already had access; never ask them to buy it
  // again merely because no historical FeatureAccess row was backfilled.
  return row?.status === "paid" || connectedDomain !== null;
}
