import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/generation-guard", () => ({
  tryAcquireGlobalSlot: vi.fn(),
  releaseGlobalSlot: vi.fn(),
}));
vi.mock("~/server/ratelimit", () => ({ limit: vi.fn() }));

import { admitGeneration } from "./generation-admission";

const lease = { kind: "generation", slot: 0, token: "lease-token" };

describe("generation admission", () => {
  it("does not charge global quota when no work slot is available", async () => {
    const chargeGlobal = vi.fn();
    const result = await admitGeneration({
      acquireSlot: vi.fn().mockResolvedValue(null),
      releaseSlot: vi.fn(),
      chargeGlobal,
    });

    expect(result).toEqual({ ok: false, retryAfter: 15 });
    expect(chargeGlobal).not.toHaveBeenCalled();
  });

  it("releases its slot if global quota is exhausted", async () => {
    const releaseSlot = vi.fn().mockResolvedValue(undefined);
    const result = await admitGeneration({
      acquireSlot: vi.fn().mockResolvedValue(lease),
      releaseSlot,
      chargeGlobal: vi.fn().mockResolvedValue({ ok: false, retryAfter: 42 }),
    });

    expect(result).toEqual({ ok: false, retryAfter: 42 });
    expect(releaseSlot).toHaveBeenCalledWith(lease);
  });
});
