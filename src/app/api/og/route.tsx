import { headers } from "next/headers";
import { renderPorfiloLandingOgImage } from "~/server/og/porthub-landing";
import {
  findPortfolioBySlug,
  findPortfolioForHost,
} from "~/server/portfolio/render-iframe";
import { renderPortfolioOgImage } from "~/server/portfolio/og-image";

export const runtime = "nodejs";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const RESERVED = new Set(["www", "app", "api"]);

function hostnameFromHeaders(h: Headers): string {
  return (
    h.get("x-porfilo-host") ??
    h.get("x-porthub-host") ??
    h.get("x-forwarded-host") ??
    h.get("host") ??
    ""
  )
    .toLowerCase()
    .replace(/:\d+$/, "");
}

function rootDomain(): string {
  return ROOT_DOMAIN.toLowerCase().replace(/:\d+$/, "");
}

function isPorfiloAppHost(hostname: string): boolean {
  const root = rootDomain();
  if (!hostname || hostname === root || hostname === `www.${root}`) return true;
  if (hostname.endsWith(`.${root}`)) {
    const sub = hostname.slice(0, hostname.length - root.length - 1);
    return !sub || RESERVED.has(sub);
  }
  return false;
}

async function portfolioForHost(hostname: string) {
  const root = rootDomain();
  if (!hostname || hostname === root) return null;

  if (hostname.endsWith(`.${root}`)) {
    const label = hostname.slice(0, hostname.length - root.length - 1);
    if (!label || RESERVED.has(label)) return null;
    return findPortfolioBySlug(label);
  }

  return findPortfolioForHost(hostname);
}

export async function GET() {
  const hostname = hostnameFromHeaders(await headers());

  if (isPorfiloAppHost(hostname)) {
    return renderPorfiloLandingOgImage();
  }

  const portfolio = await portfolioForHost(hostname);
  return renderPortfolioOgImage(
    portfolio?.profileData,
    portfolio?.designSpec,
    portfolio?.githubUsername ?? hostname,
  );
}
