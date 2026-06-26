import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "~/server/db";
import { getSession } from "~/server/auth";
import { buildPortfolioIframe } from "~/server/portfolio/render-iframe";

// Always read the latest data + re-render via the engine (engine upgrades apply
// to all existing portfolios).
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await db.portfolio.findUnique({
    where: { slug },
    select: { isPublic: true, githubUsername: true },
  });
  if (!p) return {};
  return {
    title: `${p.githubUsername} — PortHub`,
    // Private portfolios should not be indexed. The link still works for
    // anyone who has it — it just won't show up in search.
    robots: p.isPublic ? undefined : { index: false, follow: false },
  };
}

export default async function SitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const portfolio = await db.portfolio.findUnique({ where: { slug } });
  if (!portfolio) notFound();

  // Private gating: when isPublic=false the page only renders for the owner.
  if (!portfolio.isPublic) {
    const session = await getSession(await headers());
    if (session?.user?.id !== portfolio.ownerId) {
      notFound();
    }
  }

  const frame = buildPortfolioIframe(portfolio);
  if (!frame) notFound();
  return frame;
}
