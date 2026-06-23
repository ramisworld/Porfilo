/**
 * Deterministic PRNG for the generative engine. The same seed string always
 * produces the same stream → the same portfolio reproduces exactly, while any
 * different seed (username·vibe) rolls a genuinely different result.
 */

// xmur3 string hash → 32-bit seed.
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

// mulberry32 PRNG — fast, good distribution, returns [0,1).
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** Next float in [0,1). */
  next: () => number;
  /** Float in [min,max). */
  range: (min: number, max: number) => number;
  /** Integer in [min,max] inclusive. */
  int: (min: number, max: number) => number;
  /** Random element of an array. */
  pick: <T>(arr: readonly T[]) => T;
  /** True with probability p. */
  chance: (p: number) => boolean;
  /** Center ± spread, clamped to [lo,hi]. The workhorse for "vary around a temperament center". */
  around: (center: number, spread: number, lo?: number, hi?: number) => number;
}

export function makeRng(seed: string): Rng {
  const next = mulberry32(xmur3(seed)());
  const range = (min: number, max: number) => min + next() * (max - min);
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  return {
    next,
    range,
    int: (min, max) => Math.floor(range(min, max + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)]!,
    chance: (p) => next() < p,
    around: (center, spread, lo = 0, hi = 1) =>
      clamp(center + (next() * 2 - 1) * spread, lo, hi),
  };
}
