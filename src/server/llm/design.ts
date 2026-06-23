import "server-only";
import { z } from "zod";
import {
  DEFAULT_SPEC,
  TEMPERAMENTS,
  designSpecSchema,
  type DesignSpec,
} from "~/engine/spec";
import type { ProfileData } from "~/server/profile/model";
import { anthropic, isMock, MODELS, textOf } from "./anthropic";
import { buildUsageRecord, logUsage, type UsageRecord } from "./cost";
import { rollLayout, modeForTemperament } from "./roll";

/**
 * Layer 2 — Art-director. Emits a tiny `DesignSpec` (palette + which archetype /
 * background / gimmick / skins). The hand-built Engine (src/engine/) turns that
 * into the interactive page. This keeps output tiny (cheap) AND the interactivity
 * reliable (the engine owns it).
 *
 * MOCK: deterministic vibe-keyword → spec, producing visibly different designs.
 * LIVE (next chunk): one small LLM call → DesignSpec JSON.
 */

type Archetype = DesignSpec["archetype"];
type Experience = DesignSpec["experience"];

const has = (v: string, ...words: string[]) => words.some((w) => v.includes(w));

function pickArchetype(v: string): Archetype {
  if (has(v, "terminal", "hacker", "cyber", "matrix", "console", "command", "code", "dev")) return "terminal";
  if (has(v, "editorial", "magazine", "serif", "warm", "elegant", "luxury", "classic", "journal")) return "editorial";
  if (has(v, "brutalist", "brutal", "raw", "punk", "grunge", "bold", "industrial")) return "brutalist";
  if (has(v, "playful", "fun", "colorful", "cute", "vibrant", "bento", "friendly", "pop")) return "bento";
  return "minimal";
}

function pickExperience(v: string): Experience {
  // Terminal world for hacker/cyber vibes; everything else goes to the GENERATIVE
  // pack — chrome/hero/container/density/object all rolled from seed+temperament
  // so every run is unique. (instrument/brutalist/aurora remain in code as the
  // anchor references the generative ranges were derived from; the old
  // full-screen-wash packs were removed.)
  if (has(v, "terminal", "hacker", "cyber", "matrix", "console", "crt", "hacking", "command line"))
    return "terminalNexus";
  if (has(v, "cinematic", "film", "movie", "dramatic", "epic", "noir", "trailer", "title sequence", "directed"))
    return "directorCut";
  return "generative";
}

type Temperament = DesignSpec["generative"]["temperament"];

// The temperament centers every rolled knob (object form, motion). Vibe keywords
// choose it; otherwise it falls back to the anchor for the chosen experience pack.
function pickTemperament(v: string, experience: Experience): Temperament {
  if (has(v, "brutal", "raw", "punk", "industrial", "harsh", "aggressive", "grunge", "mono", "print"))
    return "raw";
  if (has(v, "calm", "soft", "serene", "zen", "peaceful", "premium", "elegant", "airy", "gentle", "glass", "luxury", "minimal", "clean"))
    return "serene";
  if (has(v, "cinematic", "dramatic", "film", "noir", "epic", "moody", "story", "movie"))
    return "cinematic";
  if (has(v, "playful", "fun", "vibrant", "colorful", "bouncy", "friendly", "pop", "lively", "energetic"))
    return "playful";
  if (has(v, "engineer", "technical", "precise", "swiss", "grid", "system", "instrument", "blueprint"))
    return "engineered";
  // fall back to the anchor temperament of the chosen pack
  const anchor: Partial<Record<Experience, Temperament>> = {
    instrument: "engineered",
    brutalist: "raw",
    aurora: "serene",
    terminalNexus: "engineered",
  };
  return anchor[experience] ?? "engineered";
}

// 0..1 bias from "more/less" keyword pairs, default 0.5 (neutral).
function biasFrom(v: string, more: string[], less: string[]): number {
  if (has(v, ...more)) return 0.78;
  if (has(v, ...less)) return 0.24;
  return 0.5;
}

// vibe color word → accent hex
const COLORS: [RegExp, string][] = [
  [/neon green|lime green|matrix green|hacker green/, "#39ff14"],
  [/\bgreen\b|emerald/, "#22c55e"],
  [/\bcyan\b|aqua/, "#22d3ee"],
  [/\bteal\b/, "#14b8a6"],
  [/\bblue\b|sapphire|azure/, "#3b82f6"],
  [/\bindigo\b/, "#6366f1"],
  [/purple|violet|lilac/, "#8b5cf6"],
  [/pink|magenta|rose/, "#ec4899"],
  [/\bred\b|crimson|scarlet/, "#ef4444"],
  [/orange|tangerine/, "#f97316"],
  [/amber|gold|golden|yellow/, "#f59e0b"],
  [/\blime\b/, "#84cc16"],
];

