// PortHub Engine — issuer registry entry.
//
// Bundled into the engine via esbuild (see scripts/build-engine.mjs). Reads
// the single source of truth in src/lib/issuers.ts and exposes the lookups
// the runtime needs on window.PH:
//
//   PH.issuerLogoSrc(key)   → local SVG asset path, "" if unknown
//   PH.issuerLogoAlt(key)   → accessible alt text
//   PH.issuerLogoKind(key)  → "brand" or "generic"
//   PH.issuerLogoMark(key)  → "square", "wide", or "tall"
//   PH.issuerColor(key)     → brand accent color (#RRGGBB), "" if unknown
//   PH.normalizeIssuerKey(input) → canonical issuer key, "" if unknown
//
// Centralizing the manifest in TS means the React editor and the iframe
// runtime share the same local assets and fallbacks.

import { ISSUER_BY_KEY, resolveCredentialIssuerKey } from "~/lib/issuers";

type PHWindow = Window & {
  PH?: {
    issuerLogoSrc?: (key: string) => string;
    issuerLogoAlt?: (key: string) => string;
    issuerLogoKind?: (key: string) => string;
    issuerLogoMark?: (key: string) => string;
    issuerLogoTile?: (key: string) => string;
    issuerColor?: (key: string) => string;
    issuerFallbackSrc?: () => string;
    normalizeIssuerKey?: (value: string) => string;
  };
};

const w = window as PHWindow;
const PH = (w.PH ??= {});

const issuer = (key: string) => {
  if (!key) return undefined;
  return ISSUER_BY_KEY[key.toLowerCase() as keyof typeof ISSUER_BY_KEY];
};

PH.issuerLogoSrc = (key: string): string => {
  return issuer(key)?.src ?? "";
};

PH.issuerLogoAlt = (key: string): string => {
  return issuer(key)?.alt ?? "";
};

PH.issuerLogoKind = (key: string): string => {
  return issuer(key)?.logoKind ?? "";
};

PH.issuerLogoMark = (key: string): string => {
  return issuer(key)?.mark ?? "";
};

PH.issuerLogoTile = (key: string): string => {
  return issuer(key)?.tile ?? "";
};

PH.issuerColor = (key: string): string => {
  return issuer(key)?.color ?? "";
};

PH.issuerFallbackSrc = (): string => {
  return "/brand/credentials/fallback-certificate.svg";
};

PH.normalizeIssuerKey = (value: string): string => {
  return resolveCredentialIssuerKey(value) ?? "";
};
