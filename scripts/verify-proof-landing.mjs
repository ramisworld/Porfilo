import { chromium } from "@playwright/test";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const baseUrl = process.env.PROOF_URL ?? "http://localhost:3000";
const browser = await chromium.launch({
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});

const APPROVED_WORLDS = [
  "brutalist",
  "terminal",
  "magazine",
  "os",
  "neural-dither",
  "paper-cinema",
  "liquid-chrome-monolith",
  "digital-loom",
  "signal-studio",
  "living-blueprint",
  "neural-chromatic",
].sort();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function capture(name, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator("[data-proof-thumb]:visible").first().waitFor();
  const assetFailures = await page.evaluate(async () => {
    const sources = [...new Set(
      [...document.querySelectorAll("[data-proof-thumb]")].map((image) => image.currentSrc || image.src),
    )];
    const checks = await Promise.all(sources.map((source) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(null);
      image.onerror = () => resolve(source);
      image.src = source;
    })));
    return checks.filter(Boolean);
  });
  await page.waitForTimeout(900);
  const result = await page.evaluate(() => {
    const columns = [...document.querySelectorAll("[data-proof-column]")].map((column) =>
      [...column.querySelectorAll("[data-proof-world]")]
        .slice(0, 5)
        .map((card) => card.getAttribute("data-proof-world")),
    );
    return {
      cards: document.querySelectorAll("[data-proof-thumb]").length,
      columns,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      trackAnimation: getComputedStyle(document.querySelector("[data-proof-track]")).animationName,
    };
  });
  assert(result.cards === 50, `${name}: expected 50 cards, got ${result.cards}`);
  assert(assetFailures.length === 0, `${name}: broken assets ${assetFailures.join(", ")}`);
  assert(result.horizontalOverflow <= 0, `${name}: horizontal overflow ${result.horizontalOverflow}px`);
  assert(result.trackAnimation !== "none", `${name}: wall animation is not running`);

  const visibleWorlds = result.columns.flat();
  const uniqueWorlds = [...new Set(visibleWorlds)].sort();
  assert(
    JSON.stringify(uniqueWorlds) === JSON.stringify(APPROVED_WORLDS),
    `${name}: landing wall worlds do not match the approved set`,
  );
  const counts = APPROVED_WORLDS.map((world) => visibleWorlds.filter((item) => item === world).length);
  assert(
    Math.max(...counts) - Math.min(...counts) <= 1,
    `${name}: world distribution is uneven (${counts.join(", ")})`,
  );
  result.columns.forEach((column, columnIndex) => {
    column.slice(1).forEach((world, rowIndex) => {
      assert(world !== column[rowIndex], `${name}: adjacent duplicate in column ${columnIndex}`);
    });
  });
  for (let rowIndex = 0; rowIndex < 5; rowIndex += 1) {
    const row = result.columns.map((column) => column[rowIndex]);
    assert(new Set(row).size === row.length, `${name}: adjacent duplicate in row ${rowIndex}`);
  }

  const copy = await page.locator("main").innerText();
  assert(!copy.includes("Free during beta"), `${name}: removed beta line is still rendered`);
  assert(!copy.includes("Illustrative examples"), `${name}: removed disclosure is still rendered`);

  const headlineBefore = await page.evaluate(() => {
    const lead = document.querySelector("[data-proof-headline-lead]")?.getBoundingClientRect();
    const swap = document.querySelector("[data-proof-headline-swap]")?.getBoundingClientRect();
    const fixed = document.querySelector("[data-proof-fixed-copy]")?.getBoundingClientRect();
    return lead && swap && fixed
      ? { leadBottom: lead.bottom, swapTop: swap.top, fixedX: fixed.x }
      : null;
  });
  assert(headlineBefore, `${name}: headline geometry is unavailable`);
  assert(
    headlineBefore.swapTop >= headlineBefore.leadBottom - 2,
    `${name}: headline is not locked to two rows`,
  );
  await page.waitForTimeout(2600);
  const fixedXAfter = await page.locator("[data-proof-fixed-copy]").evaluate(
    (element) => element.getBoundingClientRect().x,
  );
  assert(
    Math.abs(fixedXAfter - headlineBefore.fixedX) < 0.5,
    `${name}: “this good” shifted when the rotating word changed`,
  );

  await page.locator("[data-proof-track]").evaluateAll((tracks) => {
    tracks.forEach((track) => { track.style.animationPlayState = "paused"; });
  });
  const hoverTarget = await page.locator("[data-proof-card]").evaluateAll((cards) => {
    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      const rect = card.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && card.contains(hit)) return { index, x, y };
    }
    return null;
  });
  assert(hoverTarget, `${name}: no unobstructed wall card is available for hover`);
  const firstCard = page.locator("[data-proof-card]").nth(hoverTarget.index);
  const before = await firstCard.evaluate((element) => getComputedStyle(element).transform);
  await page.mouse.move(hoverTarget.x, hoverTarget.y);
  await page.waitForTimeout(400);
  const after = await firstCard.evaluate((element) => getComputedStyle(element).transform);
  assert(before !== after, `${name}: card hover transform did not change`);
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.locator("[data-proof-track]").evaluateAll((tracks) => {
    tracks.forEach((track) => { track.style.animationPlayState = "running"; });
  });

  const output = join(root, "landing-prompts", `proof-${name}.png`);
  await page.screenshot({ path: output, fullPage: false });
  assert(errors.length === 0, `${name}: browser errors:\n${errors.join("\n")}`);
  await context.close();
  console.log(`${name}: cards=50 overflow=0 errors=0 -> ${output}`);
}

