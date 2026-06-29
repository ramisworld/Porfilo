import { describe, expect, it } from "vitest";
import { mapCustomToDisplay, toDisplayStatus } from "./status-display";
import type { CustomDomain } from "../../../generated/prisma";

function customRow(
  overrides: Partial<CustomDomain> = {},
): CustomDomain {
  return {
    id: "d1",
    portfolioId: "p1",
    hostname: "max.com",
    type: "custom_domain",
    cfHostnameId: "cf-1",
    railwayDomainId: null,
    cnameHost: null,
    cnameTarget: "customers.porfilo.com",
    verificationHost: null,
    verificationToken: null,
    status: "pending_dns",
    dnsVerified: false,
    httpVerified: false,
    ownershipStatus: "pending",
    sslStatus: "pending_validation",
    errorReason: null,
    activatedAt: null,
    lastCheckedAt: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("mapCustomToDisplay", () => {
  const target = "customers.porfilo.com";

  it("never marks active without dns, cf, ssl, and http", () => {
    const result = mapCustomToDisplay({
      cfMissing: false,
      cfActive: true,
      sslActive: true,
      dnsOk: true,
      httpOk: false,
      cfStatus: "active",
      sslStatus: "active",
      cfBlocked: false,
      cnameTarget: target,
    });
    expect(result.displayStatus).toBe("CUSTOM_DOMAIN_VERIFYING_SSL");
  });

  it("returns active when every check passes", () => {
    const result = mapCustomToDisplay({
      cfMissing: false,
      cfActive: true,
      sslActive: true,
      dnsOk: true,
      httpOk: true,
      cfStatus: "active",
      sslStatus: "active",
      cfBlocked: false,
      cnameTarget: target,
    });
    expect(result.displayStatus).toBe("CUSTOM_DOMAIN_ACTIVE");
    expect(result.dbStatus).toBe("active");
  });

  it("surfaces wrong DNS when ownership is active but DNS is not", () => {
    const result = mapCustomToDisplay({
      cfMissing: false,
      cfActive: true,
      sslActive: false,
      dnsOk: false,
      httpOk: false,
      cfStatus: "active",
      sslStatus: "pending_validation",
      cfBlocked: false,
      cnameTarget: target,
    });
    expect(result.displayStatus).toBe("CUSTOM_DOMAIN_PENDING_DNS");
    expect(result.errorReason).toContain(target);
  });

  it("does not claim wrong DNS before ownership is verified", () => {
    const result = mapCustomToDisplay({
      cfMissing: false,
      cfActive: false,
      sslActive: false,
      dnsOk: false,
      httpOk: false,
      cfStatus: "pending",
      sslStatus: "pending_validation",
      cfBlocked: false,
      cnameTarget: target,
    });
    expect(result.errorReason).toBeNull();
  });
});

describe("toDisplayStatus", () => {
  it("returns NONE for null", () => {
    expect(toDisplayStatus(null)).toBe("NONE");
  });

  it("returns free subdomain active for free rows", () => {
    expect(
      toDisplayStatus(
        customRow({ type: "free_subdomain", status: "active", hostname: "max.porfilo.com" }),
      ),
    ).toBe("FREE_SUBDOMAIN_ACTIVE");
  });

  it("requires dns and http flags for custom active", () => {
    expect(
      toDisplayStatus(
        customRow({
          status: "active",
          dnsVerified: true,
          httpVerified: false,
        }),
      ),
    ).toBe("CUSTOM_DOMAIN_PENDING_DNS");
  });

  it("returns custom active only when fully verified in DB", () => {
    expect(
      toDisplayStatus(
        customRow({
          status: "active",
          dnsVerified: true,
          httpVerified: true,
        }),
      ),
    ).toBe("CUSTOM_DOMAIN_ACTIVE");
  });

  it("maps verifying db status", () => {
    expect(toDisplayStatus(customRow({ status: "verifying" }))).toBe(
      "CUSTOM_DOMAIN_VERIFYING_SSL",
    );
  });
});