function pickAccent(v: string, arch: Archetype): string {
  for (const [re, hex] of COLORS) if (re.test(v)) return hex;
  return { terminal: "#39ff14", editorial: "#c0613a", brutalist: "#ff3b00", bento: "#ff5fa2", minimal: "#6c7bff" }[arch];
}

const SECONDARY: Record<string, string> = {
  "#39ff14": "#00e5ff", "#22c55e": "#0ea5e9", "#22d3ee": "#6366f1", "#14b8a6": "#6366f1",
  "#3b82f6": "#a855f7", "#6366f1": "#8b5cf6", "#8b5cf6": "#6366f1", "#ec4899": "#8b5cf6",
  "#ef4444": "#f59e0b", "#f97316": "#ec4899", "#f59e0b": "#ef4444", "#84cc16": "#22d3ee",
  "#c0613a": "#2d6a5f", "#ff3b00": "#0040ff", "#ff5fa2": "#6c7bff", "#6c7bff": "#9a6cff",
};

function pickMode(v: string, arch: Archetype): "light" | "dark" {
  if (has(v, "light", "paper", "white", "bright", "day", "cream")) return "light";
  if (has(v, "dark", "night", "black", "noir")) return "dark";
  return arch === "editorial" || arch === "brutalist" ? "light" : "dark";
}

function palette(mode: "light" | "dark", accent: string) {
  const accent2 = SECONDARY[accent] ?? "#6c7bff";
  return mode === "dark"
    ? { mode, bg: "#0a0a0f", surface: "#14141c", fg: "#e9e9f2", muted: "#8a8aa0", border: "#23232f", accent, accent2, glow: accent }
    : { mode, bg: "#f6f5f1", surface: "#ffffff", fg: "#16140f", muted: "#6a675f", border: "#e4dfd5", accent, accent2, glow: accent };
}

function pickBackground(v: string, arch: Archetype): DesignSpec["background"]["mode"] {
  if (has(v, "matrix", "rain")) return "matrix";
  if (has(v, "star", "space", "galaxy", "cosmos", "night sky")) return "starfield";
  if (has(v, "grid", "dots")) return "dotgrid";
  if (has(v, "aurora", "gradient", "mesh", "glow")) return "aurora";
  if (has(v, "particle", "constellation", "network")) return "particles";
  if (has(v, "wave", "ocean", "fluid", "liquid")) return "waves";
  return { terminal: "matrix", editorial: "aurora", brutalist: "dotgrid", bento: "particles", minimal: "dotgrid" }[arch] as DesignSpec["background"]["mode"];
}

function pickGimmick(v: string, arch: Archetype): DesignSpec["heroGimmick"]["type"] {
  if (has(v, "glitch")) return "glitch";
  if (has(v, "tilt", "3d")) return "tilt3d";
  if (has(v, "magnetic", "magnet")) return "magnetic";
  if (has(v, "trail", "cursor")) return "cursorTrail";
  if (has(v, "typewriter", "typing")) return "typewriter";
  return { terminal: "typewriter", editorial: "none", brutalist: "glitch", bento: "tilt3d", minimal: "magnetic" }[arch] as DesignSpec["heroGimmick"]["type"];
}

function fontsFor(arch: Archetype): DesignSpec["typography"] {
  const map: Record<Archetype, DesignSpec["typography"]> = {
    terminal: { display: "mono", body: "mono", scale: "normal" },
    editorial: { display: "serif", body: "serif", scale: "large" },
    brutalist: { display: "condensed", body: "grotesk", scale: "normal" },
    bento: { display: "rounded", body: "rounded", scale: "normal" },
    minimal: { display: "grotesk", body: "grotesk", scale: "normal" },
  };
  return map[arch];
}

function skinsFor(arch: Archetype): DesignSpec["skins"] {
  const map: Record<Archetype, DesignSpec["skins"]> = {
    terminal: { projectCard: "terminalWindow", statCard: "terminal", langBar: "ascii", nav: "minimal", button: "terminal" },
    editorial: { projectCard: "outline", statCard: "plain", langBar: "bars", nav: "minimal", button: "outline" },
    brutalist: { projectCard: "outline", statCard: "outline", langBar: "dots", nav: "bar", button: "outline" },
    bento: { projectCard: "glass", statCard: "glass", langBar: "chips", nav: "pill", button: "solid" },
    minimal: { projectCard: "glass", statCard: "plain", langBar: "bars", nav: "bar", button: "solid" },
  };
  return map[arch];
}

