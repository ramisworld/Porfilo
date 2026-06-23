import { z } from "zod";

/**
 * DesignSpec — the small JSON the art-director emits and the Engine consumes.
 * This file is the SINGLE SOURCE OF TRUTH: the enum arrays below must match the
 * registries in `src/engine/runtime/*.js`, the mock in `src/server/llm/design.ts`,
 * and (later) the live art-director prompt.
 *
 * The whole point: the LLM only picks from these registries + a free palette +
 * an optional CSS flourish — a tiny output — while the Engine owns all the
 * interactive machinery. Variety = archetype × background × fonts × motion ×
 * (continuous) palette × skins × gimmick × signatureCss.
 */

export const ARCHETYPES = [
  "terminal", // hacker / command-line
  "editorial", // magazine / serif / whitespace
  "brutalist", // raw, high-contrast, bordered blocks
  "minimal", // Linear/Vercel clean
  "bento", // grid of tiles
] as const;

export const EXPERIENCE_PACKS = [
  "classic", // backwards-compatible v2 layout
  "instrument", // engineered Swiss grid + contained 3D viewport (flagship)
  "brutalist", // hard-edged print/editorial bands + contained exploding cube
  "aurora", // light/soft premium, rounded frosted cards + contained glowing orb
  "generative", // parameterized — chrome/hero/container/density rolled from seed
  "terminalNexus", // cyber terminal, telemetry rail, command modules
  "directorCut", // cinematic acts, letterbox, fullbleed plasma object
] as const;

export const BACKGROUNDS = [
  "matrix",
  "starfield",
  "dotgrid",
  "aurora",
  "particles",
  "waves",
  "none",
] as const;

export const FONTS = [
  "mono",
  "grotesk",
  "serif",
  "geometric",
  "condensed",
  "rounded",
] as const;

export const GIMMICKS = [
  "typewriter",
  "glitch",
  "tilt3d",
  "magnetic",
  "cursorTrail",
  "none",
] as const;

export const MOTIONS = ["none", "subtle", "energetic", "cinematic", "snappy"] as const;

export const SECTIONS = [
  "hero",
  "stats",
  "languages",
  "projects",
  "about",
  "contact",
] as const;

export const RADII = ["sharp", "soft", "round"] as const;
export const SCALES = ["compact", "normal", "large"] as const;

// Generative LAYOUT axes — rolled from seed+temperament so the whole page
// composition (not just the object) varies per run. See the generative engine doc.
export const CHROMES = ["topbar", "pill", "rail"] as const; // nav style
export const HEROES = ["split", "centered", "mirror"] as const; // hero composition
export const CONTAINERS = ["band", "card", "panel"] as const; // section container
export const DENSITIES = ["tight", "normal", "airy"] as const; // spacing rhythm
export const BORDERS = ["hairline", "heavy", "none"] as const;
export const STAGES = ["fullbleed", "viewport", "orb", "bare"] as const; // how the object sits

export const PROJECT_CARD_SKINS = [
  "terminalWindow",
  "glass",
  "outline",
  "ticket",
  "codeblock",
  "plain",
] as const;
export const STAT_CARD_SKINS = ["glass", "outline", "plain", "terminal"] as const;
export const LANGBAR_SKINS = ["bars", "chips", "dots", "ascii"] as const;
export const NAV_SKINS = ["bar", "pill", "minimal"] as const;
export const BUTTON_SKINS = ["solid", "outline", "ghost", "terminal"] as const;

// --- Premium (Engine v2) registries: WebGL scene, postprocessing, cursor, boot.
export const WEBGL_SCENES = [
  "starfield",
  "glassOrb",
  "energyCube",
  "energySphere",
  "morphObject", // procedural object — rolled from seed+temperament (generative engine)
  "prismField",
  "voidRings",
  "off",
] as const;

// Generative engine: a "temperament" centers every rolled knob (object form,
// motion, layout) so a roll is coherent; the seed + biases add per-run variation
// within bounds. See docs/SPECKIT-generative-engine.md.
export const TEMPERAMENTS = [
  "engineered", // crisp, technical, measured (≈ instrument)
  "raw", // shattered, heavy, snappy (≈ brutalist)
  "serene", // calm, floaty, soft (≈ aurora)
  "cinematic", // dramatic, slow, monolithic
  "playful", // lively, clustered, bouncy
] as const;
export const CURSORS = ["square", "circle", "dot", "none"] as const;
export const BOOTS = ["system", "off"] as const;

const hex = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a hex color");

