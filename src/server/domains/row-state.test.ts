import { describe, expect, it } from "vitest";
import {
  DOMAIN_REFRESH_INTERVAL_MS,
  isCustomDomainFullyLive,
  shouldRefreshCustomDomain,
} from "./row-state";
import type { CustomDomain } from "../../../generated/prisma";

function row(overrides: Partial<CustomDomain> = {}): CustomDomain {
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
    lastCheckedAt: new Date(Date.now() - DOMAIN_REFRESH_INTERVAL_MS - 1),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("row-state", () => {
  it("treats fully verified custom domains as live", () => {
    expect(
      isCustomDomainFullyLive(
        row({
          status: "active",
          dnsVerified: true,
          httpVerified: true,
        }),
      ),
    ).toBe(true);
  });

  it("does not refresh free subdomains", () => {
    expect(
      shouldRefreshCustomDomain(
        row({ type: "free_subdomain", status: "active" }),
      ),
    ).toBe(false);
  });

  it("does not refresh live custom domains", () => {
    expect(
      shouldRefreshCustomDomain(
        row({
          status: "active",
          dnsVerified: true,
          httpVerified: true,
        }),
      ),
    ).toBe(false);
  });

  it("refreshes pending custom domains after the interval", () => {
    expect(shouldRefreshCustomDomain(row())).toBe(true);
  });

  it("skips refresh when checked recently", () => {
    expect(
      shouldRefreshCustomDomain(row({ lastCheckedAt: new Date() })),
    ).toBe(false);
  });
});
