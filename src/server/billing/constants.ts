/**
 * Shared constants for the one-time Porfilo Premium unlock.
 *
 * Kept dependency-free (no Stripe SDK, no env) so the access gate and unit tests
 * can import them without loading the payment client.
 */

/** Value stored in FeatureAccess.featureKey for the lifetime Premium unlock. */
export const PREMIUM_FEATURE_KEY = "premium";

/** Price of the unlock, in the smallest currency unit. $9 = 900. */
export const PREMIUM_AMOUNT = 900;

/** Internal bookkeeping currency — never rendered in the UI (UI shows "$9"). */
export const PREMIUM_CURRENCY = "usd";

/** Product name shown on the Stripe-hosted checkout page + receipt. */
export const PREMIUM_PRODUCT_NAME = "Porfilo Premium";

/** Description shown in Stripe Checkout for the one-time Premium purchase. */
export const PREMIUM_PRODUCT_DESCRIPTION =
  "Use your own domain and regenerate your portfolio with new designs. One-time payment.";

/**
 * Bumped whenever checkout parameters materially change. It keeps Stripe
 * idempotency keys stable for retries of the same offer without reusing a key
 * from an older price/configuration.
 */
export const PREMIUM_CHECKOUT_VERSION = "usd-900-v1";

/**
 * Stripe API version we pin the client to. Matches the version the installed
 * `stripe` SDK targets (see node_modules/stripe/apiVersion.js) so we never
 * silently inherit the account-default version.
 */
export const STRIPE_API_VERSION = "2026-05-27.dahlia";

/** Entitlement row status values. */
export type FeatureAccessStatus = "pending" | "paid" | "failed";
