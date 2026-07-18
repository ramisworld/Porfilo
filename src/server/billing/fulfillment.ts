import "server-only";
import { db } from "~/server/db";
import { getStripe } from "./stripe";
import {
  PREMIUM_AMOUNT,
  PREMIUM_CURRENCY,
  PREMIUM_FEATURE_KEY,
} from "./constants";

export type FulfillResult =
  | { status: "fulfilled" } // newly flipped to paid
  | { status: "already_fulfilled" } // idempotent no-op (already paid)
  | { status: "ignored"; reason: string }; // unpaid / unknown / mismatch

/**
 * Fulfil a completed Checkout Session by marking the matching FeatureAccess row
 * paid. This is the ONLY path that grants access — never the client success URL.
 *
 * Safe to run multiple times, even concurrently, for the same session id:
 * fulfilment is guarded by a conditional update (`status != "paid"`) plus the
 * `(userId, featureKey)` unique constraint, so retries and duplicate webhook
 * deliveries can never double-apply.
 *
 * Security: never trusts client metadata alone. The incoming session must map to
 * a pending record WE created before checkout (by stored session id, or the
 * user+feature unique), and the record's `userId` must equal the session's
 * metadata `userId`.
 */
export async function fulfillCheckout(
  sessionId: string,
  expectedUserId?: string,
): Promise<FulfillResult> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items"],
  });

  // Only fulfil once payment has actually gone through. Delayed payment methods
  // stay "unpaid" here until the async_payment_succeeded event arrives.
  if (session.payment_status === "unpaid") {
    return { status: "ignored", reason: "payment_status=unpaid" };
  }

  const metaUserId = session.metadata?.userId ?? null;
  const metaFeatureKey = session.metadata?.featureKey ?? null;

  if (expectedUserId && metaUserId !== expectedUserId) {
    return { status: "ignored", reason: "requesting user mismatch" };
  }

  // Never grant access for a Session that happens to carry plausible metadata
  // but charged a different offer. This also safely rejects any uncompleted
  // legacy Checkout Sessions after the production offer changes.
  if (
    session.mode !== "payment" ||
    session.amount_total !== PREMIUM_AMOUNT ||
    session.currency !== PREMIUM_CURRENCY
  ) {
    return { status: "ignored", reason: "purchase details mismatch" };
  }
  if (
    !metaUserId ||
    metaFeatureKey !== PREMIUM_FEATURE_KEY ||
    session.client_reference_id !== metaUserId
  ) {
    return { status: "ignored", reason: "checkout identity mismatch" };
  }

  // Resolve the record created at checkout time. Primary: the session id we
  // stored. Fallback: the (userId, featureKey) unique, in case a later retry
  // overwrote the stored session id.
  let record = await db.featureAccess.findUnique({
    where: { stripeCheckoutSessionId: sessionId },
  });
  if (!record && metaUserId) {
    record = await db.featureAccess.findUnique({
      where: {
        userId_featureKey: {
          userId: metaUserId,
          featureKey: metaFeatureKey,
        },
      },
    });
  }
  if (!record) {
    return { status: "ignored", reason: "no matching FeatureAccess record" };
  }

  // Defence in depth: metadata userId must match the record we created.
  if (metaUserId && record.userId !== metaUserId) {
    return { status: "ignored", reason: "userId mismatch" };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // Idempotent flip: only the first delivery that finds status != "paid" writes.
  const updated = await db.featureAccess.updateMany({
    where: { id: record.id, status: { not: "paid" } },
    data: {
      status: "paid",
      stripeCheckoutSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId,
      paidAt: new Date(),
    },
  });

  return updated.count > 0
    ? { status: "fulfilled" }
    : { status: "already_fulfilled" };
}

/** Record a delayed-payment failure without ever revoking paid access. */
export async function failCheckout(sessionId: string): Promise<void> {
  await db.featureAccess.updateMany({
    where: { stripeCheckoutSessionId: sessionId, status: { not: "paid" } },
    data: { status: "failed" },
  });
}
