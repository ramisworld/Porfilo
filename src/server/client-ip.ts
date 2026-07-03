import "server-only";

/**
 * Best-effort real client IP for rate-limiting / abuse controls.
 *
 * SECURITY: the *leftmost* `X-Forwarded-For` value is client-controlled — a
 * caller can send `X-Forwarded-For: <random>` and, since each distinct value
 * lands in its own rate-limit bucket, trivially bypass any per-IP limit. We
 * therefore never trust the leftmost entry. Instead we prefer headers that our
 * edge overwrites (and a client cannot forge through it), and only fall back to
 * the *rightmost* XFF hop — the one appended by the closest trusted proxy.
 *
 * Priority:
 *   1. `cf-connecting-ip`  — set+overwritten by Cloudflare (true client IP).
 *   2. `x-real-ip`         — set by a single trusted reverse proxy (nginx/Railway).
 *   3. rightmost `x-forwarded-for` hop — appended by the nearest proxy.
 *   4. `"local"`           — no proxy headers (local dev).
 */
export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }

  return "local";
}
