import "server-only";
import type { DesignSpec } from "~/engine/spec";

/**
 * Server-side deterministic roll for the generative LAYOUT. Same seed → same
 * layout, every distinct seed → a different (but temperament-coherent) layout.
 * Mirrors the engine-side object roll (src/engine/premium/rollObject.ts): the
 * temperament centers each axis; the seed varies within a conservative band.
 *
 * The art-director (mock now, LLM later) emits only seed+temperament+bias; this
 * expands them into the full layout recipe stored on the spec.
 */

type Temperament = DesignSpec["generative"]["temperament"];
type Layout = DesignSpec["layout"];

// --- tiny seeded PRNG (xmur3 + mulberry32), self-contained for the server ---
function rngFrom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = (h ^= h >>> 16) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Weighted pick: each option has a relative weight; heavier = more likely.
function weighted<T extends string>(r: number, opts: [T, number][]): T {
  const total = opts.reduce((s, [, w]) => s + w, 0);
  let x = r * total;
  for (const [v, w] of opts) {
    if ((x -= w) < 0) return v;
  }
  return opts[0]![0];
}

interface Centers {
  chrome: [Layout["chrome"], number][];
  hero: [Layout["hero"], number][];
  container: [Layout["container"], number][];
  density: [Layout["density"], number][];
  borders: [Layout["borders"], number][];
  stage: [Layout["stage"], number][];
  upper: number; // P(uppercase headings)
  accentBlock: number; // P(accent role block)
}

// Per-temperament weighting. The heavy option is the "anchor"; lighter options
// are tasteful neighbours that add per-roll variety without breaking coherence.
const CENTERS: Record<Temperament, Centers> = {
  engineered: {
    chrome: [["topbar", 5], ["rail", 4], ["pill", 1]],
    hero: [["split", 6], ["mirror", 3], ["centered", 1]],
    container: [["panel", 6], ["band", 3], ["card", 1]],
    density: [["normal", 6], ["airy", 3], ["tight", 1]],
    borders: [["hairline", 7], ["heavy", 2], ["none", 1]],
    stage: [["fullbleed", 5], ["viewport", 4], ["bare", 1]],
    upper: 0.7, accentBlock: 0.2,
  },
  raw: {
    chrome: [["topbar", 7], ["rail", 2], ["pill", 1]],
    hero: [["split", 6], ["mirror", 3], ["centered", 1]],
    container: [["band", 7], ["panel", 2], ["card", 1]],
    density: [["tight", 6], ["normal", 3], ["airy", 1]],
    borders: [["heavy", 7], ["hairline", 2], ["none", 1]],
    stage: [["fullbleed", 6], ["viewport", 3], ["bare", 1]],
    upper: 0.95, accentBlock: 0.75,
  },
  serene: {
    chrome: [["pill", 6], ["topbar", 3], ["rail", 1]],
    hero: [["centered", 6], ["split", 3], ["mirror", 1]],
    container: [["card", 7], ["panel", 2], ["band", 1]],
    density: [["airy", 7], ["normal", 2], ["tight", 1]],
    borders: [["none", 6], ["hairline", 4]],
    stage: [["fullbleed", 4], ["orb", 4], ["viewport", 2]],
    upper: 0.25, accentBlock: 0.1,
  },
  cinematic: {
    chrome: [["rail", 5], ["topbar", 4], ["pill", 1]],
    hero: [["split", 5], ["mirror", 4], ["centered", 1]],
    container: [["panel", 5], ["band", 4], ["card", 1]],
    density: [["airy", 6], ["normal", 3], ["tight", 1]],
    borders: [["hairline", 6], ["none", 3], ["heavy", 1]],
    stage: [["fullbleed", 7], ["viewport", 2], ["bare", 1]],
    upper: 0.6, accentBlock: 0.2,
  },
  playful: {
    chrome: [["pill", 6], ["topbar", 3], ["rail", 1]],
    hero: [["centered", 5], ["split", 4], ["mirror", 1]],
    container: [["card", 7], ["band", 2], ["panel", 1]],
    density: [["normal", 6], ["airy", 3], ["tight", 1]],
    borders: [["none", 5], ["hairline", 4], ["heavy", 1]],
    stage: [["fullbleed", 5], ["orb", 4], ["viewport", 1]],
    upper: 0.4, accentBlock: 0.45,
  },
};

export function rollLayout(seed: string, temperament: Temperament): Layout {
  const c = CENTERS[temperament] ?? CENTERS.engineered;
  // namespaced seed so layout & object rolls don't correlate by accident
  const r = rngFrom(`${seed}::layout`);
  return {
    chrome: weighted(r(), c.chrome),
    hero: weighted(r(), c.hero),
    container: weighted(r(), c.container),
    density: weighted(r(), c.density),
    borders: weighted(r(), c.borders),
    stage: weighted(r(), c.stage),
    upper: r() < c.upper,
    accentBlock: r() < c.accentBlock,
  };
}

/** Temperament → page mode bias (overridden by explicit light/dark in the vibe).
 * engineered/cinematic read as dark "instrument/film"; raw is light "print";
 * serene/playful are light "premium/soft". */
export function modeForTemperament(t: Temperament): "light" | "dark" {
  return t === "engineered" || t === "cinematic" ? "dark" : "light";
}
