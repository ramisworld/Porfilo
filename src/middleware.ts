import { NextResponse, type NextRequest } from "next/server";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

const RESERVED = new Set([
  "www",
  "app",
  "api",
  "admin",
  "dashboard",
  "auth",
  "login",
  "signup",
  "mail",
  "email",
  "support",
  "docs",
  "blog",
  "status",
  "assets",
  "static",
  "cdn",
  "customers",
  "proxy-fallback",
  "test",
  "dev",
  "staging",
  "root",
  "billing",
  "settings",
]);

function effectiveHost(req: NextRequest): string {
  const porfiloHost = req.headers.get("x-porfilo-host");
  const legacyHost = req.headers.get("x-porthub-host");
  const forwarded = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host") ?? "";
  const raw = porfiloHost ?? legacyHost ?? forwarded ?? host;
  return raw.toLowerCase().replace(/:\d+$/, "");
}

function portfolioInternalPath(base: string, requestPath: string): string {
  if (requestPath === "/icon" || requestPath.startsWith("/icon?")) {
    return `${base}/icon`;
  }
  if (
    requestPath === "/apple-icon" ||
    requestPath.startsWith("/apple-icon?")
  ) {
    return `${base}/apple-icon`;
  }
  return base;
}

/**
 * Multi-tenant routing for Porfilo.
 *
 *   porfilo.com              → app (marketing/dashboard)
 *   www.porfilo.com          → redirect to porfilo.com
 *   <slug>.porfilo.com       → portfolio by public slug / free subdomain
 *   external custom domain   → portfolio by hostname
 */
export function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);

  if (req.nextUrl.pathname.startsWith("/engine/")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const hostNoPort = effectiveHost(req);
  const rootNoPort = ROOT_DOMAIN.toLowerCase().replace(/:\d+$/, "");

  // www → apex redirect
  if (hostNoPort === `www.${rootNoPort}`) {
    const url = req.nextUrl.clone();
    url.hostname = rootNoPort.split(":")[0]!;
    url.port = rootNoPort.includes(":") ? rootNoPort.split(":")[1]! : "";
    url.protocol = req.nextUrl.protocol;
    return NextResponse.redirect(url, 308);
  }

  // Worker bridge: custom domain carried out-of-band
  const forwardedCustom =
    req.headers.get("x-porfilo-host") ?? req.headers.get("x-porthub-host");
  if (forwardedCustom) {
    const customHost = forwardedCustom.toLowerCase().replace(/:\d+$/, "");
    const url = req.nextUrl.clone();
    url.pathname = portfolioInternalPath(
      `/sites-by-host/${encodeURIComponent(customHost)}`,
      req.nextUrl.pathname,
    );
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // Bare root → app
  if (hostNoPort === rootNoPort) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Subdomains under our root → full hostname lookup (preview slugs + free subdomains)
  if (hostNoPort.endsWith(`.${rootNoPort}`)) {
    const subdomain = hostNoPort.slice(
      0,
      hostNoPort.length - rootNoPort.length - 1,
    );
    if (!subdomain || RESERVED.has(subdomain)) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    const url = req.nextUrl.clone();
    url.pathname = portfolioInternalPath(
      `/sites-by-host/${encodeURIComponent(hostNoPort)}`,
      req.nextUrl.pathname,
    );
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // External custom domain
  const url = req.nextUrl.clone();
  url.pathname = portfolioInternalPath(
    `/sites-by-host/${encodeURIComponent(hostNoPort)}`,
    req.nextUrl.pathname,
  );
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
