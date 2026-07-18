import { chromium } from "@playwright/test";
import { createHmac, randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "../generated/prisma/index.js";

const root = resolve(import.meta.dirname, "..");
for (const file of [join(root, ".env"), join(root, ".env.local")]) {
  try { loadEnvFile(file); } catch { /* optional local env */ }
}
const baseUrl = process.env.PROOF_URL ?? "http://localhost:3000";
const db = new PrismaClient();
const browser = await chromium.launch({
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function pageWithErrors(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  return { context, page, errors };
}

async function save(page, name, { screenshot = true } = {}) {
  const output = screenshot ? join(root, "landing-prompts", `${name}.png`) : null;
  if (output) await page.screenshot({ path: output, fullPage: false });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert(overflow <= 0, `${name}: horizontal overflow ${overflow}px`);
  console.log(`${name}: overflow=0${output ? ` -> ${output}` : ""}`);
}

async function installGenerationMock(page) {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (url.includes("/api/github/validate")) {
        return new Response('{"exists":true}', {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/api/generate")) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"stage":"fetching","message":"Reading public profile"}\n\n'));
            window.setTimeout(() => controller.enqueue(encoder.encode('data: {"stage":"curating","message":"Curating repositories"}\n\n')), 900);
            window.setTimeout(() => controller.enqueue(encoder.encode('data: {"stage":"designing","message":"Matching the creative direction"}\n\n')), 1800);
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return originalFetch(input, init);
    };
  });
}

async function captureLandingStates(name, viewport, { screenshots = true } = {}) {
  const { context, page, errors } = await pageWithErrors(viewport);
  await installGenerationMock(page);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      (document
        .querySelector("[data-proof-pulse]")
        ?.getAttribute("data-proof-pulse-tick")?.length ?? 0) > 0,
  );
  await page.getByLabel("GitHub username").fill("octocat");
  await page
    .getByRole("button", { name: /continue/i })
    .waitFor({ state: "visible" });
  await page.waitForFunction(
    () => {
      const button = document.querySelector('button[type="submit"]');
      return button instanceof HTMLButtonElement && !button.disabled;
    },
  );
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByLabel("Portfolio vibe").waitFor();
  await page.getByRole("button", { name: "Cybernetic" }).click();
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((candidate) =>
      /build my portfolio/i.test(candidate.textContent ?? ""),
    );
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  const buildButton = page.getByRole("button", { name: /build my portfolio/i });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((candidate) =>
      /build my portfolio/i.test(candidate.textContent ?? ""),
    );
    return button instanceof HTMLButtonElement && getComputedStyle(button).opacity === "1";
  });
  const buildButtonVisual = await buildButton.evaluate((button) => ({
    background: getComputedStyle(button).backgroundColor,
    color: getComputedStyle(button).color,
    opacity: getComputedStyle(button).opacity,
  }));
  assert(
    buildButtonVisual.background === "rgb(244, 243, 238)" &&
      buildButtonVisual.color === "rgb(13, 13, 12)" &&
      buildButtonVisual.opacity === "1",
    `${name} landing states: enabled build button lacks contrast (${JSON.stringify(buildButtonVisual)})`,
  );
  await save(page, `proof-vibe-${name}`, { screenshot: screenshots });
  await buildButton.click();
  await page.locator("[data-proof-build-screen]").waitFor();
  await page.waitForTimeout(1100);
  const buildBounds = await page.locator("[data-proof-build-screen]").evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight };
  });
  assert(
    buildBounds.top >= 0 && buildBounds.bottom <= buildBounds.viewportHeight,
    `${name} landing states: build panel is clipped vertically`,
  );
  await save(page, `proof-build-${name}`, { screenshot: screenshots });
  assert(errors.length === 0, `${name} landing states: ${errors.join("\n")}`);
  await context.close();
}

async function verifyCompactAuth(path, targetText, name, viewport) {
  const { context, page, errors } = await pageWithErrors(viewport);
  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  const target = page.getByText(targetText, { exact: false });
  await target.scrollIntoViewIfNeeded();
  assert(await target.isVisible(), `${name}: final auth content is not reachable`);
  const bounds = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      viewportHeight: innerHeight,
    };
  });
  assert(bounds.bottom <= bounds.viewportHeight, `${name}: final auth content remains clipped after scroll`);
  assert(bounds.horizontalOverflow <= 0, `${name}: horizontal overflow ${bounds.horizontalOverflow}px`);
  assert(errors.length === 0, `${name}: ${errors.join("\n")}`);
  await context.close();
  console.log(`${name}: content reachable, overflow=0`);
}

async function capturePublicPage(path, name, viewport) {
  const { context, page, errors } = await pageWithErrors(viewport);
  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  await save(page, name);
  assert(errors.length === 0, `${name}: ${errors.join("\n")}`);
  await context.close();
}

async function captureDashboard(name, viewport) {
  const secret = process.env.BETTER_AUTH_SECRET;
  assert(secret, "dashboard QA: BETTER_AUTH_SECRET is required");
  const portfolio = await db.portfolio.findFirst({
    where: { ownerId: { not: null } },
    select: { ownerId: true },
  });
  assert(portfolio?.ownerId, "dashboard QA: no owned portfolio is available");
  const token = `proof-qa-${randomBytes(20).toString("hex")}`;
  const session = await db.session.create({
    data: {
      token,
      userId: portfolio.ownerId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      userAgent: "Porfilo visual QA",
    },
  });

  try {
    const signature = createHmac("sha256", secret).update(token).digest("base64");
    const { context, page, errors } = await pageWithErrors(viewport);
    await context.addCookies([{
      name: "better-auth.session_token",
      value: `${token}.${signature}`,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    }]);
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
    assert(new URL(page.url()).pathname === "/dashboard", "dashboard QA: authentication failed");
    await page.getByTitle("Portfolio preview").waitFor();
    await save(page, name);
    assert(errors.length === 0, `${name}: ${errors.join("\n")}`);
    await context.close();
  } finally {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
  }
}

try {
  await captureLandingStates("desktop", { width: 1440, height: 900 });
  await captureLandingStates("mobile", { width: 390, height: 844 });
  await captureLandingStates(
    "compact-phone",
    { width: 375, height: 667 },
    { screenshots: false },
  );
  await capturePublicPage("/sign-in", "proof-auth-desktop", { width: 1440, height: 900 });
  await capturePublicPage("/sign-in", "proof-auth-mobile", { width: 390, height: 844 });
  await capturePublicPage(
    "/check-email?email=hello%40example.com",
    "proof-email-desktop",
    { width: 1440, height: 900 },
  );
  await verifyCompactAuth(
    "/sign-in",
    "Sessions last 30 days",
    "compact-phone auth",
    { width: 375, height: 667 },
  );
  await verifyCompactAuth(
    "/check-email?email=hello%40example.com",
    "Use a different email",
    "compact-phone check-email",
    { width: 375, height: 667 },
  );
  await captureDashboard("proof-dashboard-desktop", { width: 1440, height: 900 });
  await captureDashboard("proof-dashboard-mobile", { width: 390, height: 844 });
} finally {
  await browser.close();
  await db.$disconnect();
}
