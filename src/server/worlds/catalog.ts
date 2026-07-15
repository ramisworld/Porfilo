import { z } from "zod";

/** The complete, approved portfolio collection. Support/launcher files are intentionally absent. */
export const WORLD_IDS = [
  "brutalist",
  "terminal",
  "terminal-nexus",
  "magazine",
  "os",
  "neural-aperture",
  "neural-chromatic",
  "neural-dither",
  "neural-gravity",
  "neural-magnetic",
  "living-blueprint",
  "signal-studio",
  "shadowbox-theatre",
  "bioluminescent-field-guide",
  "grand-complication",
  "variable-type-foundry",
  "isometric-microcity",
  "modular-synthesizer",
  "electromechanical-pinball",
  "digital-loom",
  "climate-engine",
  "zen-systems-garden",
  "darkroom",
  "kinetic-sculpture-garden",
  "seismic-archive",
  "liquid-chrome-monolith",
  "impossible-architecture",
  "agent-colony",
  "paper-cinema",
  "aerodynamic-laboratory",
  "memory-palace",
  "kinetic-bauhaus-factory",
  "polar-night-expedition",
] as const;

export type WorldId = (typeof WORLD_IDS)[number];
export const worldIdSchema = z.enum(WORLD_IDS);

export interface WorldDefinition {
  id: WorldId;
  name: string;
  concept: string;
  /** Phrases are deliberately redundant: they support deterministic fallback and Haiku context. */
  cues: readonly string[];
  antiCues?: readonly string[];
  theme: {
    background: string;
    foreground: string;
    accent: string;
    muted: string;
  };
}

