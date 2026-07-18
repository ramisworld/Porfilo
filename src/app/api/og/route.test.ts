import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  host: "private.example.com",
  findByHost: vi.fn(),
  findBySlug: vi.fn(),
  landing: vi.fn(async () => new Response("landing")),
  hero: vi.fn(async () => new Response("hero")),
  fallback: vi.fn(() => new Response("fallback")),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: h.host }),
}));
vi.mock("~/server/portfolio/render-iframe", () => ({
  findPortfolioForHost: h.findByHost,
  findPortfolioBySlug: h.findBySlug,
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

import { GET } from "./route";

describe("host portfolio social-image privacy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never renders or caches a private portfolio hero", async () => {
    h.findByHost.mockResolvedValue({ id: "private", isPublic: false });
    const response = await GET();

    expect(h.hero).not.toHaveBeenCalled();
    expect(h.landing).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
