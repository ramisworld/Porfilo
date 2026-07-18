import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderWorld } from "~/server/worlds/render";
import { WORLD_TEST_PROFILE } from "~/server/worlds/test-profile";

const runBrowser = process.env.RUN_BROWSER_OG_TESTS === "true";

describe.skipIf(!runBrowser)("portfolio hero screenshots", () => {
  for (const worldId of ["terminal-nexus", "signal-studio"] as const) {
    it(`captures the real ${worldId} first viewport`, async () => {
      const { capturePortfolioHeroJpeg } = await import("./hero-image");
      const html = renderWorld(worldId, WORLD_TEST_PROFILE, "alexrivera");
      const bytes = await capturePortfolioHeroJpeg(html);
      const image = await sharp(bytes).metadata();

      expect(image.format).toBe("jpeg");
      expect(image.width).toBe(1200);
      expect(image.height).toBe(630);
      expect(bytes.byteLength).toBeGreaterThan(30_000);
    }, 20_000);
  }
});
