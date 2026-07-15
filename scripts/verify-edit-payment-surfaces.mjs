import { chromium } from "@playwright/test";
import { createHmac, randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "../generated/prisma/index.js";

const root = resolve(import.meta.dirname, "..");
for (const file of [join(root, ".env"), join(root, ".env.local")]) {
  try {
    loadEnvFile(file);
  } catch {
    // Local overrides are optional.
  }
}

const baseUrl = process.env.PROOF_URL ?? "http://localhost:3000";
const db = new PrismaClient();
const browser = await chromium.launch({ args: ["--use-gl=swiftshader"] });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function save(page, name) {
  const output = join(root, "landing-prompts", `${name}.png`);
  await page.screenshot({ path: output, fullPage: false });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert(overflow <= 0, `${name}: horizontal overflow ${overflow}px`);
  console.log(`${name}: overflow=0 -> ${output}`);
}

const portfolio = await db.portfolio.findFirst({
  where: { ownerId: { not: null } },
  select: {
    ownerId: true,
    customDomain: { select: { hostname: true } },
  },
});
assert(portfolio?.ownerId, "Visual QA needs an owned portfolio");

const entitlement = await db.featureAccess.findUnique({
  where: {
    userId_featureKey: {
      userId: portfolio.ownerId,
      featureKey: "custom_domain",
    },
  },
});

const token = `surface-qa-${randomBytes(20).toString("hex")}`;
const session = await db.session.create({
  data: {
    token,
    userId: portfolio.ownerId,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    userAgent: "Porfilo modal visual QA",
  },
});

async function authenticatedPage(viewport) {
  const secret = process.env.BETTER_AUTH_SECRET;
  assert(secret, "BETTER_AUTH_SECRET is required");
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: `${token}.${signature}`,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  assert(
    new URL(page.url()).pathname === "/dashboard",
    "Authentication failed",
  );
  return { context, page, errors };
}

async function captureEditor(name, viewport) {
  const { context, page, errors } = await authenticatedPage(viewport);
  await page.getByRole("button", { name: /edit portfolio/i }).click();
  await page.getByRole("dialog", { name: /shape the proof/i }).waitFor();
  await save(page, name);
  assert(errors.length === 0, `${name}: ${errors.join("\n")}`);
  await context.close();
}

async function captureDashboard(name, viewport) {
  const { context, page, errors } = await authenticatedPage(viewport);
  await page.getByTitle("Portfolio preview").waitFor();
  await save(page, name);
  assert(errors.length === 0, `${name}: ${errors.join("\n")}`);
  await context.close();
}

async function capturePayment(name, viewport) {
  const { context, page, errors } = await authenticatedPage(viewport);
  const trigger = portfolio.customDomain?.hostname
    ? page.getByRole("button", {
        name: new RegExp(portfolio.customDomain.hostname, "i"),
      })
    : page.getByRole("button", { name: /add custom domain/i });
  await trigger.click();
  if (portfolio.customDomain?.hostname) {
    // Pre-payment domains are grandfathered and must open management directly.
    await page
      .getByRole("dialog")
      .getByText(new RegExp(`Live at ${portfolio.customDomain.hostname.replaceAll(".", "\\.")}`))
      .first()
      .waitFor();
  } else {
    await page
      .getByText("Own the URL people remember.", { exact: true })
      .waitFor();
  }
  await save(page, name);
  assert(errors.length === 0, `${name}: ${errors.join("\n")}`);
  await context.close();
}

try {
  await captureDashboard("proof-dashboard-desktop", {
    width: 1440,
    height: 900,
  });
  await captureDashboard("proof-dashboard-mobile", {
    width: 390,
    height: 844,
  });
  await captureEditor("proof-editor-desktop", { width: 1440, height: 900 });
  await captureEditor("proof-editor-mobile", { width: 390, height: 844 });

  if (entitlement?.status === "paid") {
    await db.featureAccess.update({
      where: { id: entitlement.id },
      data: { status: "pending" },
    });
  }
  await capturePayment("proof-payment-desktop", { width: 1440, height: 900 });
  await capturePayment("proof-payment-mobile", { width: 390, height: 844 });
} finally {
  if (entitlement?.status === "paid") {
    await db.featureAccess.update({
      where: { id: entitlement.id },
      data: { status: entitlement.status, updatedAt: entitlement.updatedAt },
    });
  }
  await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
  await browser.close();
  await db.$disconnect();
}
