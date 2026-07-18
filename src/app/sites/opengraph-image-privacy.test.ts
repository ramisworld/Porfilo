import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findFirst: vi.fn(),
  landing: vi.fn(async () => new Response("landing")),
  hero: vi.fn(async () => new Response("hero")),
  fallback: vi.fn(() => new Response("fallback")),
}));

vi.mock("~/server/db", () => ({
  db: { portfolio: { findFirst: h.findFirst } },
}));
vi.mock("~/server/og/porthub-landing", () => ({
  renderPorfiloLandingOgImage: h.landing,
}));
vi.mock("~/server/portfolio/hero-image", () => ({
  renderPortfolioHeroImage: h.hero,
}));
vi.mock("~/server/portfolio/hero-fallback", () => ({
  renderPortfolioHeroFallback: h.fallback,
}));

import OgImage from "./[slug]/opengraph-image";

describe("path portfolio social-image privacy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries only public portfolios and never renders a missing/private hero", async () => {
    h.findFirst.mockResolvedValue(null);
    const response = await OgImage({
      params: Promise.resolve({ slug: "private-slug" }),
    });

    expect(h.findFirst).toHaveBeenCalledWith({
      where: {
        isPublic: true,
        OR: [{ slug: "private-slug" }, { publicSubdomainSlug: "private-slug" }],
      },
    });
    expect(h.hero).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
