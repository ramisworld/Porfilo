import { headers } from "next/headers";
import type { Metadata } from "next";
import {
  buildPortfolioIframe,
  findPortfolioBySlug,
} from "~/server/portfolio/render-iframe";
import { getSession } from "~/server/auth";
import { buildPortfolioMetadata } from "~/server/portfolio/metadata";
import { PortfolioNotFound } from "~/app/_components/portfolio-not-found";

export const dynamic = "force-dynamic";

function canonicalFromHeaders(h: Headers): string {
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await findPortfolioBySlug(slug);
  if (!p) return { title: "Portfolio not found — Porfilo" };
  const h = await headers();
  return buildPortfolioMetadata({
    profileData: p.profileData,
    githubUsername: p.githubUsername,
    isPublic: p.isPublic,
    canonicalUrl: canonicalFromHeaders(h),
  });
}

export default async function SitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const portfolio = await findPortfolioBySlug(slug);
  if (!portfolio) return <PortfolioNotFound host={slug} />;

  if (!portfolio.isPublic) {
    const session = await getSession(await headers());
    if (session?.user?.id !== portfolio.ownerId) {
      return <PortfolioNotFound host={slug} />;
    }
  }

  const frame = buildPortfolioIframe(portfolio);
  if (!frame) return <PortfolioNotFound host={slug} />;
  return frame;
}
