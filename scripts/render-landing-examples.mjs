import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

import { EXAMPLE_DATA } from "../landing-prompts/example-data.ts";
import { EXAMPLES } from "../landing-prompts/examples.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "landing-prompts", "examples");
const outputDir = join(root, "public", "examples");
const viewport = { width: 1200, height: 1500 };

function serialize(data) {
  return JSON.stringify(data, null, 2)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function fillWorld(template, data, key) {
  const start = template.indexOf("const DATA =");
  const end = template.indexOf("/* ===== END DATA", start);
  if (start < 0 || end < 0) throw new Error(`${key}: invalid DATA boundary`);
  const provenance = `<!-- Proof landing example. Public GitHub data snapshot: 2026-07-15. -->\n`;
  return `${provenance}${template.slice(0, start)}const DATA = ${serialize(data)};\n${template.slice(end)}`;
}

// These directories are generated artifacts. Rebuild them from the approved
// list so stale worlds can never remain available to the landing page.
await rm(sourceDir, { recursive: true, force: true });
await rm(outputDir, { recursive: true, force: true });
await mkdir(sourceDir, { recursive: true });
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});

try {
  for (const example of EXAMPLES) {
    const key = `${example.handle}-${example.world}`;
    const data = EXAMPLE_DATA[key];
    if (!data) throw new Error(`${key}: missing example data`);

    const templatePath = join(root, "world-prompts", `${example.world}.html`);
    // Several world families select their visual variant from location.pathname.
    // Keep the original world filename and isolate developers by directory.
    const sourcePath = join(sourceDir, key.toLowerCase(), `${example.world}.html`);
    const outputPath = join(root, "public", example.thumb);
    const temporaryPath = `${outputPath}.png`;
    const template = await readFile(templatePath, "utf8");
    await mkdir(dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, fillWorld(template, data, key), "utf8");

    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));

    await page.goto(pathToFileURL(sourcePath).href, { waitUntil: "load" });
    await page.mouse.move(viewport.width * 0.56, viewport.height * 0.36);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: temporaryPath, fullPage: false });
    await context.close();

    await sharp(temporaryPath)
      .resize(example.w, example.h, { fit: "cover", position: "top" })
      .webp({ quality: 84, effort: 6 })
      .toFile(outputPath);
    await rm(temporaryPath);

    if (errors.length > 0) {
      throw new Error(`${key}: browser errors:\n${errors.join("\n")}`);
    }
    console.log(`rendered ${key} -> ${example.thumb}`);
  }
} finally {
  await browser.close();
}
