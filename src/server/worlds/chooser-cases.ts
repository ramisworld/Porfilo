import type { WorldId } from "./catalog";

/** Fixed acceptance cases. Do not silently retune them after a model mismatch. */
export const WORLD_CHOOSER_CASES: ReadonlyArray<{
  vibe: string;
  expected: WorldId;
}> = [
  {
    vibe: "Raw monochrome brutalism, harsh grid lines and confrontational oversized type.",
    expected: "brutalist",
  },
  {
    vibe: "A sophisticated premium desktop operating system with draggable windows, folders and apps.",
    expected: "os",
  },
  {
    vibe: "A quiet contemplative Japanese zen garden with raked sand and restrained motion.",
    expected: "zen-systems-garden",
  },
  {
    vibe: "A living network of autonomous AI agents collaborating like an emergent colony.",
    expected: "agent-colony",
  },
  {
    vibe: "A futuristic liquid chrome monolith made of reflective flowing metal.",
    expected: "liquid-chrome-monolith",
  },
  {
    vibe: "A premium dark Japanese ninja portfolio with a shinobi atmosphere, shoji geometry and stealth interactions.",
    expected: "shoji-light-house",
  },
  {
    vibe: "Give my portfolio a premium Japanese style with a ninja vibe.",
    expected: "shoji-light-house",
  },
  {
    vibe: "A dark Japanese shinobi portfolio with subtle stealth interactions.",
    expected: "shoji-light-house",
  },
  {
    vibe: "A sophisticated stealth portfolio framed by traditional shoji screens.",
    expected: "shoji-light-house",
  },
  {
    vibe: "A premium Swiss kinetic typography studio with a graphic design grid and interactive editorial composition.",
    expected: "kinetic-type-bureau",
  },
  {
    vibe: "A deep-sea sonar interface with a submarine research console, ocean telemetry and project signals.",
    expected: "abyssal-signal-array",
  },
];
