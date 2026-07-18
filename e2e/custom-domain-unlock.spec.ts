import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "../generated/prisma/index.js";

/**
 * Porfilo Premium $9 lifetime unlock — end-to-end.
 *
 * Auth is real (via the storage state from global-setup); the tRPC billing
 * boundary is real. Before clicking Unlock, the test writes the same paid
 * entitlement a verified Stripe webhook would create, so the duplicate-charge
 * guard returns `alreadyUnlocked` without contacting Stripe.
 *
 * Global setup provisions a disposable authenticated account and portfolio.
 */

test("Premium unlock enables regeneration and custom domains", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);

  // Regeneration is visible in the dashboard, but a free account sees Premium.
  await page.getByRole("button", { name: /regenerate portfolio/i }).click();

  // Premium paywall: shows the one-time $9 price and the exact CTA copy.
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("$9", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Porfilo Premium" }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Keep evolving the work.", { exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText("Regenerate your portfolio");
  await expect(dialog).toContainText("No subscription");

  // Simulate the verified webhook fulfilment in the database. The subsequent
  // real mutation must detect access and avoid creating a Stripe session.
  const fixture = JSON.parse(
    readFileSync("e2e/.auth/fixture.json", "utf8"),
  ) as { userId: string };
  const db = new PrismaClient();
  await db.featureAccess.create({
    data: {
      userId: fixture.userId,
      featureKey: "premium",
      status: "paid",
      amount: 900,
      paidAt: new Date(),
    },
  });
  await db.$disconnect();

  // Premium CTA → duplicate-charge guard → regeneration control appears.
  await dialog.getByRole("button", { name: /Get Porfilo Premium/i }).click();

  const regenerateDialog = page.getByRole("dialog");
  await expect(
    regenerateDialog.getByRole("heading", {
      name: /regenerate your portfolio/i,
    }),
  ).toBeVisible();
  await expect(regenerateDialog.getByLabel("GitHub username")).toBeVisible();
  await expect(regenerateDialog.getByLabel("Creative direction")).toBeVisible();
  await expect(regenerateDialog).toContainText(
    "Your Porfilo URL, connected custom domain, and account stay intact.",
  );

  // The same control remains contained and usable at an iPhone-sized viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = await regenerateDialog.locator("section").boundingBox();
  expect(panel).not.toBeNull();
  expect(panel?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect(panel?.width ?? 999).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await regenerateDialog
    .getByRole("button", { name: "Close", exact: true })
    .click();

  // The same entitlement also unlocks the custom-domain chooser.
  await page.getByRole("button", { name: /add custom domain/i }).click();

  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: /choose your portfolio url/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Use your own domain"),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("public portfolio routes expose correct status, metadata, and OG image", async ({
  page,
  request,
}) => {
  const fixture = JSON.parse(
    readFileSync("e2e/.auth/fixture.json", "utf8"),
  ) as { userId: string };
  const db = new PrismaClient();
  const portfolio = await db.portfolio.findUniqueOrThrow({
    where: { ownerId: fixture.userId },
    select: { publicSubdomainSlug: true },
  });
  await db.$disconnect();

  const missing = await request.get("/sites/definitely-missing-portfolio");
  expect(missing.status()).toBe(404);

  const og = await request.get("/api/og");
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/jpeg");

  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const response = await page.goto(`/sites/${portfolio.publicSubdomainSlug}`, {
    waitUntil: "networkidle",
  });
  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    new RegExp(
      `/sites/${portfolio.publicSubdomainSlug}/opengraph-image(?:\\?.*)?$`,
    ),
  );
  expect(page.frames()).toHaveLength(2);
  expect(errors).toEqual([]);
});
