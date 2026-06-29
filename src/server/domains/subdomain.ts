import { RESERVED_SUBDOMAIN_LABELS } from "./types";

export type SubdomainValidation =
  | { ok: true; label: string; hostname: string }
  | { ok: false; reason: string; suggestions?: string[] };

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Validate a free Porfilo subdomain label (e.g. "max" → max.porfilo.com).
 */
export function validateFreeSubdomainLabel(
  raw: string,
  rootDomain: string,
): SubdomainValidation {
  if (typeof raw !== "string") {
    return { ok: false, reason: "Enter a subdomain label." };
  }

  let label = raw.trim().toLowerCase();
  if (label.endsWith(`.${rootDomain.replace(/:\d+$/, "")}`)) {
    label = label.slice(0, label.indexOf("."));
  }

  if (!label) return { ok: false, reason: "Enter a subdomain label." };
  if (label.includes(".")) {
    return { ok: false, reason: "Enter only the label — no dots." };
  }
  if (label.includes(" ")) {
    return { ok: false, reason: "Subdomains can't contain spaces." };
  }
  if (label.length > 63) {
    return { ok: false, reason: "That label is too long (max 63 characters)." };
  }
  if (!LABEL_RE.test(label)) {
    return {
      ok: false,
      reason:
        "Use lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen.",
    };
  }
  if (RESERVED_SUBDOMAIN_LABELS.has(label)) {
    return {
      ok: false,
      reason: `"${label}" is reserved. Try a different label.`,
      suggestions: suggestAlternatives(label),
    };
  }

  const root = rootDomain.toLowerCase().replace(/:\d+$/, "");
  return { ok: true, label, hostname: `${label}.${root}` };
}

export function suggestAlternatives(label: string): string[] {
  const base = label.replace(/[^a-z0-9-]/g, "").slice(0, 50) || "my";
  const candidates = [
    `${base}-portfolio`,
    `${base}-site`,
    `my-${base}`,
    `${base}${Math.floor(Math.random() * 90 + 10)}`,
  ];
  return candidates.filter((c) => !RESERVED_SUBDOMAIN_LABELS.has(c)).slice(0, 3);
}
