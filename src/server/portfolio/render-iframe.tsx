import "server-only";
import { db } from "~/server/db";
import { env } from "~/env";
import { appOrigin } from "~/lib/root-domain";
import { buildPortfolioHtml } from "./render-html";

export { buildPortfolioHtml } from "./render-html";

export function buildPortfolioIframe(portfolio: {
  designSpec: unknown;
  profileData: unknown;
  engineVersion: string | null;
  code: string | null;
  template: string;
  githubUsername: string;
}): React.JSX.Element | null {
  // The request may arrive through Railway with an internal host (for
  // example localhost:8080). Portfolio engine assets must use the public app
  // origin so nested preview frames do not render as a blank page.
  const html = buildPortfolioHtml(portfolio, appOrigin());
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
