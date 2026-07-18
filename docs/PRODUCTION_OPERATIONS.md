# Production operations

## Required deployment invariants

- Run `pnpm db:migrate` before `pnpm start`. CI can prove every migration from
  an empty schema with `pnpm test:migrations`.
- If `STRIPE_SECRET_KEY` is configured in production,
  `STRIPE_WEBHOOK_SECRET` must also be configured. The app intentionally refuses
  to boot with a checkout-only configuration that could collect money without
  granting Premium.
- Keep `TRUSTED_IP_HEADER=x-forwarded-for` on Railway. Only use
  `cf-connecting-ip` after every route is forced through Cloudflare and the
  direct Railway hostname is inaccessible.
- Use a pooled Railway Postgres URL and monitor database connections, CPU,
  memory, 429/503 rates, generation duration, hero-capture failures, Stripe
  webhook retries, and LLM spend.

## Scheduled cleanup

Set a random 24+ character `MAINTENANCE_SECRET`, then invoke this endpoint from
a private Railway cron service every 15 minutes:

```bash
curl --fail --request POST \
  --header "Authorization: Bearer $MAINTENANCE_SECRET" \
  https://porfilo.com/api/internal/maintenance
```

It removes expired anonymous previews and rate-limit buckets, releases crashed
work leases, and retains 45 days of LLM accounting. Invalid credentials receive
a non-descriptive 404.

## Capacity verification

Run load tests against a production-shaped staging environment, never the live
customer database:

```bash
BASE_URL=https://staging.example.com \
SESSION_COOKIE='better-auth.session_token=<disposable-staging-session>' \
STRIPE_WEBHOOK_SECRET='whsec_test_...' \
PEAK_VUS=100 \
pnpm loadtest
```

Start at 100 virtual users. Confirm p95 latency, database connections, Railway
memory, generation 503 rate, and Chromium queue depth before increasing load.
The generation and hero-capture ceilings are cross-replica database leases; tune
them with `MAX_CONCURRENT_GENERATIONS` and `MAX_CONCURRENT_HERO_CAPTURES` only
after measuring CPU and memory.
