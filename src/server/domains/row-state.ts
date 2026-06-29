import type { CustomDomain } from "../../../generated/prisma";

/** Minimum interval between automatic background status checks (ms). */
export const DOMAIN_REFRESH_INTERVAL_MS = 6_000;

/** Custom domain is fully live — safe to serve traffic. */
export function isCustomDomainFullyLive(row: CustomDomain): boolean {
  return (
    row.type === "custom_domain" &&
    row.status === "active" &&
    row.dnsVerified &&
    row.httpVerified
  );
}

/** Whether a background refresh should run for this row. */
export function shouldRefreshCustomDomain(row: CustomDomain): boolean {
  if (row.type !== "custom_domain") return false;
  if (isCustomDomainFullyLive(row)) return false;

  const last = row.lastCheckedAt?.getTime() ?? 0;
  return Date.now() - last >= DOMAIN_REFRESH_INTERVAL_MS;
}
