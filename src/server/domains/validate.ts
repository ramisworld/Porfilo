/**
 * Hostname validation for user-supplied custom domains.
 *
 * Pure & sync — no side effects, no env access. Safe to import anywhere and
 * trivial to unit-test (see ./validate.test.ts).
 *
 * We're deliberately stricter than the RFC 1035 max — Cloudflare for SaaS
 * already enforces its own bounds, and rejecting weirdness early gives the
 * user a clear local error instead of a cryptic CF response.
 */

export type HostnameValidation =
  | { ok: true; hostname: string }
  | { ok: false; reason: string };

const LABEL_RE = /^(?!-)[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i;
const IP_RE =
  /^(?:\d{1,3}\.){3}\d{1,3}$|^\[?[\da-f:]+\]?$/i;

/**
 * Normalize + reject anything we don't want as a custom domain. `rootDomain`
 * is the app's own root (e.g. `porfilo.com`) — we never let a user claim it
 * or any of its subdomains as their own.
 */
export function validateHostname(
  raw: string,
  rootDomain: string,
): HostnameValidation {
  if (typeof raw !== "string") {
    return { ok: false, reason: "Enter a domain." };
  }

  // Lowercase, strip whitespace, strip a protocol if the user pasted one,
  // strip a trailing slash and any path. We want bare `host` only.
  let host = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  if (!host) return { ok: false, reason: "Enter a domain." };

  // Strip a single trailing dot (canonical form has none).
  if (host.endsWith(".")) host = host.slice(0, -1);

  if (host.length > 253) {
    return { ok: false, reason: "That domain is too long." };
  }

  if (host.includes(" ")) {
    return { ok: false, reason: "Domains can't contain spaces." };
  }

  if (host === "localhost" || host.endsWith(".localhost")) {
    return { ok: false, reason: "localhost can't be used." };
  }

  if (IP_RE.test(host)) {
    return { ok: false, reason: "Use a domain name, not an IP address." };
  }

  const labels = host.split(".");
  if (labels.length < 2) {
    return { ok: false, reason: "Enter a full domain like example.com." };
  }

  for (const label of labels) {
    if (!LABEL_RE.test(label)) {
      return {
        ok: false,
        reason:
          "Use only letters, numbers and dashes. Each part must start and end with a letter or number.",
      };
    }
  }

  // No user may claim the app root (or any sub of it) as their custom domain.
  const root = rootDomain.toLowerCase().replace(/:\d+$/, "");
  if (host === root || host.endsWith(`.${root}`)) {
    return {
      ok: false,
      reason:
        "That domain is part of Porfilo. Use a domain you own (e.g. your.com).",
    };
  }

  return { ok: true, hostname: host };
}