function webglFor(
  v: string,
  arch: Archetype,
  experience: Experience,
): DesignSpec["webgl"] {
  // Contained packs get the GENERATIVE object — rolled per seed+temperament so
  // every run is unique (energyCube/energySphere are now just two points in that
  // space). terminalNexus keeps starfield (it's a background, not a stage object).
  if (experience === "generative" || experience === "instrument" || experience === "brutalist" || experience === "aurora") {
    return { scene: "morphObject", intensity: 0.6 };
  }
  // Bespoke worlds pin their signature fullbleed object (keywords don't override).
  if (experience === "terminalNexus") return { scene: "energyCube", intensity: 0.9 };
  if (experience === "directorCut") return { scene: "energySphere", intensity: 1 };
  // NOTE: only starfield, glassOrb, energyCube, energySphere are implemented; the
  // others land in later deliverables. Keep routing within the implemented set so
  // no portfolio shows an empty (invisible-fallback) background.
  let scene: DesignSpec["webgl"]["scene"];
  if (has(v, "cube", "box", "block", "shatter", "explode", "explosion", "reactor"))
    scene = "energyCube";
  else if (
    has(v, "sphere", "sun", "orb", "ball", "energy", "plasma", "molten", "core",
      "liquid", "water", "watery", "fluid", "glass", "crystal", "bubble", "wave")
  )
    scene = "energySphere";
  else if (has(v, "star", "space", "galaxy", "cosmos", "hyper", "warp", "speed", "matrix", "void", "particle"))
    scene = "starfield";
  else
    scene = {
      classic: { terminal: "starfield", editorial: "energySphere", brutalist: "off", bento: "starfield", minimal: "starfield" }[arch],
      instrument: "energySphere",
      brutalist: "energyCube",
      aurora: "energySphere",
      terminalNexus: "energyCube",
      directorCut: "energySphere",
    }[experience] as DesignSpec["webgl"]["scene"];
  const intensity = {
    instrument: 0.5,
    brutalist: 0.7,
    aurora: 0.6,
    terminalNexus: 0.9,
    directorCut: 1,
    classic: { terminal: 0.8, editorial: 0.4, brutalist: 0.3, bento: 0.7, minimal: 0.5 }[arch],
  }[experience];
  return { scene, intensity };
}

function postfxFor(v: string, arch: Archetype): DesignSpec["postfx"] {
  const bloom = { terminal: 0.7, editorial: 0.3, brutalist: 0.2, bento: 0.85, minimal: 0.45 }[arch];
  let chromatic = { terminal: 0.6, editorial: 0.15, brutalist: 0.5, bento: 0.4, minimal: 0.25 }[arch];
  let scanlines = arch === "terminal";
  if (has(v, "cyber", "hacker", "glitch", "retro", "crt", "vhs", "matrix")) {
    scanlines = true;
    chromatic = Math.max(chromatic, 0.6);
  }
  if (has(v, "clean", "minimal", "calm", "subtle", "elegant")) scanlines = false;
  return { bloom, chromatic, scanlines };
}

function cursorFor(v: string, arch: Archetype): DesignSpec["cursor"] {
  if (has(v, "no cursor", "default cursor")) return "none";
  if (has(v, "square")) return "square";
  if (has(v, "circle", "ring")) return "circle";
  if (has(v, "dot")) return "dot";
  return { terminal: "square", editorial: "circle", brutalist: "square", bento: "circle", minimal: "dot" }[arch] as DesignSpec["cursor"];
}

function bootFor(v: string, arch: Archetype): DesignSpec["boot"] {
  if (has(v, "no boot", "instant", "fast load")) return "off";
  if (has(v, "boot", "loading", "hacker", "cyber", "matrix", "terminal", "system")) return "system";
  return arch === "editorial" || arch === "minimal" ? "off" : "system";
}

function radiusGlass(arch: Archetype): { radius: DesignSpec["theme"]["radius"]; glass: number } {
  return {
    terminal: { radius: "sharp" as const, glass: 0.25 },
    editorial: { radius: "soft" as const, glass: 0.1 },
    brutalist: { radius: "sharp" as const, glass: 0 },
    bento: { radius: "round" as const, glass: 0.55 },
    minimal: { radius: "soft" as const, glass: 0.2 },
  }[arch];
}

// The compact "art direction" — the creative choices only. The MOCK derives it
// from vibe keywords; the LIVE LLM emits it directly. `assembleSpec` expands it
// (with deterministic seeded rolls) into the full DesignSpec. One expansion path,
// two sources — so the live output is exactly as good as the mock.
interface Direction {
  archetype: Archetype;
  experience: Experience;
  temperament: Temperament;
  accent: string;
  accent2?: string;
  mode: "light" | "dark";
  objectComplexity: number;
  motionEnergy: number;
  density: number;
}

