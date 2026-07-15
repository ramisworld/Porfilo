/**
 * Approved landing-wall examples.
 *
 * Public GitHub profile/repository statistics were fetched on 2026-07-15.
 * The matching filled HTML files in landing-prompts/examples/ are the
 * provenance for the static thumbnails served from public/examples/.
 */
export const EXAMPLES = [
  { handle: "torvalds", name: "Linus Torvalds", world: "terminal", thumb: "/examples/torvalds-terminal.webp", w: 516, h: 645 },
  { handle: "karpathy", name: "Andrej Karpathy", world: "neural-dither", thumb: "/examples/karpathy-neural-dither.webp", w: 516, h: 645 },
  { handle: "gaearon", name: "Dan Abramov", world: "magazine", thumb: "/examples/gaearon-magazine.webp", w: 516, h: 645 },
  { handle: "rauchg", name: "Guillermo Rauch", world: "liquid-chrome-monolith", thumb: "/examples/rauchg-liquid-chrome-monolith.webp", w: 516, h: 645 },
  { handle: "yyx990803", name: "Evan You", world: "neural-chromatic", thumb: "/examples/yyx990803-neural-chromatic.webp", w: 516, h: 645 },
  { handle: "sindresorhus", name: "Sindre Sorhus", world: "digital-loom", thumb: "/examples/sindresorhus-digital-loom.webp", w: 516, h: 645 },
  { handle: "tiangolo", name: "Sebastián Ramírez", world: "living-blueprint", thumb: "/examples/tiangolo-living-blueprint.webp", w: 516, h: 645 },
  { handle: "simonw", name: "Simon Willison", world: "signal-studio", thumb: "/examples/simonw-signal-studio.webp", w: 516, h: 645 },
  { handle: "mitchellh", name: "Mitchell Hashimoto", world: "os", thumb: "/examples/mitchellh-os.webp", w: 516, h: 645 },
  { handle: "Rich-Harris", name: "Rich Harris", world: "brutalist", thumb: "/examples/rich-harris-brutalist.webp", w: 516, h: 645 },
  { handle: "addyosmani", name: "Addy Osmani", world: "paper-cinema", thumb: "/examples/addyosmani-paper-cinema.webp", w: 516, h: 645 },
] as const;

export type LandingExample = (typeof EXAMPLES)[number];
export type LandingExampleKey = `${LandingExample["handle"]}-${LandingExample["world"]}`;