async function verifyReducedMotion() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const animationName = await page.locator("[data-proof-track]").first().evaluate(
    (element) => getComputedStyle(element).animationName,
  );
  assert(animationName === "none", `reduced motion: expected no animation, got ${animationName}`);
  assert((await page.locator("[data-proof-thumb]").count()) === 50, "reduced motion: wall is not populated");
  await context.close();
  console.log("reduced-motion: stopped and populated");
}

async function verifySynchronizedPulse() {
  const context = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  await Promise.all([
    pageA.goto(baseUrl, { waitUntil: "domcontentloaded" }),
    pageB.goto(baseUrl, { waitUntil: "domcontentloaded" }),
  ]);
  await Promise.all([
    pageA.locator("[data-proof-pulse]").waitFor(),
    pageB.locator("[data-proof-pulse]").waitFor(),
  ]);

  const cadence = Number(await pageA.locator("[data-proof-pulse]").getAttribute("data-proof-pulse-cadence"));
  assert(cadence === 15000, `portfolio pulse: expected a 15-second cadence, got ${cadence}`);
  const nextTick = Math.floor(Date.now() / cadence) + 1;
  const waitForTick = (page, tick) => page.waitForFunction(
    (target) => Number(document.querySelector("[data-proof-pulse]")?.getAttribute("data-proof-pulse-tick")) >= target,
    tick,
  );
  const readPulse = (page) => page.locator("[data-proof-pulse]").evaluate((element) => ({
    tick: Number(element.getAttribute("data-proof-pulse-tick")),
    count: Number(element.textContent?.match(/^\d+/)?.[0]),
  }));

  await Promise.all([waitForTick(pageA, nextTick), waitForTick(pageB, nextTick)]);
  const [firstA, firstB] = await Promise.all([readPulse(pageA), readPulse(pageB)]);
  assert(firstA.tick === firstB.tick, "portfolio pulse: users are on different global ticks");
  assert(firstA.count === firstB.count, "portfolio pulse: users see different counts at the same time");

  await waitForTick(pageA, firstA.tick + 1);
  const secondA = await readPulse(pageA);
  const delta = Math.abs(secondA.count - firstA.count);
  assert(delta === 1, `portfolio pulse: expected a one-count change, got ${delta}`);

  await pageB.reload({ waitUntil: "domcontentloaded" });
  await waitForTick(pageB, secondA.tick);
  const [currentA, reloadedB] = await Promise.all([readPulse(pageA), readPulse(pageB)]);
  const currentTick = Math.floor(Date.now() / cadence);
  assert(
    reloadedB.tick === currentTick,
    `portfolio pulse: reload is not on the current global tick (${reloadedB.tick} vs ${currentTick})`,
  );
  assert(
    reloadedB.tick === currentA.tick && reloadedB.count === currentA.count,
    "portfolio pulse: users disagree after reload",
  );

  await context.close();
  console.log(`portfolio-pulse: synchronized, reload-safe, live delta=${delta}`);
}

async function verifyGenerationWiring() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  let validated = false;
  let generated = false;

  await page.route("**/api/github/validate", async (route) => {
    validated = route.request().postDataJSON().username === "octocat";
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"exists":true}' });
  });
  await page.route("**/api/generate", async (route) => {
    const body = route.request().postDataJSON();
    generated = body.username === "octocat" && body.vibe === "Dark cinematic systems with precise red signals";
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'data: {"stage":"fetching","message":"Scanning public profile"}\n\ndata: {"stage":"done","slug":"proof-qa","ownerless":false}\n\n',
    });
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const input = page.getByLabel("GitHub username");
  const submit = page.getByRole("button", { name: /continue/i });
  await input.waitFor();
  // In dev mode the form can become visible a frame before React hydration.
  // Let hydration attach before entering text so the controlled value is stable.
  await page.waitForTimeout(300);
  await input.fill("octocat");
  await page.waitForFunction(() => {
    const button = document.querySelector('button[type="submit"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await submit.click();
  const vibe = page.getByLabel("Portfolio vibe");
  await vibe.waitFor();
  const build = page.getByRole("button", { name: /build my portfolio/i });
  assert(await build.isDisabled(), "generation flow: build should wait for a useful vibe");
  await vibe.fill("Dark cinematic systems with precise red signals");
  assert(await build.isEnabled(), "generation flow: valid vibe did not enable the build");
  await build.click();
  await page.getByText(/Opening dashboard/i).waitFor();
  assert(validated, "generation flow: validation request was not wired correctly");
  assert(generated, "generation flow: generation request was not wired correctly");
  await context.close();
  console.log("generation-flow: username -> validate -> vibe -> SSE -> done");
}

try {
  await capture("desktop", { width: 1440, height: 900 });
  await capture("mobile", { width: 390, height: 844 });
  await verifyReducedMotion();
  await verifySynchronizedPulse();
  await verifyGenerationWiring();
} finally {
  await browser.close();
}