// Live picks the temperament; archetype (which drives fonts/skins/gimmick) follows
// from it so the two never disagree.
const ARCH_FOR_TEMPERAMENT: Record<Temperament, Archetype> = {
  engineered: "minimal",
  raw: "brutalist",
  serene: "editorial",
  cinematic: "editorial",
  playful: "bento",
};

// Per-temperament vocabulary for the generative pack. Title-case here; the engine
// uppercases where `layout.upper` is set. (Live: the model writes these per metaphor.)
const LEXICONS: Record<Temperament, DesignSpec["lexicon"]> = {
  engineered: { nav: ["Index", "System", "Builds", "Signal"], about: "System", work: "Builds", contact: "Signal", cta: "Open channel", worksIn: "Stack", kicker: "Portfolio" },
  raw: { nav: ["Profile", "Record", "Work", "Transmit"], about: "The record", work: "Selected work", contact: "Transmit", cta: "Let's build", worksIn: "Works in", kicker: "Portfolio" },
  serene: { nav: ["Home", "About", "Work", "Contact"], about: "About", work: "Selected work", contact: "Contact", cta: "Let's talk", worksIn: "Works in", kicker: "Portfolio" },
  cinematic: { nav: ["Prologue", "Arc", "Reel", "Credits"], about: "Character arc", work: "The reel", contact: "End of line", cta: "Roll credits", worksIn: "Filmed in", kicker: "A film by" },
  playful: { nav: ["Hi", "Story", "Stuff", "Say hi"], about: "The story", work: "Cool stuff", contact: "Say hi", cta: "Let's play", worksIn: "Plays with", kicker: "Portfolio" },
};

function assembleSpec(data: ProfileData, vibe: string, dir: Direction): DesignSpec {
  const v = vibe.toLowerCase();
  const arch = dir.archetype;
  const experience = dir.experience;
  const generative = {
    // seed = stable per (user, vibe): same input reproduces, different rolls anew
    seed: `${data.identity.name}·${vibe}`.toLowerCase().trim(),
    temperament: dir.temperament,
    objectComplexity: dir.objectComplexity,
    motionEnergy: dir.motionEnergy,
    density: dir.density,
  };
  const { radius, glass } = radiusGlass(arch);
  const layout = rollLayout(generative.seed, dir.temperament);
  // A fullbleed additive-glow object only reads on a DARK page — force it, so the
  // light-mode palettes don't wash the object out.
  const effMode = layout.stage === "fullbleed" ? "dark" : dir.mode;
  const theme = { ...palette(effMode, dir.accent), radius, glass };
  if (dir.accent2) {
    theme.accent2 = dir.accent2;
    theme.glow = dir.accent;
  }

  const spec: DesignSpec = {
    archetype: arch,
    experience,
    theme,
    typography: fontsFor(arch),
    background: { mode: pickBackground(v, arch), intensity: 0.6, speed: 0.5, parallax: 0.6 },
    webgl: webglFor(v, arch, experience),
    postfx: postfxFor(v, arch),
    cursor: cursorFor(v, arch),
    boot: bootFor(v, arch),
    motion: { terminal: "energetic", editorial: "cinematic", brutalist: "snappy", bento: "energetic", minimal: "subtle" }[arch] as DesignSpec["motion"],
    heroGimmick: { type: pickGimmick(v, arch) },
    sections: [{ type: "hero" }, { type: "stats" }, { type: "languages" }, { type: "projects" }, { type: "contact" }],
    skins: skinsFor(arch),
    generative,
    layout,
    lexicon: LEXICONS[dir.temperament] ?? LEXICONS.engineered,
  };
  // Guarantee validity; fall back to default if anything is off.
  const parsed = designSpecSchema.safeParse(spec);
  return parsed.success ? parsed.data : DEFAULT_SPEC;
}

