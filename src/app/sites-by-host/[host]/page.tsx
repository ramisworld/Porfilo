import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "~/server/auth";
import {
  buildPortfolioIframe,
  findPortfolioForCustomHost,
} from "~/server/portfolio/render-iframe";

// Always read the latest data — engine upgrades apply immediately.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string }>;
}): Promise<Metadata> {
  const { host } = await params;
  const portfolio = await findPortfolioForCustomHost(decodeURIComponent(host));
  if (!portfolio) return {};
  return {
    title: `${portfolio.githubUsername} — PortHub`,
    robots: portfolio.isPublic ? undefined : { index: false, follow: false },
  };
}

/**
 * Public renderer for user-owned hostnames. Middleware forwards any request
 * whose host isn't our root or a `*.<root>` subdomain to this route.
 *
 *   - No matching CustomDomain row    → notFound (looks like a bad domain)
 *   - Domain exists but status != "active"  → notFound (still verifying)
 *   - Portfolio is private             → only the owner sees it
 *   - Otherwise                        → identical render to /sites/[slug]
 */
export default async function SiteByHostPage({
  params,
}: {
  params: Promise<{ host: string }>;
}) {
  const { host } = await params;
  const hostname = decodeURIComponent(host);

  const portfolio = await findPortfolioForCustomHost(hostname);
  if (!portfolio) notFound();

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
