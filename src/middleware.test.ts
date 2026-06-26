import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Pin ROOT_DOMAIN before importing the middleware module so its top-level
// constant captures our test value (it reads process.env at module init).
process.env.NEXT_PUBLIC_ROOT_DOMAIN = "porthub.dev";

// We have to import the middleware lazily so the env line above is honored.
async function loadMiddleware() {
  const m = await import("./middleware");
  return m.middleware;
}

function makeReq(host: string, pathname = "/"): NextRequest {
  const url = new URL(`https://${host}${pathname}`);
  return new NextRequest(url, {
    headers: { host },
  });
}

describe("middleware routing", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "porthub.dev";
  });

  it("passes through the bare root domain", async () => {
    const middleware = await loadMiddleware();
    const res = middleware(makeReq("porthub.dev"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("passes through reserved subdomains", async () => {
    const middleware = await loadMiddleware();
    for (const sub of ["www", "app", "api"]) {
      const res = middleware(makeReq(`${sub}.porthub.dev`));
      expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    }
  });

  it("rewrites <slug>.<root> → /sites/<slug>", async () => {
    const middleware = await loadMiddleware();
    const res = middleware(makeReq("abc123.porthub.dev"));
    const rewrite = res.headers.get("x-middleware-rewrite");
    expect(rewrite).toBeTruthy();
    expect(rewrite).toContain("/sites/abc123");
  });

  it("rewrites a custom domain → /sites-by-host/<host>", async () => {
    const middleware = await loadMiddleware();
    const res = middleware(makeReq("portfolio.max.com"));
    const rewrite = res.headers.get("x-middleware-rewrite");
    expect(rewrite).toBeTruthy();
    expect(rewrite).toContain("/sites-by-host/portfolio.max.com");
  });

  it("preserves /engine/* on every host (never rewrites)", async () => {
    const middleware = await loadMiddleware();
    for (const host of ["porthub.dev", "abc.porthub.dev", "max.com"]) {
      const res = middleware(makeReq(host, "/engine/v2.js"));
      expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    }
  });

  it("ignores :port in host matching (dev parity)", async () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "localhost:3000";
    vi.resetModules();
    const middleware = await loadMiddleware();
    const res = middleware(makeReq("abc.localhost:3000"));
    const rewrite = res.headers.get("x-middleware-rewrite");
    expect(rewrite).toContain("/sites/abc");
  });

  it("does not treat the apex-only host as a slug", async () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "porthub.dev";
    vi.resetModules();
    const middleware = await loadMiddleware();
    const res = middleware(makeReq("porthub.dev", "/dashboard"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
