import "server-only";
import { isIP } from "node:net";

export type TrustedIpHeader =
  | "x-forwarded-for"
  | "cf-connecting-ip"
  | "x-real-ip";

function validIp(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : null;
}

function rightmostForwardedIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const hops = forwarded.split(",");
  for (let index = hops.length - 1; index >= 0; index -= 1) {
    const candidate = validIp(hops[index]);
    if (candidate) return candidate;
  }
  return null;
}

/**
 * Return the client identity supplied by the one explicitly trusted ingress.
 *
 * The default is Railway's rightmost X-Forwarded-For hop. We intentionally
 * ignore CF-Connecting-IP and X-Real-IP unless the deployment opts into one of
 * them: accepting several caller-controlled alternatives lets attackers rotate
 * headers and evade rate limits.
 *
 * If `TRUSTED_IP_HEADER=cf-connecting-ip`, every public path to the service must
 * be behind Cloudflare and the direct Railway hostname must be disabled.
 */
export function clientIp(
  headers: Headers,
  trustedHeader: TrustedIpHeader = (process.env.TRUSTED_IP_HEADER as
    | TrustedIpHeader
    | undefined) ?? "x-forwarded-for",
): string {
  if (trustedHeader === "cf-connecting-ip") {
    return validIp(headers.get("cf-connecting-ip")) ?? "unknown";
  }
  if (trustedHeader === "x-real-ip") {
    return validIp(headers.get("x-real-ip")) ?? "unknown";
  }
  return rightmostForwardedIp(headers) ?? "unknown";
}
