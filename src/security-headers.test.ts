import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function productionCsp(): Promise<string> {
  vi.resetModules();
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "porfilo.com";

  const { default: config } = await import("../next.config.js");
  const headerGroups = await config.headers?.();
  const globalHeaders = headerGroups?.find(
    (group) => group.source === "/:path*",
  );

  return (
    globalHeaders?.headers.find(
      (header) => header.key === "Content-Security-Policy",
    )?.value ?? ""
  );
}

describe("production security headers", () => {
  beforeEach(() => {
    delete process.env.SKIP_ENV_VALIDATION;
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  });

  afterEach(() => {
    delete process.env.SKIP_ENV_VALIDATION;
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  });

  it("allows the canonical engine origin for scripts and styles", async () => {
    const csp = await productionCsp();

    expect(csp).toContain(
      "script-src 'self' 'unsafe-inline' https://porfilo.com",
    );
    expect(csp).toContain(
      "style-src 'self' 'unsafe-inline' https://porfilo.com",
    );
    expect(csp).not.toContain("'unsafe-eval'");
  });
});
