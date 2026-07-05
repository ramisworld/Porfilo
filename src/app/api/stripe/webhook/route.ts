import type Stripe from "stripe";
import { env } from "~/env";
import { getStripe, isStripeConfigured } from "~/server/billing/stripe";
import { fulfillCheckout } from "~/server/billing/fulfillment";

// Stripe SDK + Prisma are Node-only; the webhook must read the raw body, so no
// caching and always dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook — the ONLY place the custom-domain feature is unlocked.
 *
 * Flow: verify the signature against the raw body → for a completed (or delayed
 * async-succeeded) Checkout Session, run idempotent fulfilment → return 2xx
 * quickly. Fulfilment (a single Stripe retrieve + a guarded DB update) is well
 * within Stripe's 10s window.
 *
 * Test locally with the Stripe CLI:
 *   stripe listen --forward-to localhost:3000/api/stripe/webhook
 *   stripe trigger checkout.session.completed
 */
export async function POST(req: Request): Promise<Response> {
  if (!isStripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Stripe is not configured.", { status: 503 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header.", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return new Response(`Webhook signature verification failed: ${message}`, {
      status: 400,
    });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      await fulfillCheckout(session.id);
    }
    // All other event types are acknowledged without action.
  } catch (err) {
    // Signature is already verified, so this is a transient DB/Stripe error —
    // return 500 so Stripe retries the delivery (fulfilment is idempotent).
    console.error("[stripe webhook] fulfilment error", err);
    return new Response("Fulfilment error.", { status: 500 });
  }

  return new Response(null, { status: 200 });
}
