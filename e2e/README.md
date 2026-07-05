# E2E tests (Playwright)

Covers the premium **$9 custom-domain unlock** flow end-to-end.

## Run

```bash
pnpm exec playwright install chromium   # one-time: download the browser
pnpm dev                                # in another terminal (app on :3000)
pnpm test:e2e
```

Override the target with `E2E_BASE_URL=https://staging.porfilo.com pnpm test:e2e`.

## Auth

`/dashboard` is behind auth, so the suite needs a logged-in browser context.
`e2e/global-setup.ts` provisions `e2e/.auth/user.json`:

- **Preferred:** capture a real login once and point the setup at it:
  ```bash
  pnpm exec playwright codegen http://localhost:3000   # sign in, "Save storage state"
  E2E_STORAGE_STATE=/path/to/state.json pnpm test:e2e
  ```
- If no state is provided, the spec detects the sign-in redirect and **skips**
  (keeps CI green until auth is wired).

## What the spec asserts

`custom-domain-unlock.spec.ts` — auth is real; the tRPC billing calls are stubbed
so the flow is deterministic (no live Stripe / webhook):

1. A locked user opens the tile and sees the premium modal: the one-time **$9**
   price, the **"Unlock custom domains"** CTA, the "Connect your own domain…"
   copy, and — critically — **no "USD"** anywhere.
2. Clicking **Unlock** simulates payment + fulfilment (the access stub flips to
   unlocked) and the modal transitions into the normal domain chooser.
