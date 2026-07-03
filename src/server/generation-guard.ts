import "server-only";

/**
 * Absolute, IP-independent ceiling on concurrent LLM generations.
 *
 * The per-IP / per-user rate limits in the generate route are the first line of
 * defence, but they key on a client-derived identity. This guard is a hard cap
 * that holds even if that identity is spoofed: at most `MAX_CONCURRENT`
 * generations may run at once across the whole process. Combined with the daily
 * budget kill-switch (see `~/server/llm/cost`), it bounds worst-case spend.
 *
 * In-process only — correct for a single instance. Move to a shared store
 * (Redis/Upstash) alongside the rate limiter when going multi-instance.
 */
const MAX_CONCURRENT = Math.max(
  1,
  Number(process.env.MAX_CONCURRENT_GENERATIONS ?? 4),
);

let inFlight = 0;

/** Reserve a generation slot. Returns false when the process is at capacity. */
export function tryAcquireGlobalSlot(): boolean {
  if (inFlight >= MAX_CONCURRENT) return false;
  inFlight += 1;
  return true;
}

/** Release a previously acquired slot. Safe to call at most once per acquire. */
export function releaseGlobalSlot(): void {
  if (inFlight > 0) inFlight -= 1;
}

export function currentInFlight(): number {
  return inFlight;
}