export const designSpecSchema = z.object({
  archetype: z.enum(ARCHETYPES),
  experience: z.enum(EXPERIENCE_PACKS).default("classic"),
  theme: z.object({
    mode: z.enum(["light", "dark"]),
    bg: hex,
    surface: hex,
    fg: hex,
    muted: hex,
    border: hex,
    accent: hex,
    accent2: hex,
    glow: hex,
    radius: z.enum(RADII),
    glass: z.number().min(0).max(1),
  }),
  typography: z.object({
    display: z.enum(FONTS),
    body: z.enum(FONTS),
    scale: z.enum(SCALES),
  }),
  background: z.object({
    mode: z.enum(BACKGROUNDS),
    intensity: z.number().min(0).max(1),
    speed: z.number().min(0).max(1),
    parallax: z.number().min(0).max(1),
  }),
  // Premium WebGL background (Engine v2). `background` above is the 2D fallback.
  webgl: z.object({
    scene: z.enum(WEBGL_SCENES),
    intensity: z.number().min(0).max(1),
  }),
  postfx: z.object({
    bloom: z.number().min(0).max(1),
    chromatic: z.number().min(0).max(1),
    scanlines: z.boolean(),
  }),
  cursor: z.enum(CURSORS),
  boot: z.enum(BOOTS),
  motion: z.enum(MOTIONS),
  heroGimmick: z.object({
    type: z.enum(GIMMICKS),
  }),
  sections: z
    .array(z.object({ type: z.enum(SECTIONS), title: z.string().optional() }))
    .min(1),
  skins: z.object({
    projectCard: z.enum(PROJECT_CARD_SKINS),
    statCard: z.enum(STAT_CARD_SKINS),
    langBar: z.enum(LANGBAR_SKINS),
    nav: z.enum(NAV_SKINS),
    button: z.enum(BUTTON_SKINS),
  }),
  // Generative engine knobs. The art-director emits only these few values; the
  // engine rolls the full object/layout recipe deterministically from `seed`,
  // centered on `temperament`, nudged by the biases. Kept tiny on purpose.
  generative: z
    .object({
      seed: z.string().default("porthub"),
      temperament: z.enum(TEMPERAMENTS).default("engineered"),
      objectComplexity: z.number().min(0).max(1).default(0.5),
      motionEnergy: z.number().min(0).max(1).default(0.5),
      density: z.number().min(0).max(1).default(0.5),
    })
    .default({
      seed: "porthub",
      temperament: "engineered",
      objectComplexity: 0.5,
      motionEnergy: 0.5,
      density: 0.5,
    }),
  // Generative LAYOUT recipe — rolled (server-side) from the seed+temperament so
  // the page composition rolls within ranges. Consumed by the `generative`
  // experience renderer. Optional/defaulted so legacy specs stay valid.
  layout: z
    .object({
      chrome: z.enum(CHROMES).default("topbar"),
      hero: z.enum(HEROES).default("split"),
      container: z.enum(CONTAINERS).default("panel"),
      density: z.enum(DENSITIES).default("normal"),
      borders: z.enum(BORDERS).default("hairline"),
      stage: z.enum(STAGES).default("viewport"),
      upper: z.boolean().default(true), // uppercase headings
      accentBlock: z.boolean().default(false), // role shown in an accent block
    })
    .default({
      chrome: "topbar", hero: "split", container: "panel", density: "normal",
      borders: "hairline", stage: "viewport", upper: true, accentBlock: false,
    }),
  // LEXICON — the world's vocabulary. The generative pack routes every label
  // through this so the page reads bespoke (a "raw" world says THE RECORD /
  // TRANSMIT, an engineered one INDEX / SIGNAL). Mock fills it from temperament;
  // the live art-director will write these strings per invented metaphor.
  lexicon: z
    .object({
      nav: z.array(z.string().max(24)).length(4).default(["Home", "About", "Work", "Contact"]),
      about: z.string().max(40).default("About"),
      work: z.string().max(40).default("Selected work"),
      contact: z.string().max(40).default("Contact"),
      cta: z.string().max(40).default("Let's build"),
      worksIn: z.string().max(24).default("Works in"),
      kicker: z.string().max(40).default("Portfolio"),
    })
    .default({
      nav: ["Home", "About", "Work", "Contact"],
      about: "About", work: "Selected work", contact: "Contact",
      cta: "Let's build", worksIn: "Works in", kicker: "Portfolio",
    }),
  // Bespoke escape hatch — CSS only, bounded. Safe inside the sandboxed iframe.
  signatureCss: z.string().max(1200).optional(),
});

export type DesignSpec = z.infer<typeof designSpecSchema>;

/** A guaranteed-valid spec used as the fallback when art-direction fails. */
export const DEFAULT_SPEC: DesignSpec = {
  archetype: "minimal",
  experience: "generative",
  theme: {
    mode: "dark",
    bg: "#0a0a0f",
    surface: "#14141c",
    fg: "#e8e8ef",
    muted: "#8a8aa0",
    border: "#23232f",
    accent: "#6c7bff",
    accent2: "#9a6cff",
    glow: "#6c7bff",
    radius: "soft",
    glass: 0.4,
  },
  typography: { display: "grotesk", body: "grotesk", scale: "normal" },
  background: { mode: "dotgrid", intensity: 0.5, speed: 0.4, parallax: 0.4 },
  webgl: { scene: "starfield", intensity: 0.5 },
  postfx: { bloom: 0.5, chromatic: 0.3, scanlines: false },
  cursor: "circle",
  boot: "system",
  motion: "subtle",
  heroGimmick: { type: "none" },
  sections: [
    { type: "hero" },
    { type: "stats" },
    { type: "languages" },
    { type: "projects" },
  ],
  skins: {
    projectCard: "glass",
    statCard: "glass",
    langBar: "bars",
    nav: "bar",
    button: "solid",
  },
  generative: {
    seed: "porthub",
    temperament: "engineered",
    objectComplexity: 0.5,
    motionEnergy: 0.5,
    density: 0.5,
  },
  layout: {
    chrome: "topbar", hero: "split", container: "panel", density: "normal",
    borders: "hairline", stage: "viewport", upper: true, accentBlock: false,
  },
  lexicon: {
    nav: ["Home", "About", "Work", "Contact"],
    about: "About", work: "Selected work", contact: "Contact",
    cta: "Let's build", worksIn: "Works in", kicker: "Portfolio",
  },
};
