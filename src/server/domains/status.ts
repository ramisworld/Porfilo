import "server-only";
import { promises as dns } from "node:dns";
import type { CustomDomain } from "../../../generated/prisma";
import { env } from "~/env";
import { cfGetHostname, type CfHostname } from "./cloudflare";
import {
  type DomainCheckResult,
  type DomainType,
} from "./types";
import { mapCustomToDisplay } from "./status-display";

export { mapCustomToDisplay, toDisplayStatus } from "./status-display";

function cnameTarget(): string {
  return (
    env.NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET ?? "customers.porfilo.com"
  );
}

function extractTxt(cf: CfHostname): { host: string; value: string } | null {
  const ssl = cf.sslValidationRecords.find((r) => r.txtName && r.txtValue);
  if (ssl?.txtName && ssl.txtValue) {
    return { host: ssl.txtName, value: ssl.txtValue };
  }
  const ov = cf.ownershipVerification;
  if (ov?.type === "txt" && ov.name && ov.value) {
    return { host: ov.name, value: ov.value };
  }
  return null;
}

async function dnsPointsToTarget(
  hostname: string,
  target: string,
): Promise<boolean> {
  const normalizedTarget = target.toLowerCase().replace(/\.$/, "");
  try {
    const cnames = await dns.resolveCname(hostname);
    if (
      cnames.some((r) => {
        const v = r.toLowerCase().replace(/\.$/, "");
        return v === normalizedTarget || v.endsWith(`.${normalizedTarget}`);
      })
    ) {
      return true;
    }
  } catch {
    /* fall through — apex may not have CNAME */
  }

  try {
    const targetIps = new Set([
      ...(await dns.resolve4(normalizedTarget).catch(() => [])),
      ...(await dns.resolve6(normalizedTarget).catch(() => [])),
    ]);
    if (targetIps.size === 0) return false;
    const hostIps = [
      ...(await dns.resolve4(hostname).catch(() => [])),
      ...(await dns.resolve6(hostname).catch(() => [])),
    ];
    return hostIps.some((ip) => targetIps.has(ip));
  } catch {
    return false;
  }
}

async function httpReachable(hostname: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`https://${hostname}/`, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Porfilo-DomainCheck/1.0" },
    });
    return res.status >= 200 && res.status < 500;
  } catch {
    try {
      const res = await fetch(`https://${hostname}/`, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": "Porfilo-DomainCheck/1.0" },
      });
      return res.status >= 200 && res.status < 500;
    } catch {
      return false;
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve display status when no domain row exists. */
export function noneStatus(): DomainCheckResult {
  return {
    displayStatus: "NONE",
    dbStatus: "pending_dns",
    errorReason: null,
    dnsVerified: false,
    httpVerified: false,
    ownershipStatus: null,
    sslStatus: null,
    verificationHost: null,
    verificationToken: null,
  };
}

/** Free subdomains are active immediately — no external checks. */
export function freeSubdomainStatus(_row: CustomDomain): DomainCheckResult {
  return {
    displayStatus: "FREE_SUBDOMAIN_ACTIVE",
    dbStatus: "active",
    errorReason: null,
    dnsVerified: true,
    httpVerified: true,
    ownershipStatus: "active",
    sslStatus: "active",
    verificationHost: null,
    verificationToken: null,
  };
}

/**
 * Run all verification checks for a custom domain and return normalized status.
 * Never returns CUSTOM_DOMAIN_ACTIVE unless every check passes.
 */
export async function checkDomainStatus(
  row: CustomDomain,
): Promise<DomainCheckResult> {
  const type = row.type as DomainType;
  if (type === "free_subdomain") {
    return freeSubdomainStatus(row);
  }

  const target = row.cnameTarget ?? cnameTarget();
  let cf: CfHostname | null = null;
  let cfMissing = false;

  if (row.cfHostnameId) {
    try {
      cf = await cfGetHostname(row.cfHostnameId);
    } catch {
      cfMissing = true;
    }
  } else {
    cfMissing = true;
  }

  const txt = cf ? extractTxt(cf) : null;
  const ownershipStatus = cf?.status ?? row.ownershipStatus ?? "pending";
  const sslStatus = cf?.sslStatus ?? row.sslStatus ?? "pending";
  const cfActive = ownershipStatus === "active";
  const sslActive = sslStatus === "active";
  const cfBlocked =
    ownershipStatus === "pending_blocked" ||
    ownershipStatus === "pending_migration" ||
    ownershipStatus === "moved" ||
    ownershipStatus === "deleted" ||
    sslStatus === "validation_timed_out" ||
    sslStatus === "deleted";

  const dnsOk = await dnsPointsToTarget(row.hostname, target);
  const httpOk = dnsOk && cfActive && sslActive
    ? await httpReachable(row.hostname)
    : false;

  const mapped = mapCustomToDisplay({
    cfMissing,
    cfActive,
    sslActive,
    dnsOk,
    httpOk,
    cfStatus: ownershipStatus,
    sslStatus,
    cfBlocked,
    cnameTarget: target,
  });

  return {
    ...mapped,
    dnsVerified: dnsOk,
    httpVerified: httpOk,
    ownershipStatus,
    sslStatus,
    verificationHost: txt?.host ?? row.verificationHost,
    verificationToken: txt?.value ?? row.verificationToken,
  };
}
