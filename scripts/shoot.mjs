// Visual-iteration harness. Loads a portfolio, drives boot + scroll, captures
// labeled screenshots to .shots/. Usage:
//   node scripts/shoot.mjs <slug> [scrollFractions...]   e.g. 0 0.45 0.6 0.75 1
// Cross-origin sandboxed iframe → scroll with mouse.wheel (can't reach contentWindow).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [slug, ...fracsRaw] = process.argv.slice(2);
if (!slug) {
  console.error("usage: node scripts/shoot.mjs <slug> [fractions...]");
  process.exit(1);
}
const fracs = (fracsRaw.length ? fracsRaw.map(Number) : [0, 0.5, 0.7, 1]);
mkdirSync(".shots", { recursive: true });

const b = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
p.on("pageerror", (e) => errs.push("PAGEERR " + e.message));

const BASE = process.env.PH_BASE || "http://localhost:3000";
await p.goto(BASE + "/sites/" + slug, {
  waitUntil: "networkidle",
  timeout: 30000,
});
await p.waitForTimeout(4200); // boot screen + scene settle
await p.mouse.move(720, 450);

// Total scrollable height via the iframe element height isn't reachable cross-origin;
// approximate with repeated wheel steps and map requested fractions onto them.
const STEPS = 24;
const PER = 520;
let atStep = 0;
const gotoFrac = async (frac) => {
  const targetStep = Math.round(frac * STEPS);
  while (atStep < targetStep) {
    await p.mouse.wheel(0, PER);
    atStep++;
    await p.waitForTimeout(90);
  }
  await p.waitForTimeout(700);
};

for (const frac of fracs) {
  await gotoFrac(frac);
  const name = `.shots/${slug}_${String(frac).replace(".", "")}.png`;
  await p.screenshot({ path: name });
  console.log("shot", name);
}
console.log("CONSOLE_ERRORS", errs.length, JSON.stringify(errs.slice(0, 6)));
await b.close();
