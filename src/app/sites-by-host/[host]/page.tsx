import { headers } from "next/headers";
import type { Metadata } from "next";
import { getSession } from "~/server/auth";
import {
  buildPortfolioIframe,
  findPortfolioForHost,
} from "~/server/portfolio/render-iframe";
import { buildPortfolioMetadata } from "~/server/portfolio/metadata";
import { PortfolioNotFound } from "~/app/_components/portfolio-not-found";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string }>;
}): Promise<Metadata> {
  const { host } = await params;
  const hostname = decodeURIComponent(host);
  const portfolio = await findPortfolioForHost(hostname);
  if (!portfolio) return { title: "Portfolio not found — Porfilo" };
  const proto = (await headers()).get("x-forwarded-proto") ?? "https";
  return buildPortfolioMetadata({
    profileData: portfolio.profileData,
    githubUsername: portfolio.githubUsername,
    isPublic: portfolio.isPublic,
    canonicalUrl: `${proto}://${hostname}`,
  });
}

export default async function SiteByHostPage({
  params,
}: {
  params: Promise<{ host: string }>;
}) {
  const { host } = await params;
  const hostname = decodeURIComponent(host);

  const portfolio = await findPortfolioForHost(hostname);
  if (!portfolio) return <PortfolioNotFound host={hostname} />;

  if (!portfolio.isPublic) {
    const session = await getSession(await headers());
    if (session?.user?.id !== portfolio.ownerId) {
      return <PortfolioNotFound host={hostname} />;
    }
  }

  const frame = buildPortfolioIframe(portfolio);
  if (!frame) return <PortfolioNotFound host={hostname} />;
  return frame;
}
