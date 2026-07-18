import type Stripe from "stripe";
import { env } from "~/env";
import { getStripe, isStripeConfigured } from "~/server/billing/stripe";
import { failCheckout, fulfillCheckout } from "~/server/billing/fulfillment";
import {
  InvalidRequestBodyError,
  readLimitedText,
  RequestBodyTooLargeError,
} from "~/server/http/request-body";

// Stripe SDK + Prisma are Node-only; the webhook must read the raw body, so no
// caching and always dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_STRIPE_WEBHOOK_BYTES = 256 * 1024;

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

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header.", { status: 400 });
  }

  let body: string;
  try {
    body = await readLimitedText(req, MAX_STRIPE_WEBHOOK_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return new Response("Webhook payload is too large.", { status: 413 });
    }
    if (error instanceof InvalidRequestBodyError) {
      return new Response("Invalid webhook payload.", { status: 400 });
    }
    throw error;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return new Response("Webhook signature verification failed.", {
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
    } else if (event.type === "checkout.session.async_payment_failed") {
      await failCheckout(event.data.object.id);
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
