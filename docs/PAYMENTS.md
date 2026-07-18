# Production payments

Porfilo uses Stripe Checkout for one account-level, lifetime **Porfilo Premium**
unlock. The price is **$9 USD once**. It unlocks custom domains and dashboard
portfolio regeneration. This is not a subscription.

## Source of truth

- `src/server/billing/constants.ts` owns the amount, currency, feature key, and
  checkout-version identifier.
- `FeatureAccess` owns the entitlement. One `(userId, featureKey)` row exists per
  user, and only `status = "paid"` grants access.
- `src/server/api/routers/billing.ts` creates or reuses the hosted Checkout
  Session. It never grants access.
- `POST /api/stripe/webhook` verifies Stripe's signature and is the reliable
  fulfillment path.
- The authenticated success return invokes the same fulfillment validator so
  access can unlock immediately; it is not a replacement for the webhook.
- `src/server/billing/fulfillment.ts` independently retrieves the Session and
  checks mode, paid status, amount, currency, user identity, and feature before
  marking the entitlement paid.

## Railway variables

Set these as service variables for the production environment:

```text
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PREMIUM_PRICE_ID=price_...
BETTER_AUTH_URL=https://porfilo.com
NEXT_PUBLIC_ROOT_DOMAIN=porfilo.com
```

The Stripe variables are server-only. Never prefix them with `NEXT_PUBLIC_`.

`STRIPE_PREMIUM_PRICE_ID` is optional in code (inline $9 USD pricing is
the fallback), but a pre-created Price is recommended in production for clean
Stripe reporting. The app validates that this Price is active, one-time, USD,
and exactly 900 cents before creating Checkout.

## Stripe setup

1. Activate the Stripe account and complete its business/bank requirements.
2. In live mode, create the product **Porfilo Premium** with the description
   “Use your own domain and regenerate your portfolio with new designs.
   One-time payment.”
3. Add a **one-time** Price of **$9.00 USD**. Copy its `price_...` id.
4. Copy the live secret key (`sk_live_...`) from Developers → API keys.
5. In Workbench → Webhooks, add this HTTPS endpoint:
   `https://porfilo.com/api/stripe/webhook`
6. Subscribe the endpoint to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
7. Reveal that endpoint's signing secret (`whsec_...`). A CLI signing secret and
   a Dashboard endpoint signing secret are different and cannot be interchanged.
8. Add the three Stripe values to Railway and redeploy. Railway runs
   `prisma migrate deploy` before starting the app.

## Duplicate-charge protection

- The client disables the button while checkout is starting.
- Checkout creation is rate-limited per authenticated user.
- An existing correctly-priced open Checkout Session is reused.
- Concurrent Stripe POSTs use the same idempotency key.
- If payment wins a race while another Session is being created, that new
  Session is expired before its URL is returned.
- Paid users are rejected before checkout, and database writes never downgrade
  `paid` back to `pending`.
- Webhook fulfillment is safe across retries and concurrent deliveries.

## Release checklist

1. Use Stripe **test mode** first with `sk_test_...`, a test Price, and a test
   webhook signing secret.
2. Complete Checkout with Stripe's `4242 4242 4242 4242` test card.
3. Confirm the webhook delivery is `200`, the `FeatureAccess` row is `paid`, and
   the dashboard unlocks Premium, custom domains, and regeneration.
4. Click rapidly and open multiple tabs; all attempts must return the same
   Checkout Session URL.
5. Repeat with live keys and a real low-risk transaction, then refund that test
   payment from Stripe if appropriate.
6. Keep Stripe receipt emails enabled and review tax obligations before selling
   broadly. Stripe Tax is not enabled automatically by this integration.