export const WORLD_CATALOG: readonly WorldDefinition[] = [
  {
    id: "brutalist",
    name: "Brutalist",
    concept: "Raw monochrome editorial grid with confrontational typography.",
    cues: [
      "brutalist",
      "raw",
      "monochrome",
      "anti design",
      "harsh grid",
      "utilitarian",
    ],
    theme: {
      background: "#f2f0e8",
      foreground: "#0b0b0b",
      accent: "#ff2f17",
      muted: "#67665e",
    },
  },
  {
    id: "terminal",
    name: "Cyber Terminal",
    concept:
      "A pure operable hacker shell with CRT phosphor and typed commands.",
    cues: [
      "cyber terminal",
      "hacker",
      "bash",
      "shell",
      "crt",
      "phosphor",
      "matrix",
      "retro terminal",
    ],
    antiCues: ["cinematic telemetry", "operations dashboard"],
    theme: {
      background: "#020805",
      foreground: "#caffb8",
      accent: "#7cff58",
      muted: "#3b7042",
    },
  },
  {
    id: "terminal-nexus",
    name: "Terminal Nexus",
    concept:
      "A cinematic systems console with telemetry, secure operations, and scrolling diagnostics.",
    cues: [
      "terminal nexus",
      "operations console",
      "telemetry",
      "command center",
      "systems dashboard",
      "secure uplink",
      "cinematic terminal",
    ],
    antiCues: ["pure bash shell"],
    theme: {
      background: "#04080b",
      foreground: "#c9f5df",
      accent: "#35e08f",
      muted: "#1c7a51",
    },
  },
  {
    id: "magazine",
    name: "Magazine",
    concept:
      "High-fashion editorial publication with mastheads, spreads, and typographic hierarchy.",
    cues: [
      "magazine",
      "editorial",
      "publication",
      "fashion",
      "print",
      "journal",
      "newspaper",
      "art direction",
    ],
    theme: {
      background: "#f5f0e5",
      foreground: "#111111",
      accent: "#204cff",
      muted: "#6e6a62",
    },
  },
  {
    id: "os",
    name: "Serein OS",
    concept:
      "A premium desktop operating system with windows, folders, files, and apps.",
    cues: [
      "operating system",
      "desktop os",
      "mac os",
      "windows",
      "folders",
      "apps",
      "finder",
      "premium desktop",
    ],
    theme: {
      background: "#0b1018",
      foreground: "#eff4ff",
      accent: "#82a7ff",
      muted: "#8490a5",
    },
  },

  {
    id: "neural-aperture",
    name: "Aperture Index",
    concept:
      "An optical research instrument: precise, scientific, minimal, and lens-driven.",
    cues: [
      "aperture",
      "optical",
      "lens",
      "scientific instrument",
      "precision",
      "clinical",
      "camera optics",
    ],
    theme: {
      background: "#eeeae0",
      foreground: "#141414",
      accent: "#ff4526",
      muted: "#68645b",
    },
  },
  {
    id: "neural-chromatic",
    name: "Chromatic Engine",
    concept:
      "A saturated experimental colour engine with luminous energy and bold motion.",
    cues: [
      "chromatic",
      "saturated",
      "colourful",
      "colorful",
      "prismatic",
      "neon spectrum",
      "experimental colour",
    ],
    theme: {
      background: "#120d22",
      foreground: "#fff7e8",
      accent: "#ff4fba",
      muted: "#a89bb5",
    },
  },
  {
    id: "neural-dither",
    name: "Dither Array",
    concept:
      "A graphic bitmap laboratory built from pixels, halftones, and retro-computing texture.",
    cues: [
      "dither",
      "bitmap",
      "pixel",
      "halftone",
      "1 bit",
      "retro computer",
      "pixel art",
    ],
    theme: {
      background: "#e8e5d9",
      foreground: "#101010",
      accent: "#ec3d20",
      muted: "#626057",
    },
  },
  {
    id: "neural-gravity",
    name: "Gravity Well",
    concept:
      "A dark cosmic observatory of orbiting work, depth, and gravitational motion.",
    cues: [
      "gravity",
      "cosmic",
      "space",
      "orbital",
      "black hole",
      "astronomy",
      "dark universe",
    ],
    theme: {
      background: "#03040a",
      foreground: "#eaf0ff",
      accent: "#8b75ff",
      muted: "#7c849b",
    },
  },
  {
    id: "neural-magnetic",
    name: "Magnetic Atlas",
    concept:
      "A navigable magnetic map: cartographic, spatial, technical, and field-driven.",
    cues: [
      "magnetic",
      "atlas",
      "cartography",
      "map",
      "compass",
      "navigation",
      "field lines",
    ],
    theme: {
      background: "#e8e4d7",
      foreground: "#18201c",
      accent: "#e04a2f",
      muted: "#68706a",
    },
  },

  {
    id: "living-blueprint",
    name: "Living Blueprint",
    concept:
      "Architectural drawings and technical plans that evolve like a living system.",
    cues: [
      "blueprint",
      "architectural",
      "technical drawing",
      "schematic",
      "construction plan",
      "cyanotype",
    ],
    theme: {
      background: "#071c2b",
      foreground: "#d7f3ff",
      accent: "#52cef5",
      muted: "#6b9db0",
    },
  },
  {
    id: "signal-studio",
    name: "Signal Studio",
    concept:
      "An analogue broadcast and recording console with tuning controls and strong typography.",
    cues: [
      "signal studio",
      "broadcast",
      "radio",
      "analogue audio",
      "recording studio",
      "frequency",
      "tuning",
    ],
    theme: {
      background: "#100f0d",
      foreground: "#f5f0e5",
      accent: "#ff3928",
      muted: "#8a857b",
    },
  },
  {
    id: "shadowbox-theatre",
    name: "Shadowbox Theatre",
    concept:
      "A cinematic theatre of staged projects, deep shadows, and dramatic spotlights.",
    cues: [
      "shadowbox",
      "theatre",
      "theater",
      "stage",
      "cinematic",
      "spotlight",
      "dramatic",
    ],
    theme: {
      background: "#080608",
      foreground: "#f4e7d8",
      accent: "#e34a32",
      muted: "#897a75",
    },
  },
  {
    id: "bioluminescent-field-guide",
    name: "Bioluminescent Field Guide",
    concept:
      "An organic nocturnal field guide with glowing specimens and natural science.",
    cues: [
      "bioluminescent",
      "field guide",
      "organic",
      "marine biology",
      "nocturnal",
      "glowing organisms",
      "naturalist",
    ],
    theme: {
      background: "#03110e",
      foreground: "#dcfff0",
      accent: "#55f5bd",
      muted: "#6e9f8c",
    },
  },
  {
    id: "grand-complication",
    name: "Grand Complication",
    concept:
      "Luxury mechanical watchmaking, precision gears, and horological craft.",
    cues: [
      "watchmaking",
      "horology",
      "luxury mechanical",
      "clockwork",
      "gears",
      "timepiece",
      "grand complication",
    ],
    theme: {
      background: "#12100d",
      foreground: "#f1e4c9",
      accent: "#c69a50",
      muted: "#897b63",
    },
  },

  {
    id: "variable-type-foundry",
    name: "Variable Type Foundry",
    concept:
      "An interactive typography foundry with adjustable specimens and editorial type controls.",
    cues: [
      "type foundry",
      "typography",
      "variable font",
      "typesetting",
      "font specimen",
      "graphic type",
    ],
    theme: {
      background: "#f1eddf",
      foreground: "#111111",
      accent: "#f04422",
      muted: "#6f6a60",
    },
  },
  {
    id: "isometric-microcity",
    name: "Isometric Microcity",
    concept:
      "An explorable miniature software city rendered as isometric architecture.",
    cues: [
      "isometric city",
      "microcity",
      "miniature city",
      "buildings",
      "urban map",
      "isometric architecture",
    ],
    theme: {
      background: "#dfe8e5",
      foreground: "#18221f",
      accent: "#ff6842",
      muted: "#667570",
    },
  },
  {
    id: "modular-synthesizer",
    name: "Modular Synthesizer",
    concept:
      "A patchable electronic music system of knobs, cables, oscillators, and modules.",
    cues: [
      "modular synth",
      "synthesizer",
      "patch cables",
      "oscillator",
      "electronic music",
      "audio modules",
    ],
    theme: {
      background: "#181713",
      foreground: "#f4ecd8",
      accent: "#ffb21f",
      muted: "#8c8578",
    },
  },
  {
    id: "electromechanical-pinball",
    name: "Electromechanical Pinball",
    concept:
      "A tactile arcade playfield with score reels, lights, bumpers, and physical energy.",
    cues: [
      "pinball",
      "arcade",
      "score reels",
      "bumper",
      "electromechanical",
      "retro game",
    ],
    theme: {
      background: "#15100d",
      foreground: "#fff0d5",
      accent: "#ff3d2e",
      muted: "#9b806c",
    },
  },
  {
    id: "digital-loom",
    name: "Digital Loom",
    concept:
      "A generative textile workshop weaving projects into patterns and threads.",
    cues: [
      "digital loom",
      "weaving",
      "textile",
      "fabric",
      "threads",
      "tapestry",
      "generative pattern",
    ],
    theme: {
      background: "#efe6d3",
      foreground: "#211a17",
      accent: "#c84b31",
      muted: "#776a60",
    },
  },
  {
    id: "climate-engine",
    name: "Climate Engine",
    concept:
      "An atmospheric laboratory of weather instruments, pressure systems, and live climate motion.",
    cues: [
      "climate",
      "weather",
      "atmospheric",
      "meteorology",
      "pressure system",
      "storm",
      "forecast",
    ],
    theme: {
      background: "#cfdce1",
      foreground: "#11232a",
      accent: "#ef5a35",
      muted: "#60767f",
    },
  },
  {
    id: "zen-systems-garden",
    name: "Zen Systems Garden",
    concept:
      "A quiet Japanese-inspired systems garden: contemplative, minimal, and balanced.",
    cues: [
      "zen garden",
      "japanese minimal",
      "contemplative",
      "calm",
      "quiet",
      "raked sand",
      "meditative",
    ],
    theme: {
      background: "#e8e2d4",
      foreground: "#22231f",
      accent: "#ba4a35",
      muted: "#77766e",
    },
  },
  {
    id: "darkroom",
    name: "Darkroom",
    concept:
      "A photographic darkroom of contact sheets, grain, red safelight, and film chemistry.",
    cues: [
      "darkroom",
      "photography",
      "film",
      "contact sheet",
      "photo grain",
      "red light",
      "analogue camera",
    ],
    theme: {
      background: "#0c0908",
      foreground: "#efe6dc",
      accent: "#e33a2d",
      muted: "#8a7770",
    },
  },
  {
    id: "kinetic-sculpture-garden",
    name: "Kinetic Sculpture Garden",
    concept:
      "A spatial gallery of moving physical forms and interactive sculpture.",
    cues: [
      "kinetic sculpture",
      "sculpture garden",
      "gallery installation",
      "moving forms",
      "spatial art",
      "museum",
    ],
    theme: {
      background: "#e9e7de",
      foreground: "#161817",
      accent: "#ff5a36",
      muted: "#747873",
    },
  },
  {
    id: "seismic-archive",
    name: "Seismic Archive",
    concept:
      "A geological archive of waveform records, strata, and earthquake instrumentation.",
    cues: [
      "seismic",
      "earthquake",
      "geology",
      "waveform",
      "strata",
      "seismograph",
      "geological archive",
    ],
    theme: {
      background: "#171511",
      foreground: "#eee5d2",
      accent: "#ef5a32",
      muted: "#918674",
    },
  },

  {
    id: "liquid-chrome-monolith",
    name: "Liquid Chrome Monolith",
    concept:
      "A futuristic liquid-metal monument with reflective chrome and sculptural motion.",
    cues: [
      "liquid chrome",
      "liquid metal",
      "chrome monolith",
      "reflective metal",
      "futuristic sculpture",
      "mercury",
    ],
    theme: {
      background: "#08090c",
      foreground: "#f4f6fa",
      accent: "#8da4ff",
      muted: "#858b98",
    },
  },
  {
    id: "impossible-architecture",
    name: "Impossible Architecture",
    concept:
      "Surreal impossible spaces, paradoxical structures, and Escher-like navigation.",
    cues: [
      "impossible architecture",
      "surreal architecture",
      "escher",
      "paradox",
      "impossible space",
      "brutal geometry",
    ],
    theme: {
      background: "#e7e2d7",
      foreground: "#151513",
      accent: "#ed5838",
      muted: "#6f6c64",
    },
  },
  {
    id: "agent-colony",
    name: "Agent Colony",
    concept:
      "A living colony of autonomous AI agents, tasks, communications, and emergent systems.",
    cues: [
      "agent colony",
      "ai agents",
      "agent swarm",
      "multi agent",
      "autonomous agents",
      "emergent network",
      "agent system",
    ],
    theme: {
      background: "#050b09",
      foreground: "#dff9e9",
      accent: "#63ef9f",
      muted: "#668b76",
    },
  },
  {
    id: "paper-cinema",
    name: "Paper Cinema",
    concept:
      "A tactile storybook of layered paper scenes, cut-outs, and cinematic sequencing.",
    cues: [
      "paper cinema",
      "paper cut",
      "storybook",
      "collage",
      "tactile paper",
      "stop motion",
      "handmade",
    ],
    theme: {
      background: "#eee5d3",
      foreground: "#221c18",
      accent: "#e44b32",
      muted: "#7c6c60",
    },
  },
  {
    id: "aerodynamic-laboratory",
    name: "Aerodynamic Laboratory",
    concept:
      "A precision wind-tunnel laboratory of airflow, engineering, and measured speed.",
    cues: [
      "aerodynamic",
      "wind tunnel",
      "airflow",
      "aviation engineering",
      "fluid dynamics",
      "precision lab",
    ],
    theme: {
      background: "#e8ece9",
      foreground: "#17201f",
      accent: "#ff542f",
      muted: "#6c7775",
    },
  },
  {
    id: "memory-palace",
    name: "Memory Palace",
    concept:
      "A dreamlike architectural archive of rooms, memories, and personal artefacts.",
    cues: [
      "memory palace",
      "dreamlike rooms",
      "personal archive",
      "memory",
      "surreal interior",
      "nostalgia",
    ],
    theme: {
      background: "#17121a",
      foreground: "#f3e9ef",
      accent: "#d782b7",
      muted: "#978794",
    },
  },
  {
    id: "kinetic-bauhaus-factory",
    name: "Kinetic Bauhaus Factory",
    concept:
      "A geometric industrial factory powered by bold Bauhaus colour and moving machinery.",
    cues: [
      "bauhaus",
      "kinetic factory",
      "geometric machinery",
      "industrial modernism",
      "primary colours",
      "constructivist",
    ],
    theme: {
      background: "#eee7d7",
      foreground: "#151515",
      accent: "#ee3f2c",
      muted: "#706b61",
    },
  },
  {
    id: "polar-night-expedition",
    name: "Polar Night Expedition",
    concept:
      "An arctic expedition interface of instrument logs, cold darkness, and polar navigation.",
    cues: [
      "polar night",
      "arctic expedition",
      "antarctic",
      "ice",
      "expedition log",
      "cold instruments",
      "polar research",
    ],
    theme: {
      background: "#061119",
      foreground: "#e7f6ff",
      accent: "#6ed3ff",
      muted: "#6f8998",
    },
  },
] as const satisfies readonly WorldDefinition[];

const WORLD_BY_ID = new Map(WORLD_CATALOG.map((world) => [world.id, world]));

export function getWorld(id: WorldId): WorldDefinition {
  const world = WORLD_BY_ID.get(id);
  if (!world) throw new Error(`Unknown portfolio world: ${id}`);
  return world;
}

export function isWorldId(value: string): value is WorldId {
  return WORLD_BY_ID.has(value as WorldId);
}
