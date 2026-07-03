// One-shot live generation cost test. Drives the landing page, types the GitHub
// username, clicks Generate, captures the loading/build-log overlay, waits for
// the done/ClaimCard state, and reports wall-clock time.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.PH_BASE || "http://localhost:3000";
const USER = process.env.GH_USER || "karpathy";
const OUT = process.env.OUT || ".shots-gen";
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
p.on("pageerror", (e) => errs.push("PAGEERR " + e.message));

await p.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
await p.waitForTimeout(800);

// Find the username input. Try common selectors.
const input = p.locator('input[type="text"], input:not([type])').first();
await input.waitFor({ timeout: 10000 });
await input.click();
await input.fill(USER);
await p.screenshot({ path: `${OUT}/00_filled.png`, fullPage: true });

// Click the generate/submit button.
const btn = p
  .locator('button:has-text("Generate"), button[type="submit"], form button')
  .first();
const t0 = Date.now();
await btn.click();

// Capture the loading overlay a few times as it streams.
let doneAt = null;
const shots = [];
for (let i = 0; i < 120; i++) {
  await p.waitForTimeout(1000);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  // Snapshot the loading screen at a few early moments.
  if (i === 1 || i === 4 || i === 9) {
    const f = `${OUT}/loading_${elapsed}s.png`;
    await p.screenshot({ path: f, fullPage: true });
    shots.push(f);
    console.log("LOADING_SHOT", f);
  }
  // Detect done: ClaimCard shows a claim link / "your portfolio is ready" / a
  // link to /sites/ or a claim button.
  const bodyText = (await p.locator("body").innerText().catch(() => "")) || "";
  const hasClaim =
    /claim/i.test(bodyText) ||
    /ready/i.test(bodyText) ||
    (await p.locator('a[href*="/claim"], a[href*="/sites/"]').count()) > 0;
  const stillBuilding = /building|analy|scanning|generat|fetch/i.test(bodyText);
  if (hasClaim && !stillBuilding) {
    doneAt = Date.now();
    break;
  }
  // Also break if a claim/sites link appears regardless.
  if ((await p.locator('a[href*="/claim"]').count()) > 0) {
    doneAt = Date.now();
    break;
  }
}

const totalS = ((doneAt ?? Date.now()) - t0) / 1000;
await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/99_done.png`, fullPage: true });

console.log("\n=== RESULT ===");
console.log("done:", doneAt ? "yes" : "TIMEOUT");
console.log("wallclock_seconds:", totalS.toFixed(1));
console.log("console_errors:", errs.length, JSON.stringify(errs.slice(0, 5)));
await b.close();
