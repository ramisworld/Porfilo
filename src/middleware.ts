import { NextResponse, type NextRequest } from "next/server";

// Root domain (with port in dev). NEXT_PUBLIC_* is inlined at build, so it's
// safe to read directly here without importing the env helper into the Edge runtime.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

// Subdomains that should serve the PortHub app, not a portfolio.
const RESERVED = new Set(["www", "app", "api"]);

/**
 * Multi-tenant routing (see docs/ARCHITECTURE.md §2).
 *
 *   <root>              → marketing/app
 *   <reserved>.<root>   → app
 *   <slug>.<root>       → /sites/<slug>          (the URL bar keeps the host)
 *   <custom>            → /sites-by-host/<host>  (Cloudflare for SaaS forwards
 *                                                 user-owned domains here)
 */
export function middleware(req: NextRequest) {
  // Pass the current pathname to server components via header (Next 15 doesn't
  // expose it directly in RSCs). Used by the (app) auth guard to compute `next`.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);

  // The shared engine bundle must serve on every host (incl. portfolio
  // subdomains and custom domains) — never rewrite it to a /sites route.
  if (req.nextUrl.pathname.startsWith("/engine/")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Strip any :port for matching — production hosts never include one and we
  // want a Cloudflare forward (`portfolio.max.com`) to match the same way
  // dev's `localhost:3000` does.
  const rawHost = (req.headers.get("host") ?? "").toLowerCase();
  const hostNoPort = rawHost.replace(/:\d+$/, "");
  const rootNoPort = ROOT_DOMAIN.toLowerCase().replace(/:\d+$/, "");

  // Bare root → serve the app as-is.
  if (rawHost === ROOT_DOMAIN || hostNoPort === rootNoPort) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Hosts under our root domain → either a reserved subdomain (app) or a
  // portfolio slug.
  if (hostNoPort.endsWith(`.${rootNoPort}`)) {
    const subdomain = hostNoPort.slice(
      0,
      hostNoPort.length - rootNoPort.length - 1,
    );
    if (!subdomain || RESERVED.has(subdomain)) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    const url = req.nextUrl.clone();
    url.pathname = `/sites/${subdomain}`;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // Anything else is a user-owned custom domain (or an unmapped host). The DB
  // lookup lives in the route handler so middleware stays Edge-compatible.
  const url = req.nextUrl.clone();
  url.pathname = `/sites-by-host/${encodeURIComponent(hostNoPort)}`;
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

// Exclude Next internals, API routes, and static assets so rewriting never touches them.
export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
