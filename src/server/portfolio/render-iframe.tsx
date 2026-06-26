import "server-only";
import { db } from "~/server/db";
import { renderPortfolioPage } from "~/engine/render";
import { DEFAULT_SPEC, designSpecSchema } from "~/engine/spec";
import { ENGINE_VERSION } from "~/engine/version";
import type { ProfileData } from "~/server/profile/model";

/**
 * Build the sandboxed iframe that serves a portfolio. Shared between the slug
 * route (`/sites/[slug]`) and the custom-domain route (`/sites-by-host/[host]`)
 * so both stay byte-identical.
 *
 * Returns either an iframe element ready to render, or `null` if the portfolio
 * has no usable design+data (caller should `notFound()`).
 */
export function buildPortfolioIframe(
  portfolio: {
    designSpec: unknown;
    profileData: unknown;
    engineVersion: string | null;
    code: string | null;
  },
): React.JSX.Element | null {
  let html: string | null = null;
  if (portfolio.designSpec) {
    const parsed = designSpecSchema.safeParse(portfolio.designSpec);
    const spec = parsed.success ? parsed.data : DEFAULT_SPEC;
    const version = portfolio.engineVersion ?? ENGINE_VERSION;
    html = renderPortfolioPage(
      spec,
      portfolio.profileData as ProfileData,
      version,
    );
  } else if (portfolio.code) {
    html = portfolio.code;
  }
  if (!html) return null;

  // The generated page is untrusted → sandbox it. allow-scripts (its animations
  // need JS), allow-popups so clicked links open as real tabs; NOT
  // allow-same-origin, so it can't reach the app or its storage.
  return (
    <iframe
      title="portfolio"
      srcDoc={html}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      className="fixed inset-0 h-screen w-screen border-0"
    />
  );
}

/**
 * Find the Portfolio bound to a custom hostname. Returns null if no row
 * exists, or if the row exists but isn't yet `active`.
 */
export async function findPortfolioForCustomHost(hostname: string) {
  const domain = await db.customDomain.findUnique({
    where: { hostname: hostname.toLowerCase() },
    select: {
      status: true,
      portfolio: true,
    },
  });
  if (!domain) return null;
  if (domain.status !== "active") return null;
  return domain.portfolio;
}
