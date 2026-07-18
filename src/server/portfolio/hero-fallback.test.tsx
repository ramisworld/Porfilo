import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { WORLD_TEST_PROFILE } from "~/server/worlds/test-profile";
import { renderPortfolioHeroFallback } from "./hero-fallback";

describe("portfolio hero fallback", () => {
  it("returns a shareable, portfolio-specific image", async () => {
    const response = renderPortfolioHeroFallback({
      githubUsername: "alexrivera",
      profileData: WORLD_TEST_PROFILE,
    });

    expect(response.headers.get("content-type")).toContain("image/png");
    const image = await sharp(
      Buffer.from(await response.arrayBuffer()),
    ).metadata();
    expect(image.width).toBe(1200);
    expect(image.height).toBe(630);
  });
});
