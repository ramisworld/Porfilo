import { getSession } from "~/server/auth";
import {
  htmlResponse,
  portfolioDocument,
  portfolioNotFoundDocument,
} from "~/server/portfolio/document";
import {
  buildPortfolioHtml,
  findPortfolioForHost,
} from "~/server/portfolio/render-iframe";
import { portfolioHeroImageVersion } from "~/server/portfolio/hero-image-version";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ host: string }> },
) {
  const { host } = await params;
  const hostname = decodeURIComponent(host);
  const portfolio = await findPortfolioForHost(hostname);
  if (!portfolio) return htmlResponse(portfolioNotFoundDocument(hostname), 404);

  if (!portfolio.isPublic) {
    const session = await getSession(request.headers);
    if (session?.user?.id !== portfolio.ownerId) {
      return htmlResponse(portfolioNotFoundDocument(hostname), 404);
    }
  }

  const portfolioHtml = buildPortfolioHtml(portfolio);
  if (!portfolioHtml) {
    return htmlResponse(portfolioNotFoundDocument(hostname), 404);
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const canonicalUrl = `${forwardedProto}://${hostname}`;
  return htmlResponse(
    portfolioDocument({
      portfolioHtml,
      profileData: portfolio.profileData,
      githubUsername: portfolio.githubUsername,
      canonicalUrl,
      imageUrl: `${canonicalUrl}/api/og?v=${portfolioHeroImageVersion(portfolio.updatedAt)}`,
      isPublic: portfolio.isPublic,
    }),
  );
}

export const HEAD = GET;
