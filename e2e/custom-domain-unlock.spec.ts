import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "../generated/prisma/index.js";

/**
 * Premium $9 custom-domain unlock — end-to-end.
 *
 * Auth is real (via the storage state from global-setup); the tRPC billing
 * boundary is real. Before clicking Unlock, the test writes the same paid
 * entitlement a verified Stripe webhook would create, so the duplicate-charge
 * guard returns `alreadyUnlocked` without contacting Stripe.
 *
 * Global setup provisions a disposable authenticated account and portfolio.
 */

test("locked user sees the premium $9 modal and unlocks", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);

  // Open the custom-domain flow from the dashboard tile.
  await page.getByRole("button", { name: /add custom domain/i }).click();

  // Premium paywall: shows the one-time $9 price and the exact CTA copy.
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("$9", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Unlock custom domains" }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Own the URL people remember.", { exact: true }),
  ).toBeVisible();

  // Never renders "USD".
  await expect(dialog).not.toContainText("USD");

  // Simulate the verified webhook fulfilment in the database. The subsequent
  // real mutation must detect access and avoid creating a Stripe session.
  const fixture = JSON.parse(
    readFileSync("e2e/.auth/fixture.json", "utf8"),
  ) as { userId: string };
  const db = new PrismaClient();
  await db.featureAccess.create({
    data: {
      userId: fixture.userId,
      featureKey: "custom_domain",
      status: "paid",
      paidAt: new Date(),
    },
  });
  await db.$disconnect();

  // Unlock → duplicate-charge guard → normal chooser appears.
  await dialog.getByRole("button", { name: /Unlock custom domains/ }).click();

  await expect(
    dialog.getByRole("heading", { name: /choose your portfolio url/i }),
  ).toBeVisible();
  await expect(dialog.getByText("Use your own domain")).toBeVisible();
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
  expect(og.headers()["content-type"]).toContain("image/png");

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
    new RegExp(`/sites/${portfolio.publicSubdomainSlug}/opengraph-image$`),
  );
  expect(page.frames()).toHaveLength(2);
  expect(errors).toEqual([]);
});
