import type { CustomDomain } from "../../../generated/prisma";
import {
  type DomainDbStatus,
  type DomainDisplayStatus,
} from "./types";

export function mapCustomToDisplay(input: {
  cfMissing: boolean;
  cfActive: boolean;
  sslActive: boolean;
  dnsOk: boolean;
  httpOk: boolean;
  cfStatus: string;
  sslStatus: string | null;
  cfBlocked: boolean;
  cnameTarget: string;
}): {
  displayStatus: DomainDisplayStatus;
  dbStatus: DomainDbStatus;
  errorReason: string | null;
} {
  if (input.cfMissing || input.cfBlocked) {
    return {
      displayStatus: "CUSTOM_DOMAIN_FAILED",
      dbStatus: input.cfMissing ? "error" : "action_needed",
      errorReason: input.cfMissing
        ? "Cloudflare no longer has this hostname registered."
        : "Domain verification failed. Check your DNS records.",
    };
  }

  if (!input.dnsOk) {
    const wrongRecord = input.cfActive;
    return {
      displayStatus: "CUSTOM_DOMAIN_PENDING_DNS",
      dbStatus: "pending_dns",
      errorReason: wrongRecord
        ? `We detected the wrong DNS record. Point your CNAME to ${input.cnameTarget}.`
        : null,
    };
  }

  if (!input.cfActive || !input.sslActive) {
    const verifyingOwnership =
      input.cfStatus.startsWith("pending") && input.cfStatus !== "pending_blocked";
    return {
      displayStatus: verifyingOwnership
        ? "CUSTOM_DOMAIN_PENDING_DNS"
        : "CUSTOM_DOMAIN_VERIFYING_SSL",
      dbStatus: "verifying",
      errorReason: null,
    };
  }

  if (!input.httpOk) {
    return {
      displayStatus: "CUSTOM_DOMAIN_VERIFYING_SSL",
      dbStatus: "verifying",
      errorReason: null,
    };
  }

  return {
    displayStatus: "CUSTOM_DOMAIN_ACTIVE",
    dbStatus: "active",
    errorReason: null,
  };
}

export function toDisplayStatus(
  row: CustomDomain | null,
): DomainDisplayStatus {
  if (!row) return "NONE";
  if (row.type === "free_subdomain" && row.status === "active") {
    return "FREE_SUBDOMAIN_ACTIVE";
  }
  if (
    row.status === "active" &&
    row.dnsVerified &&
    row.httpVerified
  ) {
    return "CUSTOM_DOMAIN_ACTIVE";
  }
  switch (row.status) {
    case "pending_dns":
    case "pending":
      return "CUSTOM_DOMAIN_PENDING_DNS";
    case "verifying":
      return "CUSTOM_DOMAIN_VERIFYING_SSL";
    case "action_needed":
    case "error":
      return "CUSTOM_DOMAIN_FAILED";
    default:
      return "CUSTOM_DOMAIN_PENDING_DNS";
  }
}
