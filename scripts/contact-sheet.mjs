// Variety contact-sheet. Generates many username+vibe inputs, screenshots each
// hero, and tiles them into ONE image so variety is judgeable at a glance.
// Usage: node scripts/contact-sheet.mjs [vibesFile.json]
//   vibesFile: optional JSON [{ "user": "...", "vibe": "..." }, ...]
// Default uses a built-in spread across temperaments/packs.
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const BASE = process.env.PH_BASE || "http://localhost:3000";

const DEFAULT = [
  { user: "ramisworld", vibe: "engineered technical swiss grid system, blue" },
  { user: "ramisworld", vibe: "raw brutal industrial shatter, red, aggressive" },
  { user: "ramisworld", vibe: "soft serene premium calm minimal, indigo, airy" },
  { user: "ramisworld", vibe: "playful vibrant colorful fun bouncy, pink, lively" },
  { user: "ramisworld", vibe: "cinematic dramatic moody monolithic, dark, teal" },
  { user: "ramisworld", vibe: "terminal hacker cyber matrix, neon green" },
  { user: "ramisworld", vibe: "minimal clean elegant, monochrome" },
  { user: "ramisworld", vibe: "bold print editorial newspaper, orange" },
  { user: "ramisworld", vibe: "dense complex intricate lattice, purple, energetic" },
];

const vibes = process.argv[2]
  ? JSON.parse(readFileSync(process.argv[2], "utf8"))
  : DEFAULT;

mkdirSync(".shots", { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Honors the dev rate limiter (5 / 60s per ip:username): on 429, wait and retry.
async function generate(user, vibe, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${BASE}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: user, vibe }),
    });
    if (res.status === 429) {
      const wait = (Number(res.headers.get("retry-after")) || 12) + 1;
      console.log(`  rate-limited, waiting ${wait}s…`);
      await sleep(wait * 1000);
      continue;
    }
    const text = await res.text();
    const slugs = [...text.matchAll(/"slug":"([^"]+)"/g)].map((m) => m[1]);
    if (slugs.length) return slugs.at(-1);
    if (/error/i.test(text)) console.log("  gen error:", text.slice(0, 120));
    return null;
  }
  return null;
}

const b = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });

const tiles = [];
for (const { user, vibe } of vibes) {
  try {
    const slug = await generate(user, vibe);
    if (!slug) {
      console.log("FAIL gen", vibe);
      continue;
    }
    await p.goto(`${BASE}/sites/${slug}`, { waitUntil: "networkidle", timeout: 30000 });
    await p.waitForTimeout(4200); // boot + settle
    const buf = await p.screenshot();
    tiles.push({ vibe, slug, b64: buf.toString("base64") });
    console.log("shot", slug, "·", vibe);
  } catch (e) {
    console.log("ERR", vibe, String(e).slice(0, 80));
  }
}

// Tile into one sheet via an HTML grid, screenshot it.
const cells = tiles
  .map(
    (t) => `<figure>
      <img src="data:image/png;base64,${t.b64}"/>
      <figcaption>${t.slug} · ${t.vibe.replace(/</g, "&lt;")}</figcaption>
    </figure>`,
  )
  .join("");
const html = `<!doctype html><meta charset=utf8><style>
  body{margin:0;background:#0b0b0e;font:13px ui-monospace,monospace;color:#cfd2da}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:14px}
  figure{margin:0;border:1px solid #23232f;border-radius:8px;overflow:hidden;background:#000}
  img{width:100%;display:block}
  figcaption{padding:8px 10px;color:#aab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style><div class="grid">${cells}</div>`;

const cols = 3;
const rows = Math.ceil(tiles.length / cols);
const sheet = await b.newPage({ viewport: { width: 3 * 440 + 4 * 14, height: rows * 320 + 40 } });
await sheet.setContent(html, { waitUntil: "load" });
await sheet.screenshot({ path: ".shots/contact-sheet.png", fullPage: true });
console.log(`\ncontact sheet -> .shots/contact-sheet.png (${tiles.length} tiles)`);
await b.close();
