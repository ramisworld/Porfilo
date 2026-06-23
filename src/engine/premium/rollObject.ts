import type { Rng } from "./prng";

/**
 * rollObject — turns (temperament + biases + seeded RNG) into a concrete,
 * bounded, *tasteful* object recipe. The temperament sets the CENTER of every
 * knob; the RNG varies within a narrow band around it; the biases nudge a few.
 * Every numeric knob is clamped to a safe range, so no roll is ever ugly.
 */

export type Form = "monolith" | "cluster" | "shards" | "lattice" | "orbital";
export type Primitive = "cube" | "prism" | "octa" | "icosa" | "tetra" | "sphere";
export type Temperament = "engineered" | "raw" | "serene" | "cinematic" | "playful";

export interface MorphParams {
  form: Form;
  primitive: Primitive;
  count: number; // pieces
  sizeMix: number; // 0..1 how varied the piece sizes are
  asymmetry: number; // 0..1 off-centre irregularity
  explode: number; // 0..1 max destructure at full scroll
  explodeCurve: number; // ease exponent (1=linear, >1 snappy)
  spin: number; // 0..1 per-piece rotation while exploded
  noiseAmp: number; // 0..1 idle "breathing" wobble
  noiseSpeed: number; // 0..1
  wire: number; // 0..1 wireframe-edge presence
  fresnel: number; // 0..1 rim light
  glow: number; // 0..1 core brightness
  drift: number; // 0..1 idle rotation/float
  pointer: number; // 0..1 mouse parallax
}

interface Center {
  forms: Form[];
  primitives: Primitive[];
  explode: number;
  spin: number;
  noiseAmp: number;
  noiseSpeed: number;
  wire: number;
  fresnel: number;
  glow: number;
  drift: number;
  sizeMix: number;
  asymmetry: number;
}

// Per-temperament centers. Each is a coherent personality; rolls vary *around* it.
const CENTERS: Record<Temperament, Center> = {
  engineered: {
    forms: ["lattice", "monolith", "shards"],
    primitives: ["cube", "octa", "icosa"],
    explode: 0.5, spin: 0.35, noiseAmp: 0.18, noiseSpeed: 0.3,
    wire: 0.75, fresnel: 0.4, glow: 0.5, drift: 0.25, sizeMix: 0.3, asymmetry: 0.25,
  },
  raw: {
    forms: ["shards", "cluster"],
    primitives: ["cube", "prism", "tetra"],
    explode: 0.82, spin: 0.7, noiseAmp: 0.12, noiseSpeed: 0.25,
    wire: 0.5, fresnel: 0.3, glow: 0.6, drift: 0.18, sizeMix: 0.55, asymmetry: 0.5,
  },
  serene: {
    forms: ["monolith", "orbital"],
    primitives: ["sphere", "icosa"],
    explode: 0.28, spin: 0.2, noiseAmp: 0.42, noiseSpeed: 0.45,
    wire: 0.25, fresnel: 0.6, glow: 0.78, drift: 0.4, sizeMix: 0.25, asymmetry: 0.2,
  },
  cinematic: {
    forms: ["monolith", "cluster"],
    primitives: ["icosa", "octa", "prism"],
    explode: 0.45, spin: 0.3, noiseAmp: 0.32, noiseSpeed: 0.22,
    wire: 0.35, fresnel: 0.7, glow: 0.7, drift: 0.2, sizeMix: 0.4, asymmetry: 0.35,
  },
  playful: {
    forms: ["cluster", "orbital"],
    primitives: ["cube", "prism", "tetra", "octa"],
    explode: 0.5, spin: 0.78, noiseAmp: 0.22, noiseSpeed: 0.6,
    wire: 0.4, fresnel: 0.45, glow: 0.82, drift: 0.7, sizeMix: 0.7, asymmetry: 0.45,
  },
};

// Bounded piece-count per form (never boring, never mush).
const COUNT: Record<Form, [number, number]> = {
  monolith: [1, 1],
  cluster: [5, 13],
  shards: [7, 18],
  lattice: [8, 26],
  orbital: [5, 11],
};

export interface RollBias {
  objectComplexity: number; // → count, wire, asymmetry
  motionEnergy: number; // → spin, drift, noiseSpeed
  density: number; // → count
}

export function rollObject(
  rng: Rng,
  temperament: Temperament,
  bias: RollBias,
): MorphParams {
  const c = CENTERS[temperament] ?? CENTERS.engineered;
  const form = rng.pick(c.forms);
  const primitive = rng.pick(c.primitives);

  // count: temperament's form band, nudged by complexity+density bias.
  const [clo, chi] = COUNT[form];
  const compNudge = (bias.objectComplexity - 0.5 + (bias.density - 0.5)) * (chi - clo) * 0.5;
  const count = Math.max(clo, Math.min(chi, Math.round(rng.range(clo, chi) + compNudge)));

  // SPREAD is deliberately conservative for v1 — coherent first, wild later.
  const S = 0.12;
  return {
    form,
    primitive,
    count,
    sizeMix: rng.around(c.sizeMix, S),
    asymmetry: rng.around(c.asymmetry + (bias.objectComplexity - 0.5) * 0.2, S),
    explode: rng.around(c.explode, S, 0.18, 0.95),
    explodeCurve: rng.range(1.4, 2.6),
    spin: rng.around(c.spin + (bias.motionEnergy - 0.5) * 0.3, S),
    noiseAmp: rng.around(c.noiseAmp, S),
    noiseSpeed: rng.around(c.noiseSpeed + (bias.motionEnergy - 0.5) * 0.3, S),
    wire: rng.around(c.wire + (bias.objectComplexity - 0.5) * 0.2, S),
    fresnel: rng.around(c.fresnel, S),
    glow: rng.around(c.glow, S, 0.3, 1),
    drift: rng.around(c.drift + (bias.motionEnergy - 0.5) * 0.3, S),
    pointer: rng.around(0.5, 0.15),
  };
}
