import type Stripe from "stripe";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { env } from "~/env";
import { appOrigin } from "~/lib/root-domain";
import { limit } from "~/server/ratelimit";
import { hasPremiumAccess } from "~/server/billing/access";
import { fulfillCheckout } from "~/server/billing/fulfillment";
import { getStripe, isStripeConfigured } from "~/server/billing/stripe";
import {
  PREMIUM_AMOUNT,
  PREMIUM_CHECKOUT_VERSION,
  PREMIUM_CURRENCY,
  PREMIUM_FEATURE_KEY,
  PREMIUM_PRODUCT_DESCRIPTION,
  PREMIUM_PRODUCT_NAME,
} from "~/server/billing/constants";

/**
 * Billing router — the $9 one-time Porfilo Premium unlock.
 *
 * The verified webhook is the reliable fulfilment path. The authenticated
 * checkout-return mutation invokes the same validation for faster access when
 * the customer arrives before the webhook. Access is checked before every
 * checkout so an already-paid user never re-enters checkout.
 */
export const billingRouter = createTRPCRouter({
  /** Current lifetime Premium entitlement for the signed-in user. */
  premiumAccess: protectedProcedure.query(async ({ ctx }) => {
    const unlocked = await hasPremiumAccess(ctx.db, ctx.user.id);
    return { unlocked };
  }),

  /**
   * Fast, authenticated fulfillment on the Checkout success redirect. Webhook
   * delivery remains required because the browser might never return here.
   */
  confirmPremiumCheckout: protectedProcedure
    .input(
      z.object({
        sessionId: z
          .string()
          .regex(/^cs_[A-Za-z0-9_]+$/)
          .max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rl = await limit(`billing:confirm:${ctx.user.id}`, {
        window: "10m",
        max: 12,
      });
      if (!rl.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many verification attempts. Wait a moment and retry.",
        });
      }
      if (!isStripeConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Payments aren't enabled on this deployment yet.",
        });
      }

      await fulfillCheckout(input.sessionId, ctx.user.id);
      return { unlocked: await hasPremiumAccess(ctx.db, ctx.user.id) };
    }),

  /**
   * Start a Stripe Checkout Session for the one-time unlock. Returns the hosted
   * checkout URL, or `{ alreadyUnlocked: true }` if the user already paid.
   */
  createPremiumCheckoutSession: protectedProcedure.mutation(async ({ ctx }) => {
    // Duplicate-purchase guard: never send a paid user through checkout again.
    if (await hasPremiumAccess(ctx.db, ctx.user.id)) {
      return { alreadyUnlocked: true as const };
    }

    if (!isStripeConfigured()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Payments aren't enabled on this deployment yet.",
      });
    }

    const rl = await limit(`billing:checkout:${ctx.user.id}`, {
      window: "10m",
      max: 8,
    });
    if (!rl.ok) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many attempts. Wait a moment and try again.",
      });
    }

    // One entitlement row per (user, feature). The empty update deliberately
    // preserves `paid`: a checkout/webhook race must never downgrade access.
    const record = await ctx.db.featureAccess.upsert({
      where: {
        userId_featureKey: {
          userId: ctx.user.id,
          featureKey: PREMIUM_FEATURE_KEY,
        },
      },
      create: {
        userId: ctx.user.id,
        featureKey: PREMIUM_FEATURE_KEY,
        status: "pending",
        amount: PREMIUM_AMOUNT,
        currency: PREMIUM_CURRENCY,
      },
      update: {},
    });

    if (record.status === "paid") {
      return { alreadyUnlocked: true as const };
    }

    const stripe = getStripe();
    const origin = appOrigin();
    const metadata = {
      userId: ctx.user.id,
      featureKey: PREMIUM_FEATURE_KEY,
      featureAccessId: record.id,
    };

    // Reuse the existing open, correctly-priced Session. This is the primary
    // spam-click/multi-tab guard: the user gets one payment page, not a stack
    // of independently payable pages. A completed Session is fulfilled here
    // as a fast fallback while the verified webhook remains authoritative.
    const existing = await reusableCheckout(stripe, record, ctx.user.id);
    if (existing?.kind === "paid") {
      await fulfillCheckout(existing.sessionId);
      return { alreadyUnlocked: true as const };
    }
    if (existing?.kind === "open") {
      const bound = await bindPendingSession(
        ctx,
        record.id,
        existing.sessionId,
      );
      return bound ? { url: existing.url } : { alreadyUnlocked: true as const };
    }

    let session: Stripe.Checkout.Session;
    try {
      const lineItem = await priceLineItem(stripe);
      session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          payment_method_types: ["card"],
          line_items: [lineItem],
          customer_email: ctx.user.email ?? undefined,
          client_reference_id: ctx.user.id,
          metadata,
          payment_intent_data: { metadata },
          // Carry the session id back so the dashboard can poll for the unlock.
          success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/dashboard?checkout=cancelled`,
        },
        {
          // All concurrent retries for the same current attempt resolve to the
          // same Stripe Session. When a Session expires, its id becomes the
          // seed for exactly one replacement attempt.
          idempotencyKey: checkoutIdempotencyKey(
            record.id,
            record.stripeCheckoutSessionId,
          ),
        },
      );
    } catch (err) {
      console.error("[billing] Stripe checkout creation failed", err);
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "Couldn't start secure checkout. Please try again.",
      });
    }

    if (!session.url) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "Couldn't start checkout. Please try again.",
      });
    }

    // Bind only while the entitlement is unpaid. If a webhook won the race,
    // expire this newly-created page so it can never collect a second charge.
    const bound = await bindPendingSession(ctx, record.id, session.id);
    if (!bound) {
      await expireCheckout(stripe, session.id);
      return { alreadyUnlocked: true as const };
    }

    return { url: session.url };
  }),
});

type BillingContext = Parameters<
  Parameters<typeof protectedProcedure.mutation>[0]
>[0] extends { ctx: infer T }
  ? T
  : never;

async function bindPendingSession(
  ctx: BillingContext,
  recordId: string,
  sessionId: string,
): Promise<boolean> {
  const result = await ctx.db.featureAccess.updateMany({
    where: { id: recordId, status: { not: "paid" } },
    data: {
      status: "pending",
      amount: PREMIUM_AMOUNT,
      currency: PREMIUM_CURRENCY,
      stripeCheckoutSessionId: sessionId,
      stripePaymentIntentId: null,
      paidAt: null,
    },
  });
  return result.count > 0;
}

function checkoutIdempotencyKey(
  recordId: string,
  previousSessionId: string | null,
): string {
  return [
    "porfilo",
    PREMIUM_FEATURE_KEY,
    PREMIUM_CHECKOUT_VERSION,
    recordId,
    previousSessionId ?? "initial",
  ].join(":");
}

async function reusableCheckout(
  stripe: Stripe,
  record: { stripeCheckoutSessionId: string | null },
  userId: string,
): Promise<
  | { kind: "open"; sessionId: string; url: string }
  | { kind: "paid"; sessionId: string }
  | null
> {
  if (!record.stripeCheckoutSessionId) return null;

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(
      record.stripeCheckoutSessionId,
    );
  } catch (err) {
    // A stale test-mode id after switching Railway to live keys should not
    // permanently strand the account. Other Stripe failures remain visible.
    if (isMissingStripeResource(err)) return null;
    throw err;
  }

  if (!isExpectedPurchase(session, userId)) {
    if (session.status === "open") await expireCheckout(stripe, session.id);
    return null;
  }
  if (session.payment_status !== "unpaid") {
    return { kind: "paid", sessionId: session.id };
  }
  if (session.status === "open" && session.url) {
    return { kind: "open", sessionId: session.id, url: session.url };
  }
  return null;
}

function isExpectedPurchase(
  session: Stripe.Checkout.Session,
  userId: string,
): boolean {
  return (
    session.mode === "payment" &&
    session.amount_total === PREMIUM_AMOUNT &&
    session.currency === PREMIUM_CURRENCY &&
    session.client_reference_id === userId &&
    session.metadata?.userId === userId &&
    session.metadata?.featureKey === PREMIUM_FEATURE_KEY
  );
}

function isMissingStripeResource(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "resource_missing"
  );
}

async function expireCheckout(
  stripe: Stripe,
  sessionId: string,
): Promise<void> {
  try {
    await stripe.checkout.sessions.expire(
      sessionId,
      {},
      {
        idempotencyKey: `porfilo:expire:${sessionId}`,
      },
    );
  } catch (err) {
    // Completing between our status check and expiry is harmless: fulfillment
    // still validates the exact amount and the entitlement remains idempotent.
    console.warn("[billing] Could not expire stale Checkout Session", err);
  }
}

/** The single $9 line item: a validated Price if configured, else inline. */
async function priceLineItem(
  stripe: Stripe,
): Promise<Stripe.Checkout.SessionCreateParams.LineItem> {
  if (env.STRIPE_PREMIUM_PRICE_ID) {
    const price = await stripe.prices.retrieve(env.STRIPE_PREMIUM_PRICE_ID);
    if (
      !price.active ||
      price.type !== "one_time" ||
      price.unit_amount !== PREMIUM_AMOUNT ||
      price.currency !== PREMIUM_CURRENCY
    ) {
      throw new Error(
        "STRIPE_PREMIUM_PRICE_ID must be an active one-time USD $9 price.",
      );
    }
    return { price: env.STRIPE_PREMIUM_PRICE_ID, quantity: 1 };
  }
  return {
    quantity: 1,
    price_data: {
      currency: PREMIUM_CURRENCY,
      unit_amount: PREMIUM_AMOUNT,
      product_data: {
        name: PREMIUM_PRODUCT_NAME,
        description: PREMIUM_PRODUCT_DESCRIPTION,
      },
    },
  };
}
