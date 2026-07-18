import { describe, expect, it } from "vitest";
import {
  PORTFOLIO_HERO_IMAGE_VERSION,
  portfolioHeroImageVersion,
} from "./hero-image-version";

describe("portfolio hero image version", () => {
  it("combines the renderer version with the portfolio update time", () => {
    const updatedAt = new Date("2026-07-15T10:00:00.000Z");
    expect(portfolioHeroImageVersion(updatedAt)).toBe(
      `${PORTFOLIO_HERO_IMAGE_VERSION}.1784109600000`,
    );
  });
});
