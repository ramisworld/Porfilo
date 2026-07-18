import { db } from "~/server/db";
import { renderPorfiloLandingOgImage } from "~/server/og/porthub-landing";
import { renderPortfolioHeroFallback } from "~/server/portfolio/hero-fallback";
import { renderPortfolioHeroImage } from "~/server/portfolio/hero-image";

export const runtime = "nodejs";
export const alt = "Developer portfolio on Porfilo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const portfolio = await db.portfolio.findFirst({
    where: {
      isPublic: true,
      OR: [{ slug }, { publicSubdomainSlug: slug }],
    },
  });
  if (!portfolio) {
    const response = await renderPorfiloLandingOgImage();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  try {
    return await renderPortfolioHeroImage(portfolio);
  } catch (error) {
    console.error("Failed to capture portfolio hero image", error);
    return renderPortfolioHeroFallback(portfolio);
  }
}
