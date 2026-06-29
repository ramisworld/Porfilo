import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

process.env.NEXT_PUBLIC_ROOT_DOMAIN = "porfilo.com";

async function loadMiddleware() {
  const m = await import("./middleware");
  return m.middleware;
}

function makeReq(
  host: string,
  pathname = "/",
  extraHeaders?: Record<string, string>,
): NextRequest {
  const url = new URL(`https://${host}${pathname}`);
  return new NextRequest(url, {
    headers: { host, ...extraHeaders },
  });
}

describe("middleware routing", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "porfilo.com";
  });

  it("passes through the bare root domain", async () => {
    const middleware = await loadMiddleware();
    const res = middleware(makeReq("porfilo.com"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("redirects www to apex", async () => {
    const middleware = await loadMiddleware();
    const res = middleware(makeReq("www.porfilo.com"));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toContain("porfilo.com");
  });

  it("passes through reserved subdomains", async () => {
    const middleware = await loadMiddleware();
    for (const sub of ["www", "app", "api", "customers"]) {
      const res = middleware(makeReq(`${sub}.porfilo.com`));
      if (sub === "www") {
        expect(res.status).toBe(308);
      } else {
        expect(res.headers.get("x-middleware-rewrite")).toBeNull();
      }
    }
  });

  it("rewrites <slug>.<root> → /sites-by-host/<full-host>", async () => {
    const middleware = await loadMiddleware();
    const res = middleware(makeReq("abc123.porfilo.com"));
    const rewrite = res.headers.get("x-middleware-rewrite");
    expect(rewrite).toBeTruthy();
    expect(rewrite).toContain("/sites-by-host/abc123.porfilo.com");
  });

  it("rewrites a custom domain → /sites-by-host/<host>", async () => {
    const middleware = await loadMiddleware();
    const res = middleware(makeReq("portfolio.max.com"));
    const rewrite = res.headers.get("x-middleware-rewrite");
    expect(rewrite).toBeTruthy();
    expect(rewrite).toContain("/sites-by-host/portfolio.max.com");
  });

  it("honors x-porfilo-host for worker bridge", async () => {
    const middleware = await loadMiddleware();
    const res = middleware(
      makeReq("porfilo.com", "/", { "x-porfilo-host": "max.com" }),
    );
    const rewrite = res.headers.get("x-middleware-rewrite");
    expect(rewrite).toContain("/sites-by-host/max.com");
  });

  it("preserves /engine/* on every host (never rewrites)", async () => {
    const middleware = await loadMiddleware();
    for (const host of ["porfilo.com", "abc.porfilo.com", "max.com"]) {
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
    expect(rewrite).toContain("/sites-by-host/abc.localhost");
  });

  it("does not treat the apex-only host as a slug", async () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "porfilo.com";
    vi.resetModules();
    const middleware = await loadMiddleware();
    const res = middleware(makeReq("porfilo.com", "/dashboard"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
