# Load test (k6)

`porfilo-load.js` drives three scenarios concurrently against a running app:

| Scenario          | What it simulates                                              |
| ----------------- | ------------------------------------------------------------- |
| `dashboard_reads` | The batched `domain.mine` + `billing.premiumAccess` query, ramped 0→1000 VUs |
| `checkout_clicks` | Concurrent Premium CTA → `createPremiumCheckoutSession` |
| `webhook_bursts`  | Duplicate signed delayed-payment failures through the idempotent DB path |

## Run

```bash
# Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/  (brew install k6)
BASE_URL=http://localhost:3000 \
SESSION_COOKIE='better-auth.session_token=<token>' \
STRIPE_WEBHOOK_SECRET=whsec_... \
PEAK_VUS=1000 \
k6 run loadtest/porfilo-load.js
```

- `SESSION_COOKIE` — a disposable staging user's logged-in cookie. It is
  required; the test aborts rather than treating 401 responses as success.
- `STRIPE_WEBHOOK_SECRET` — must match the app's, or webhook deliveries return
  400 instead of 200. Never run this test against production or use a live
  customer's session.

## Thresholds (fail the run if breached)

- `http_req_failed` rate `< 2%`
- `http_req_duration` p95 `< 800ms`; `checkout_latency` p95 `< 1200ms`;
  `webhook_latency` p95 `< 500ms`

## Reading the results

k6 prints p95/p99, error rate, and per-scenario latency at the end. Watch for:
- rising `checkout_latency` p95 → Stripe API call is the tail; consider making
  session creation non-blocking or caching the "already unlocked" short-circuit.
- any webhook response other than 200 → signature, configuration, or database
  contention is failing the delivery contract.
- DB connection saturation (Postgres `pg_stat_activity`) → the single Prisma pool
  is the first ceiling; see the implementation report's risks section.
