import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * Premium $9 custom-domain unlock — end-to-end.
 *
 * Auth is real (via the storage state from global-setup); the tRPC billing
 * boundary is stubbed so the flow is deterministic and needs neither real Stripe
 * nor a live webhook. We start locked, assert the premium modal, click Unlock,
 * and — instead of a real Stripe redirect — return `alreadyUnlocked` + flip the
 * access stub so the UI drops into the normal domain chooser.
 *
 * If /dashboard redirects to sign-in (no auth wired), the test skips itself.
 */

/** Toggled to true once the user "pays". Drives the access stub. */
let unlocked = false;

/** tRPC v11 + superjson success envelope for a batch of results. */
function trpcBatch(values: unknown[]): string {
  return JSON.stringify(values.map((v) => ({ result: { data: { json: v } } })));
}

/** Value returned for each intercepted procedure (null for anything unknown). */
function valueForProcedure(name: string): unknown {
  if (name === "billing.customDomainAccess") return { unlocked };
  if (name === "domain.mine") return null; // no domain yet
  if (name === "billing.createCustomDomainCheckoutSession") {
    unlocked = true; // simulate successful payment + webhook fulfilment
    return { alreadyUnlocked: true };
  }
  return null;
}

async function stubTrpcBilling(page: Page): Promise<void> {
  await page.route("**/api/trpc/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    const procs = decodeURIComponent(path.split("/api/trpc/")[1] ?? "").split(",");
    // Only intervene when a billing/domain procedure is in the batch; otherwise
    // let it hit the real backend.
    if (!procs.some((p) => p.startsWith("billing.") || p === "domain.mine")) {
      return route.continue();
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: trpcBatch(procs.map(valueForProcedure)),
    });
  });
}

test.beforeEach(() => {
  unlocked = false;
});

test("locked user sees the premium $9 modal and unlocks", async ({ page }) => {
  await stubTrpcBilling(page);

  const response = await page.goto("/dashboard");
  test.skip(
    !!response && response.url().includes("/sign-in"),
    "No authenticated storage state — see e2e/README.md",
  );

  // Open the custom-domain flow from the dashboard tile.
  await page.getByRole("button", { name: /add custom domain/i }).click();

  // Premium paywall: shows the one-time $9 price and the exact CTA copy.
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("$9", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Unlock custom domains" }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Connect your own domain to your Porfilo site."),
  ).toBeVisible();

  // Never renders "USD".
  await expect(dialog).not.toContainText("USD");

  // Unlock → (stubbed) payment + fulfilment → normal chooser appears.
  await dialog
    .getByRole("button", { name: "Unlock custom domains" })
    .click();

  await expect(
    dialog.getByRole("heading", { name: /choose your portfolio url/i }),
  ).toBeVisible();
  await expect(dialog.getByText("Use your own domain")).toBeVisible();
});
