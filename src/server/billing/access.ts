import "server-only";
import type { db as DbType } from "~/server/db";
import { CUSTOM_DOMAIN_FEATURE_KEY } from "./constants";

type Db = typeof DbType;

/**
 * Whether the user holds a paid custom-domain entitlement.
 *
 * The single source of truth for the paywall — reused by the dashboard access
 * query, the success-page polling, AND the server-side gate on the domain
 * mutations. Access is granted only when a verified Stripe webhook has flipped
 * the row to "paid"; a merely `pending` row (checkout started, not completed)
 * returns false.
 */
export async function hasCustomDomainAccess(
  db: Db,
  userId: string,
): Promise<boolean> {
  const row = await db.featureAccess.findUnique({
    where: {
      userId_featureKey: { userId, featureKey: CUSTOM_DOMAIN_FEATURE_KEY },
    },
    select: { status: true },
  });
  return row?.status === "paid";
}
