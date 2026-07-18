export const PORTFOLIO_HERO_IMAGE_VERSION = "hero-v1";

export function portfolioHeroImageVersion(updatedAt: Date): string {
  return `${PORTFOLIO_HERO_IMAGE_VERSION}.${updatedAt.getTime()}`;
}
