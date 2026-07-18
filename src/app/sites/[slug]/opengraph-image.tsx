import { db } from "~/server/db";
import { renderPorfiloLandingOgImage } from "~/server/og/porthub-landing";
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
    where: { OR: [{ slug }, { publicSubdomainSlug: slug }] },
  });
  if (!portfolio) return renderPorfiloLandingOgImage();
  try {
    return await renderPortfolioHeroImage(portfolio);
  } catch (error) {
    console.error("Failed to capture portfolio hero image", error);
    return new Response("Portfolio preview is temporarily unavailable.", {
      status: 503,
      headers: { "Retry-After": "30" },
    });
  }
}
