import "server-only";
import { env } from "~/env";

/**
 * Thin Cloudflare for SaaS client — Custom Hostnames API only.
 * Docs: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/
 *
 * Three operations are enough for the MVP:
 *   create  — register a user-owned hostname (returns ownership token + ssl records)
 *   get     — poll status (ownership_status, ssl.status)
 *   delete  — remove the hostname (called on user remove / failed creation)
 *
 * We intentionally don't expose CF's internal data shape to the rest of the
 * app — every export returns a normalized object.
 */

const CF_BASE = "https://api.cloudflare.com/client/v4";

/** Local view of a CF custom hostname. Stable shape callers can rely on. */
export interface CfHostname {
  id: string;
  hostname: string;
  status: string;
  ownershipVerification: {
    name: string;
    value: string;
    type: string;
  } | null;
  sslStatus: string | null;
  sslValidationRecords: Array<{
    txtName?: string;
    txtValue?: string;
    httpUrl?: string;
    httpBody?: string;
  }>;
}

/** Thrown when CF is not configured (token/zone missing). The caller decides
 *  whether to surface this to the user or treat it as 500. */
export class CloudflareDisabledError extends Error {
  constructor() {
    super("Custom domains are not enabled on this deployment yet.");
    this.name = "CloudflareDisabledError";
  }
}

/** Thrown for any 4xx/5xx from CF, with the first error message extracted. */
export class CloudflareApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "CloudflareApiError";
    this.status = status;
  }
}

function ensureConfig(): { zoneId: string; token: string } {
  if (!env.CLOUDFLARE_ZONE_ID || !env.CLOUDFLARE_API_TOKEN) {
    throw new CloudflareDisabledError();
  }
  return { zoneId: env.CLOUDFLARE_ZONE_ID, token: env.CLOUDFLARE_API_TOKEN };
}

interface CfEnvelope<T> {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  result: T;
}

type RawHostname = {
  id: string;
  hostname: string;
  status: string;
  ownership_verification?: { name?: string; value?: string; type?: string };
  ssl?: {
    status?: string;
    validation_records?: Array<{
      txt_name?: string;
      txt_value?: string;
      http_url?: string;
      http_body?: string;
    }>;
  };
};

function normalize(raw: RawHostname): CfHostname {
  const ov = raw.ownership_verification;
  const records = raw.ssl?.validation_records ?? [];
  return {
    id: raw.id,
    hostname: raw.hostname,
    status: raw.status,
    ownershipVerification:
      ov?.name && ov.value && ov.type
        ? { name: ov.name, value: ov.value, type: ov.type }
        : null,
    sslStatus: raw.ssl?.status ?? null,
    sslValidationRecords: records.map((r) => ({
      txtName: r.txt_name,
      txtValue: r.txt_value,
      httpUrl: r.http_url,
      httpBody: r.http_body,
    })),
  };
}

async function cfRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { zoneId, token } = ensureConfig();
  const res = await fetch(`${CF_BASE}/zones/${zoneId}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    cache: "no-store",
  });

  // 404 on GET = hostname removed externally. The caller usually wants to
  // know that as a distinct condition; re-throw with the original status.
  const text = await res.text();
  let envelope: CfEnvelope<T> | null = null;
  try {
    envelope = text ? (JSON.parse(text) as CfEnvelope<T>) : null;
  } catch {
    // ignored — fall through to status-based error below
  }

  if (!res.ok || !envelope?.success) {
    const msg =
      envelope?.errors?.[0]?.message ?? `Cloudflare error ${res.status}`;
    throw new CloudflareApiError(res.status, msg);
  }
  return envelope.result;
}

/**
 * Register a custom hostname with CF for SaaS.
 *
 * Uses TXT-based ownership verification + Delegated DCV (Domain Control
 * Validation). This is the friendliest combo for end users: they add a CNAME
 * + one TXT record, and CF handles both certificate issuance and ownership
 * proof from those records alone — no HTTP file or email round-trip.
 */
export async function cfCreateHostname(hostname: string): Promise<CfHostname> {
  const raw = await cfRequest<RawHostname>("/custom_hostnames", {
    method: "POST",
    body: JSON.stringify({
      hostname,
      ssl: {
        method: "txt",
        type: "dv",
        settings: { min_tls_version: "1.2" },
      },
    }),
  });
  return normalize(raw);
}

/** Look up an existing custom hostname by exact hostname (for 409 recovery). */
export async function cfFindHostname(
  hostname: string,
): Promise<CfHostname | null> {
  const list = await cfRequest<RawHostname[]>(
    `/custom_hostnames?hostname=${encodeURIComponent(hostname)}`,
  );
  const match = list.find(
    (row) => row.hostname.toLowerCase() === hostname.toLowerCase(),
  );
  return match ? normalize(match) : null;
}

/**
 * Register a hostname or reuse the existing Cloudflare row if already present.
 */
export async function cfCreateOrGetHostname(
  hostname: string,
): Promise<CfHostname> {
  try {
    return await cfCreateHostname(hostname);
  } catch (err) {
    if (err instanceof CloudflareApiError && err.status === 409) {
      const existing = await cfFindHostname(hostname);
      if (existing) return existing;
    }
    throw err;
  }
}

export async function cfGetHostname(id: string): Promise<CfHostname> {
  const raw = await cfRequest<RawHostname>(`/custom_hostnames/${id}`);
  return normalize(raw);
}

export async function cfDeleteHostname(id: string): Promise<void> {
  // CF returns `{ id }` on delete; we don't need the body.
  await cfRequest<{ id: string }>(`/custom_hostnames/${id}`, {
    method: "DELETE",
  });
}

/**
 * Roll the CF hostname's two sub-statuses up to one of our four states.
 * Exported for unit testing — the values come straight from `cfGetHostname`.
 */
export function rollupStatus(input: {
  status: string;
  sslStatus: string | null;
}): "pending" | "active" | "action_needed" | "error" {
  const { status, sslStatus } = input;
  if (status === "active" && sslStatus === "active") return "active";
  if (status === "moved" || status === "deleted") return "error";
  if (
    status === "pending_blocked" ||
    status === "pending_migration" ||
    sslStatus === "validation_timed_out" ||
    sslStatus === "deleted"
  ) {
    return "action_needed";
  }
  return "pending";
}
