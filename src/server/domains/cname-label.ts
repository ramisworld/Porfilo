/** Common multi-part public suffixes where apex = three labels (e.g. rami.co.nz). */
const MULTI_PART_PUBLIC_SUFFIXES = new Set([
  "co.nz",
  "co.uk",
  "org.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.jp",
  "com.br",
  "com.mx",
]);

/**
 * DNS host label for the CNAME row we show users (@ = apex).
 * portfolio.max.com → "portfolio"; rami.co.nz → "@"; max.com → "@".
 */
export function cnameLabel(hostname: string): string {
  const parts = hostname.toLowerCase().split(".");
  if (parts.length <= 2) return "@";

  const suffix2 = parts.slice(-2).join(".");
  if (MULTI_PART_PUBLIC_SUFFIXES.has(suffix2)) {
    if (parts.length === 3) return "@";
    return parts.slice(0, parts.length - 3).join(".");
  }

  if (parts.length === 3) return parts[0]!;
  return parts.slice(0, parts.length - 2).join(".");
}
