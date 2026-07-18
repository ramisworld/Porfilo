import "server-only";
import {
  releaseGlobalSlot,
  tryAcquireGlobalSlot,
} from "~/server/generation-guard";
import { limit } from "~/server/ratelimit";
import type { WorkLease } from "~/server/work-slots";

type AdmissionDependencies = {
  acquireSlot: typeof tryAcquireGlobalSlot;
  releaseSlot: typeof releaseGlobalSlot;
  chargeGlobal: () => ReturnType<typeof limit>;
};

const defaults: AdmissionDependencies = {
  acquireSlot: tryAcquireGlobalSlot,
  releaseSlot: releaseGlobalSlot,
  chargeGlobal: () =>
    limit("gen:global:hour", {
      window: "1h",
      max: Number(process.env.GLOBAL_GENERATIONS_PER_HOUR ?? 120),
    }),
};

export type GenerationAdmission =
  | { ok: true; lease: WorkLease }
  | { ok: false; retryAfter: number };

/** Scarce slot first, quota second: rejected work cannot consume global quota. */
export async function admitGeneration(
  dependencies: AdmissionDependencies = defaults,
): Promise<GenerationAdmission> {
  const lease = await dependencies.acquireSlot();
  if (!lease) return { ok: false, retryAfter: 15 };

  const global = await dependencies.chargeGlobal();
  if (!global.ok) {
    await dependencies.releaseSlot(lease);
    return { ok: false, retryAfter: global.retryAfter };
  }

  return { ok: true, lease };
}
