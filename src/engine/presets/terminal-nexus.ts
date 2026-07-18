import { designSpecSchema, type DesignSpec } from "~/engine/spec";

/**
 * The canonical Terminal Nexus recipe. Both the legacy design path and the
 * approved-world renderer import this exact object so the portfolio cannot
 * silently drift into a second, simplified implementation again.
 */
export const TERMINAL_NEXUS_SPEC: DesignSpec = designSpecSchema.parse({
  archetype: "terminal",
  experience: "terminalNexus",
  theme: {
    mode: "dark",
    bg: "#010303",
    surface: "#040807",
    fg: "#e9f0eb",
    muted: "#6b756f",
    border: "#101715",
    accent: "#36d486",
    accent2: "#80e8bd",
    glow: "#1e8f59",
    radius: "sharp",
    glass: 0.55,
  },
  typography: { display: "mono", body: "mono", scale: "normal" },
  background: { mode: "matrix", intensity: 0.5, speed: 0.5, parallax: 0.5 },
  webgl: { scene: "ghostObject", intensity: 0.58 },
  postfx: { bloom: 0.14, chromatic: 0.035, scanlines: true },
  cursor: "square",
  boot: "system",
  motion: "subtle",
  heroGimmick: { type: "none" },
  sections: [
    { type: "hero" },
    { type: "stats" },
    { type: "languages" },
    { type: "projects" },
    { type: "contact" },
  ],
  skins: {
    projectCard: "terminalWindow",
    statCard: "terminal",
    langBar: "ascii",
    nav: "minimal",
    button: "terminal",
  },
});
