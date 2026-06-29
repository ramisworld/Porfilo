import "server-only";
import { db } from "~/server/db";
import { renderPortfolioPage } from "~/engine/render";
import { DEFAULT_SPEC, designSpecSchema } from "~/engine/spec";
import { ENGINE_VERSION } from "~/engine/version";
import { env } from "~/env";
import type { ProfileData } from "~/server/profile/model";

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

  return (
    <iframe
      title="portfolio"
      srcDoc={html}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      className="fixed inset-0 h-screen w-screen border-0"
    />
  );
}

/** Look up portfolio by slug or publicSubdomainSlug (path-based /sites route). */
export async function findPortfolioBySlug(slug: string) {
  return db.portfolio.findFirst({
    where: {
      OR: [{ slug }, { publicSubdomainSlug: slug }],
    },
  });
}

function rootDomainNoPort(): string {
  return env.NEXT_PUBLIC_ROOT_DOMAIN.toLowerCase().replace(/:\d+$/, "");
}

/**
 * Resolve a hostname to a portfolio — custom domains, free subdomains, and
 * public preview slugs (*.porfilo.com).
 */
export async function findPortfolioForHost(hostname: string) {
  const host = hostname.toLowerCase();

  const domain = await db.customDomain.findUnique({
    where: { hostname: host },
    select: {
      status: true,
      type: true,
      dnsVerified: true,
      httpVerified: true,
      portfolio: true,
    },
  });

  if (domain) {
    if (domain.type === "free_subdomain" && domain.status === "active") {
      return domain.portfolio;
    }
    if (
      domain.type === "custom_domain" &&
      domain.status === "active" &&
      domain.dnsVerified &&
      domain.httpVerified
    ) {
      return domain.portfolio;
    }
    return null;
  }

  const root = rootDomainNoPort();
  if (host.endsWith(`.${root}`)) {
    const label = host.slice(0, host.length - root.length - 1);
    if (label) {
      return findPortfolioBySlug(label);
    }
  }

  return null;
}

/** @deprecated Use findPortfolioForHost */
export async function findPortfolioForCustomHost(hostname: string) {
  return findPortfolioForHost(hostname);
}
