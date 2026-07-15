/**
 * Shared constants for the one-time custom-domain unlock.
 *
 * Kept dependency-free (no Stripe SDK, no env) so the access gate and unit tests
 * can import them without loading the payment client.
 */

/** Value stored in FeatureAccess.featureKey for the custom-domain unlock. */
export const CUSTOM_DOMAIN_FEATURE_KEY = "custom_domain";

/** Price of the unlock, in the smallest currency unit. $9 = 900. */
export const CUSTOM_DOMAIN_AMOUNT = 900;

/** Internal bookkeeping currency — never rendered in the UI (UI shows "$9"). */
export const CUSTOM_DOMAIN_CURRENCY = "usd";

/** Product name shown on the Stripe-hosted checkout page + receipt. */
export const CUSTOM_DOMAIN_PRODUCT_NAME = "Porfilo Custom Domains";

/**
 * Stripe API version we pin the client to. Matches the version the installed
 * `stripe` SDK targets (see node_modules/stripe/apiVersion.js) so we never
 * silently inherit the account-default version.
 */
export const STRIPE_API_VERSION = "2026-05-27.dahlia";

/** Entitlement row status values. */
export type FeatureAccessStatus = "pending" | "paid" | "failed";
