import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PORFILO_FAVICON_ID,
  porfiloMarkSvgString,
} from "~/lib/porfilo-mark-string";
import {
  appOrigin,
  customDomainCnameTarget,
  freeSubdomainFqdn,
  freeSubdomainSuffix,
  publicHostnameUrl,
  rootDomainHost,
} from "~/lib/root-domain";

describe("root-domain", () => {
  it("strips port from host", () => {
    expect(rootDomainHost("localhost:3000")).toBe("localhost");
    expect(rootDomainHost("porfilo.com")).toBe("porfilo.com");
  });

  it("builds dev and prod origins", () => {
    expect(appOrigin("localhost:3000")).toBe("http://localhost:3000");
    expect(appOrigin("porfilo.com")).toBe("https://porfilo.com");
  });

  it("builds free subdomain fqdn and suffix", () => {
    expect(freeSubdomainFqdn("max", "porfilo.com")).toBe("max.porfilo.com");
    expect(freeSubdomainSuffix("localhost:3000")).toBe(".localhost:3000");
  });

  it("defaults cname target from root domain", () => {
    expect(customDomainCnameTarget("porfilo.com")).toBe(
      "customers.porfilo.com",
    );
  });

  it("uses https for custom hosts in prod", () => {
    expect(publicHostnameUrl("max.com", "porfilo.com")).toBe("https://max.com");
  });
});

describe("brand icons", () => {
  it("keeps icon.svg in sync with porfiloMarkSvgString", () => {
    const iconPath = join(process.cwd(), "src/app/icon.svg");
    const onDisk = readFileSync(iconPath, "utf8");
    const expected = porfiloMarkSvgString(PORFILO_FAVICON_ID, 32);
    expect(onDisk).toBe(expected);
  });
});
