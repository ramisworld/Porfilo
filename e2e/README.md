# E2E tests (Playwright)

Covers the **$9 Porfilo Premium** lifetime unlock flow end-to-end.

## Run

```bash
pnpm exec playwright install chromium   # one-time: download the browser
pnpm dev                                # in another terminal (app on :3000)
pnpm test:e2e
```

Override the target with `E2E_BASE_URL=https://staging.porfilo.com pnpm test:e2e`.

## Auth

`/dashboard` is behind auth. `e2e/global-setup.ts` provisions a disposable user,
portfolio, Better Auth session, and `e2e/.auth/user.json`. Global teardown
deletes the account and all cascaded test data after the run.

- **Preferred:** capture a real login once and point the setup at it:
  ```bash
  pnpm exec playwright codegen http://localhost:3000   # sign in, "Save storage state"
  E2E_STORAGE_STATE=/path/to/state.json pnpm test:e2e
  ```
- If no state is provided, the disposable local fixture is used automatically.

## What the spec asserts

`custom-domain-unlock.spec.ts` — auth is real; Stripe itself is bypassed by
writing the same paid entitlement a verified webhook would create:

1. A locked user clicks **Regenerate portfolio** and sees Porfilo Premium, the
   one-time **$9** price, and both regeneration and custom-domain benefits.
2. The paid entitlement avoids Stripe and opens the regeneration control.
3. Closing regeneration and opening **Add custom domain** reaches the normal
   domain chooser with no second payment.
