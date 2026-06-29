/** Normalized domain states returned to the UI. */
export type DomainDisplayStatus =
  | "NONE"
  | "FREE_SUBDOMAIN_ACTIVE"
  | "CUSTOM_DOMAIN_PENDING_DNS"
  | "CUSTOM_DOMAIN_VERIFYING_SSL"
  | "CUSTOM_DOMAIN_ACTIVE"
  | "CUSTOM_DOMAIN_FAILED";

export type DomainType = "free_subdomain" | "custom_domain";

/** Internal DB status values for CustomDomain.status */
export type DomainDbStatus =
  | "pending_dns"
  | "verifying"
  | "active"
  | "action_needed"
  | "error";

export interface DomainCheckResult {
  displayStatus: DomainDisplayStatus;
  dbStatus: DomainDbStatus;
  errorReason: string | null;
  dnsVerified: boolean;
  httpVerified: boolean;
  ownershipStatus: string | null;
  sslStatus: string | null;
  verificationHost: string | null;
  verificationToken: string | null;
}

export const RESERVED_SUBDOMAIN_LABELS = new Set([
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

/** User-facing label for each display status. */
export function displayStatusLabel(status: DomainDisplayStatus): string {
  switch (status) {
    case "NONE":
      return "No domain";
    case "FREE_SUBDOMAIN_ACTIVE":
      return "Free subdomain live";
    case "CUSTOM_DOMAIN_PENDING_DNS":
      return "Waiting for DNS";
    case "CUSTOM_DOMAIN_VERIFYING_SSL":
      return "Issuing SSL";
    case "CUSTOM_DOMAIN_ACTIVE":
      return "Domain connected";
    case "CUSTOM_DOMAIN_FAILED":
      return "Action needed";
  }
}

/** Short hint shown on the dashboard tile. */
export function displayStatusHint(status: DomainDisplayStatus): string {
  switch (status) {
    case "NONE":
      return "Choose a URL";
    case "FREE_SUBDOMAIN_ACTIVE":
      return "Live";
    case "CUSTOM_DOMAIN_PENDING_DNS":
      return "Domain pending";
    case "CUSTOM_DOMAIN_VERIFYING_SSL":
      return "Verifying…";
    case "CUSTOM_DOMAIN_ACTIVE":
      return "Live";
    case "CUSTOM_DOMAIN_FAILED":
      return "Action needed";
  }
}

export function isPendingDisplayStatus(status: DomainDisplayStatus): boolean {
  return (
    status === "CUSTOM_DOMAIN_PENDING_DNS" ||
    status === "CUSTOM_DOMAIN_VERIFYING_SSL"
  );
}
