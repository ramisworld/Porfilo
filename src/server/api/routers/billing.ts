import type Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { env } from "~/env";
import { appOrigin } from "~/lib/root-domain";
import { limit } from "~/server/ratelimit";
import { hasCustomDomainAccess } from "~/server/billing/access";
import { getStripe, isStripeConfigured } from "~/server/billing/stripe";
import {
  CUSTOM_DOMAIN_AMOUNT,
  CUSTOM_DOMAIN_CURRENCY,
  CUSTOM_DOMAIN_FEATURE_KEY,
  CUSTOM_DOMAIN_PRODUCT_NAME,
} from "~/server/billing/constants";

/**
 * Billing router — the $9 one-time unlock for the custom-domain feature.
 *
 * Fulfilment happens in the Stripe webhook (src/app/api/stripe/webhook), NOT
 * here — this router only starts checkout and reports current access. Access is
 * checked before every checkout so an already-paid user never re-enters
 * checkout.
 */
export const billingRouter = createTRPCRouter({
  /** Current custom-domain entitlement for the signed-in user. */
  customDomainAccess: protectedProcedure.query(async ({ ctx }) => {
    const unlocked = await hasCustomDomainAccess(ctx.db, ctx.user.id);
    return { unlocked };
  }),

  /**
   * Start a Stripe Checkout Session for the one-time unlock. Returns the hosted
   * checkout URL, or `{ alreadyUnlocked: true }` if the user already paid.
   */
  createCustomDomainCheckoutSession: protectedProcedure.mutation(
    async ({ ctx }) => {
      // Duplicate-purchase guard: never send a paid user through checkout again.
      if (await hasCustomDomainAccess(ctx.db, ctx.user.id)) {
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

      // One pending entitlement row per (user, feature); reused across retries.
      const record = await ctx.db.featureAccess.upsert({
        where: {
          userId_featureKey: {
            userId: ctx.user.id,
            featureKey: CUSTOM_DOMAIN_FEATURE_KEY,
          },
        },
        create: {
          userId: ctx.user.id,
          featureKey: CUSTOM_DOMAIN_FEATURE_KEY,
          status: "pending",
          amount: CUSTOM_DOMAIN_AMOUNT,
          currency: CUSTOM_DOMAIN_CURRENCY,
        },
        update: { status: "pending" },
      });

      // A fresh session per attempt (Stripe's recommendation).
      const stripe = getStripe();
      const origin = appOrigin();
      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items: [priceLineItem()],
          customer_email: ctx.user.email ?? undefined,
          client_reference_id: ctx.user.id,
          metadata: {
            userId: ctx.user.id,
            featureKey: CUSTOM_DOMAIN_FEATURE_KEY,
            featureAccessId: record.id,
          },
          // Carry the session id back so the dashboard can poll for the unlock.
          success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/dashboard?checkout=cancelled`,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Couldn't start checkout.";
        throw new TRPCError({ code: "BAD_GATEWAY", message });
      }

      if (!session.url) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Couldn't start checkout. Please try again.",
        });
      }

      // Bind the session to the record so the webhook can match it.
      await ctx.db.featureAccess.update({
        where: { id: record.id },
        data: { stripeCheckoutSessionId: session.id },
      });

      return { url: session.url };
    },
  ),
});

/** The single $9 line item: a pre-created Price if configured, else inline. */
function priceLineItem(): Stripe.Checkout.SessionCreateParams.LineItem {
  if (env.STRIPE_CUSTOM_DOMAIN_PRICE_ID) {
    return { price: env.STRIPE_CUSTOM_DOMAIN_PRICE_ID, quantity: 1 };
  }
  return {
    quantity: 1,
    price_data: {
      currency: CUSTOM_DOMAIN_CURRENCY,
      unit_amount: CUSTOM_DOMAIN_AMOUNT,
      product_data: { name: CUSTOM_DOMAIN_PRODUCT_NAME },
    },
  };
}
