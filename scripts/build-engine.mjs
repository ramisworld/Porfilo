// Builds the SHARED engine to public/engine/<ENGINE_VERSION>.{js,css}.
// One artifact, served statically and referenced by every portfolio (no per-row bundle).
//   premium/index.ts (three + gsap, esbuild IIFE)  ++  runtime/*.js (DOM builder + 2D fallback)
//   issuers.entry.ts (TS bundle for shared issuer registry)
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// KEEP IN SYNC with src/engine/version.ts (ENGINE_VERSION).
const ENGINE_VERSION = "v3";

const root = process.cwd();
const runtimeDir = join(root, "src/engine/runtime");
const outDir = join(root, "public/engine");
mkdirSync(outDir, { recursive: true });

// Base runtime loads first (defines window.PH, registers the DOMContentLoaded boot);
// the premium IIFE then runs synchronously and sets its flags before the DOM is built.
// `issuers.entry.ts` is bundled via esbuild and concatenated alongside the
// plain-JS files (it consumes the shared src/lib/issuers.ts registry).
const RUNTIME_ORDER = [
  "backgrounds.js",
  "gimmicks.js",
  "skins.js",
  "archetypes.js",
  "experiences.js",
  "engine.js",
];
const runtimeJs = RUNTIME_ORDER.map((f) =>
  readFileSync(join(runtimeDir, f), "utf8"),
).join("\n;\n");

// Bundle the shared issuer registry through esbuild so both the engine
// runtime and the React editor consume identical local logo metadata.
const issuersBuild = await build({
  entryPoints: [join(runtimeDir, "issuers.entry.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2019",
  minify: true,
  legalComments: "none",
  write: false,
  // Mirror the tsconfig path alias `~/*` so the entry can import from `~/lib/...`.
  alias: { "~": join(root, "src") },
});
const issuersJs = issuersBuild.outputFiles[0].text;

const result = await build({
  entryPoints: [join(root, "src/engine/premium/index.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2019",
  minify: true,
  legalComments: "none",
  write: false,
});
const premiumJs = result.outputFiles[0].text;

const jsPath = join(outDir, `${ENGINE_VERSION}.js`);
const cssPath = join(outDir, `${ENGINE_VERSION}.css`);
// Issuers must be registered on window.PH before experiences.js renders.
writeFileSync(jsPath, issuersJs + "\n;\n" + runtimeJs + "\n;\n" + premiumJs);
writeFileSync(cssPath, readFileSync(join(runtimeDir, "base.css"), "utf8"));

const kb = (p) => Math.round(readFileSync(p).length / 1024);
console.log(
  `engine ${ENGINE_VERSION} built -> public/engine/${ENGINE_VERSION}.js (${kb(jsPath)} KB), .css (${kb(cssPath)} KB)`,
);