function mockSpec(data: ProfileData, vibe: string): DesignSpec {
  const v = vibe.toLowerCase();
  const arch = pickArchetype(v);
  const experience = pickExperience(v);
  const temperament = pickTemperament(v, experience);
  // Mode: explicit vibe words win; else the temperament decides (generative pack)
  // or the dark-pack rule (terminal etc.).
  const DARK_PACKS = new Set(["instrument", "terminalNexus", "directorCut"]);
  const askedLight = has(v, "light", "paper", "white", "bright", "day", "cream");
  const askedDark = has(v, "dark", "night", "black", "noir", "midnight");
  const mode: "light" | "dark" = askedLight
    ? "light"
    : askedDark
      ? "dark"
      : experience === "generative"
        ? modeForTemperament(temperament)
        : DARK_PACKS.has(experience)
          ? "dark"
          : pickMode(v, arch);
  return assembleSpec(data, vibe, {
    archetype: arch,
    experience,
    temperament,
    accent: pickAccent(v, arch),
    mode,
    objectComplexity: biasFrom(v, ["complex", "intricate", "detailed", "dense", "busy", "many"], ["simple", "clean", "minimal", "sparse"]),
    motionEnergy: biasFrom(v, ["energetic", "lively", "dynamic", "fast", "animated", "bouncy", "kinetic"], ["calm", "still", "subtle", "slow", "static", "serene"]),
    density: biasFrom(v, ["dense", "packed", "rich", "busy", "maximal"], ["airy", "spacious", "minimal", "sparse", "clean"]),
  });
}

// ---- live art-director: the LLM emits a TINY "direction"; the engine expands it ----

const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "hex color");

// Exactly what the model must return — small, so the call stays ~cents.
const directionSchema = z.object({
  temperament: z.enum(TEMPERAMENTS),
  accent: hexColor,
  accent2: hexColor.optional(),
  mode: z.enum(["light", "dark"]),
  experience: z.enum(["generative", "terminalNexus"]).default("generative"),
  objectComplexity: z.number().min(0).max(1).default(0.5),
  motionEnergy: z.number().min(0).max(1).default(0.5),
  density: z.number().min(0).max(1).default(0.5),
});

const ART_SYSTEM = `You are the art-director for a developer-portfolio generator. Given a USER VIBE, output ONLY a tiny JSON "direction" object — no prose, no code fences, no markdown. The engine expands it into a full interactive design.

Fields:
- "temperament": one of ${TEMPERAMENTS.map((t) => `"${t}"`).join(", ")} — the personality. engineered = crisp/technical/dark; raw = bold/print/high-contrast; serene = soft/light/premium/calm; cinematic = dramatic/dark/monolithic; playful = light/colorful/lively.
- "accent": a striking, accessible hex color that fits the vibe (e.g. "#6366f1").
- "accent2" (optional): a harmonious secondary hex; omit to auto-derive.
- "mode": "light" or "dark" — the page background tone.
- "experience": "generative" for almost everything; "terminalNexus" ONLY for explicit hacker/terminal/matrix/CRT vibes.
- "objectComplexity", "motionEnergy", "density": numbers 0..1 nudging 3D-object detail, motion liveliness, and layout density.

Choose decisively to match the vibe. Example:
{"temperament":"serene","accent":"#6366f1","mode":"light","experience":"generative","objectComplexity":0.3,"motionEnergy":0.2,"density":0.4}`;

function stripFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

async function liveDesignSpec(
  data: ProfileData,
  vibe: string,
): Promise<{ spec: DesignSpec; usage: UsageRecord | null }> {
  // $0 test seam: STUB_DIRECTION lets us exercise the live parse→expand→render
  // pipeline with a hand-written direction JSON and NO API call.
  const stub = process.env.STUB_DIRECTION;
  let rawText: string;
  let usage: UsageRecord | null = null;
  if (stub) {
    rawText = stub;
  } else {
    const msg = await anthropic().messages.create({
      model: MODELS.design,
      max_tokens: 400,
      system: ART_SYSTEM,
      messages: [{ role: "user", content: `VIBE: ${vibe}\nNAME: ${data.identity.name}\nROLE: ${data.identity.role}` }],
    });
    usage = buildUsageRecord("design (art)", MODELS.design, msg.usage);
    logUsage(usage);
    rawText = stripFences(textOf(msg));
  }
  const d = directionSchema.parse(JSON.parse(rawText));
  const spec = assembleSpec(data, vibe, {
    archetype: ARCH_FOR_TEMPERAMENT[d.temperament],
    experience: d.experience,
    temperament: d.temperament,
    accent: d.accent,
    accent2: d.accent2,
    mode: d.mode,
    objectComplexity: d.objectComplexity,
    motionEnergy: d.motionEnergy,
    density: d.density,
  });
  return { spec, usage };
}

export async function buildDesignSpec(
  data: ProfileData,
  vibe: string,
): Promise<{ spec: DesignSpec; usage: UsageRecord | null }> {
  if (isMock) return { spec: mockSpec(data, vibe), usage: null };
  try {
    return await liveDesignSpec(data, vibe);
  } catch (err) {
    console.warn("[design] fallback to mock spec:", err instanceof Error ? err.message : err);
    return { spec: mockSpec(data, vibe), usage: null };
  }
}
