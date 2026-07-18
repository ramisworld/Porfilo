import "server-only";
import { readFileSync } from "fs";
import { join } from "path";
import type { ProfileData } from "~/server/profile/model";
import type { DesignSpec } from "./spec";

/**
 * Assemble a self-contained portfolio page from the hand-built Engine + the
 * DesignSpec + ProfileData. The runtime files (CSS/JS) are OUR code, inlined
 * once — the LLM never pays tokens for them. Rendering on the fly means engine
 * upgrades apply to every existing portfolio.
 *
 * Runtime files are read from disk relative to cwd (fine for local dev). Prod
 * packaging (embed-as-string / Next includeFiles) is a flagged follow-up.
 */

const RUNTIME = join(process.cwd(), "src", "engine", "runtime");
// engine.js must be LAST — it boots after all registries (window.PH.*) are defined.
const JS_ORDER = [
  "backgrounds.js",
  "gimmicks.js",
  "skins.js",
  "archetypes.js",
  "experiences.js",
  "engine.js",
];

function read(file: string): string {
  return readFileSync(join(RUNTIME, file), "utf8");
}

// Safe to embed JSON in an inline <script>: neutralise </script> and the JS line
// separators U+2028 / U+2029 (referenced via fromCharCode so this source stays ASCII).
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
function safeJson(v: unknown): string {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .split(LS)
    .join("\\u2028")
    .split(PS)
    .join("\\u2029");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Root domain that serves the ONE shared engine bundle (public/engine/<v>.{js,css}).
// Protocol-relative + root host so the subdomain middleware never rewrites it.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

/**
 * Shared-engine page: a TINY HTML doc that inlines only the recipe
 * (window.SPEC + window.DATA) and references the one engine bundle served by the
 * app. The ~0.7 MB Three.js/GSAP engine is NOT duplicated per portfolio — it is
 * cached once and shared. Engine upgrades = bump the version; no re-generation.
 */
export function renderPortfolioPage(
  spec: DesignSpec,
  data: ProfileData,
  version: string,
  assetOrigin?: string,
): string {
  const sig = spec.signatureCss ? `<style>${spec.signatureCss}</style>` : "";
  const title = escapeHtml((data.identity.name ?? "Portfolio") + " — Portfolio");
  const root = assetOrigin?.replace(/\/$/, "") ?? `//${ROOT_DOMAIN}`;
  const base = `${root}/engine/${encodeURIComponent(version)}`;
  return (
    `<!DOCTYPE html><html lang="en"><head>` +
    `<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>` +
    `<title>${title}</title>` +
    `<link rel="stylesheet" href="${base}.css"/>${sig}</head><body>` +
    `<script>window.SPEC=${safeJson(spec)};window.DATA=${safeJson(data)};</script>` +
    `<script src="${base}.js" defer></script>` +
    `</body></html>`
  );
}

/** Self-contained page (engine inlined). Used for export/download (offline). */
export function renderPortfolio(spec: DesignSpec, data: ProfileData): string {
  const css = read("base.css");
  const js = JS_ORDER.map(read).join("\n");
  const sig = spec.signatureCss ? `<style>${spec.signatureCss}</style>` : "";
  const title = escapeHtml((data.identity.name ?? "Portfolio") + " — Portfolio");

  return (
    `<!DOCTYPE html><html lang="en"><head>` +
    `<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>` +
    `<title>${title}</title><style>${css}</style>${sig}</head><body>` +
    `<script>window.SPEC=${safeJson(spec)};window.DATA=${safeJson(data)};</script>` +
    `<script>${js}</script>` +
    `</body></html>`
  );
}
