# Custom-domain unlock — one-time $9 Stripe payment

Implementation report for the paywall in front of the dashboard "Add custom
domain" tile.

## What it does

The whole "Add custom domain" tile (free `*.porfilo.com` subdomain **and**
bring-your-own domain) is gated behind a single one-time **$9** unlock. Paid
users go straight into the existing domain flow; locked users see a premium
upgrade modal. The UI only ever shows `$9` — never "USD". Access is a permanent,
account-level entitlement and is granted **only** by verified Stripe webhook
fulfilment.

## Files changed

**Schema / migration**
- `prisma/schema.prisma` — new `FeatureAccess` model + `User.featureAccess` relation.
- `prisma/migrations/20260704120000_add_feature_access/migration.sql`.

**Config**
- `src/env.js` — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CUSTOM_DOMAIN_PRICE_ID` (all optional; app boots without them).
- `.env.example` — documented Stripe keys.
- `package.json` — `stripe` dependency, `@playwright/test` dev dependency, `test:e2e` script.
- `tsconfig.json` — excludes `e2e`, `loadtest`, `playwright.config.ts` from the app typecheck.

**Backend**
- `src/server/billing/constants.ts` — feature key, amount (900), currency, product name, pinned API version.
- `src/server/billing/stripe.ts` — lazy Stripe singleton + `StripeDisabledError` + `isStripeConfigured`.
- `src/server/billing/access.ts` — `hasCustomDomainAccess(db, userId)`.
- `src/server/billing/fulfillment.ts` — idempotent `fulfillCheckout(sessionId)`.
- `src/server/api/routers/billing.ts` — `customDomainAccess` query + `createCustomDomainCheckoutSession` mutation.
- `src/server/api/root.ts` — mounts `billing`.
- `src/app/api/stripe/webhook/route.ts` — signature-verifying webhook endpoint.
- `src/server/api/routers/domain.ts` — server-side gate (`requireCustomDomainAccess`) on both add mutations.

**Frontend**
- `src/app/(app)/dashboard/domain-modal.tsx` — `UpgradePanel` + `UnlockingState` + access gate.
- `src/app/(app)/dashboard/domain-tile.tsx` — checkout-return handling (`?checkout=success|cancelled`).

**Tests / tooling**
- `src/server/billing/access.test.ts`, `fulfillment.test.ts`
- `src/server/api/routers/billing.test.ts`, `domain-gate.test.ts`
- `src/app/api/stripe/webhook/route.test.ts`
- `playwright.config.ts`, `e2e/*` (config, global-setup, spec, README)
- `loadtest/porfilo-load.js`, `loadtest/README.md`

## Stripe docs checked (2026)

- Checkout Sessions API — `docs.stripe.com/api/checkout/sessions/create`
- Fulfillment guide — `docs.stripe.com/checkout/fulfillment`
- Webhooks — `docs.stripe.com/webhooks`
- API versioning — `docs.stripe.com/api/versioning`

## API / SDK version

- **API version pinned:** `2026-06-24.dahlia`, set explicitly on the client (not
  the account default). Confirmed to match the installed SDK's target in
  `node_modules/stripe/apiVersion.js`.
- **SDK:** `stripe` v22 (latest at implementation).

## How webhook fulfilment works

1. Checkout is created server-side (`billing.createCustomDomainCheckoutSession`)
   with `mode: "payment"`, one `$9` line item, `client_reference_id = userId`,
   and `metadata { userId, featureKey, featureAccessId }`. A **pending**
   `FeatureAccess` row is upserted first and the session id stored on it.
2. `success_url` returns to `/dashboard?checkout=success&session_id=…`; the
   dashboard shows "Payment received. Unlocking…" and polls access. The success
   URL never grants access itself.
3. `POST /api/stripe/webhook` reads the **raw** body, verifies the
   `stripe-signature` with `constructEvent` (400 on failure), and on
   `checkout.session.completed` / `checkout.session.async_payment_succeeded`
   calls `fulfillCheckout`.
4. `fulfillCheckout` retrieves the session (`expand: ["line_items"]`), ignores it
   if `payment_status === "unpaid"`, matches our record (by session id, fallback
   by `userId_featureKey`), rejects a `userId` that doesn't match the session
   metadata, then flips the row to `paid` with a conditional
   `updateMany({ where: { id, status: { not: "paid" } } })`. Returns 2xx quickly.

**Idempotency:** the conditional update + the `@@unique([userId, featureKey])`
and unique Stripe-id constraints mean duplicate or concurrent deliveries flip the
row at most once (`count === 0` → already fulfilled, treated as success).

## How duplicate purchases are prevented

- `createCustomDomainCheckoutSession` calls `hasCustomDomainAccess` first and
  returns `{ alreadyUnlocked: true }` **before** any Stripe call for paid users.
- One `FeatureAccess` row per `(userId, featureKey)` (unique) — retries reuse the
  same row, so a user can never accumulate multiple paid records.
- The UI hides the unlock CTA once access is unlocked (`alreadyUnlocked` also
  short-circuits the panel client-side).

## Never trusting client metadata alone

Fulfilment matches the incoming session to a **pending record we created before
checkout** and additionally requires `record.userId === session.metadata.userId`;
a mismatch is ignored. Metadata alone never grants access.

## Test commands run

```bash
pnpm test        # 16 files, 135 tests — all passing (incl. 5 new billing suites)
pnpm check       # next lint + tsc --noEmit — clean
```

New suites: access logic, idempotent fulfilment (unpaid / happy / duplicate /
spoofed userId / fallback match), checkout-session creation + duplicate
prevention + not-configured, signed webhook (200 valid / 400 tampered / 400
missing sig / 200 unrelated / idempotent duplicates), and the server-side gate
(FORBIDDEN without a paid unlock).

Manual verification: use the Stripe CLI —
`stripe listen --forward-to localhost:3000/api/stripe/webhook`, set the printed
`whsec_…`, then `stripe trigger checkout.session.completed`.

## Load test summary

Script: `loadtest/porfilo-load.js` (k6). Ramps to 1000 VUs across three
scenarios — dashboard reads, concurrent checkout clicks, and signed webhook
bursts with duplicate session ids to exercise idempotency under retries.
Thresholds: `http_req_failed < 2%`, `http_req_duration` p95 `< 800ms`, checkout
p95 `< 1200ms`, webhook p95 `< 500ms`. No live 1000-VU run was executed in this
environment; run it against a deployed instance with Stripe test keys and a
session cookie (see `loadtest/README.md`).

## Remaining risks / notes

- **DB connection ceiling.** Single global Prisma pool against Railway Postgres,
  one `DATABASE_URL` (no PgBouncer/`DIRECT_URL` split). The first thing to watch
  at 1000+ concurrency; add a pooler / bounded `connection_limit` before relying
  on the load numbers.
- **Production setup required.** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
  a Dashboard webhook pointing at `/api/stripe/webhook`. The feature is
  friendly-disabled (PRECONDITION_FAILED) until set.
- **E2E auth.** The spec needs a logged-in storage state (or it self-skips);
  wiring a seeded better-auth session is left as a documented project hook.
- **Rate limiter is in-process** (existing app limitation) — per-instance only;
  swap for a shared limiter when multi-instance.
- `checkout.session.expired` is not handled (harmless — pending rows never grant
  access); could be added to clean up stale pending rows.
