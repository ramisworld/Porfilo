import "server-only";
import Stripe from "stripe";
import { env } from "~/env";
import { STRIPE_API_VERSION } from "./constants";

/**
 * Stripe client singleton for the one-time custom-domain unlock.
 *
 * Docs consulted (2026): Checkout Sessions API, Fulfillment guide, Webhooks,
 * API versioning. We pin `apiVersion` explicitly rather than relying on the
 * account default, and reuse a single client instance across requests.
 */

/** Thrown when Stripe is not configured (no secret key). Callers map this to a
 *  friendly "payments not enabled" message rather than a 500. */
export class StripeDisabledError extends Error {
  constructor() {
    super("Payments are not enabled on this deployment yet.");
    this.name = "StripeDisabledError";
  }
}

let cached: Stripe | undefined;

/** Whether Stripe is configured on this deployment. */
export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

/**
 * Lazily-constructed singleton Stripe client. Throws {@link StripeDisabledError}
 * when `STRIPE_SECRET_KEY` is unset so the app still boots without payments.
 */
export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new StripeDisabledError();
  cached ??= new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
    maxNetworkRetries: 2,
    appInfo: { name: "Porfilo", url: "https://porfilo.com" },
  });
  return cached;
}
