import { getSession } from "~/server/auth";
import {
  htmlResponse,
  portfolioDocument,
  portfolioNotFoundDocument,
} from "~/server/portfolio/document";
import {
  buildPortfolioHtml,
  findPortfolioBySlug,
} from "~/server/portfolio/render-iframe";
import { portfolioHeroImageVersion } from "~/server/portfolio/hero-image-version";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const portfolio = await findPortfolioBySlug(slug);
  if (!portfolio) return htmlResponse(portfolioNotFoundDocument(slug), 404);

  if (!portfolio.isPublic) {
    const session = await getSession(request.headers);
    if (session?.user?.id !== portfolio.ownerId) {
      return htmlResponse(portfolioNotFoundDocument(slug), 404);
    }
  }

  const url = new URL(request.url);
  const canonicalUrl = `${url.protocol}//${url.host}`;
  const portfolioHtml = buildPortfolioHtml(portfolio, url.origin);
  if (!portfolioHtml) return htmlResponse(portfolioNotFoundDocument(slug), 404);
  return htmlResponse(
    portfolioDocument({
      portfolioHtml,
      profileData: portfolio.profileData,
      githubUsername: portfolio.githubUsername,
      canonicalUrl,
      imageUrl: `${canonicalUrl}/sites/${encodeURIComponent(slug)}/opengraph-image?v=${portfolioHeroImageVersion(portfolio.updatedAt)}`,
      isPublic: portfolio.isPublic,
    }),
  );
}

export const HEAD = GET;
