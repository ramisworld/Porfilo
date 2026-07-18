import "server-only";
import {
  releaseWorkSlot,
  tryAcquireWorkSlot,
  type WorkLease,
} from "~/server/work-slots";

const GENERATION_LEASE_MS = 15 * 60 * 1000;
const MAX_CONCURRENT_GENERATIONS = Number(
  process.env.MAX_CONCURRENT_GENERATIONS ?? 4,
);

/** Reserve one cross-replica generation slot before charging global quota. */
export function tryAcquireGlobalSlot(): Promise<WorkLease | null> {
  return tryAcquireWorkSlot({
    kind: "generation",
    maxConcurrent: MAX_CONCURRENT_GENERATIONS,
    leaseMs: GENERATION_LEASE_MS,
  });
}

export function releaseGlobalSlot(lease: WorkLease): Promise<void> {
  return releaseWorkSlot(lease);
}
