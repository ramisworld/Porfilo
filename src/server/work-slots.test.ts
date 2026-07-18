import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  upsert: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: { workSlot: { upsert: h.upsert, updateMany: h.updateMany } },
}));

import { releaseWorkSlot, tryAcquireWorkSlot } from "./work-slots";

describe("cross-replica work slots", () => {
  beforeEach(() => vi.clearAllMocks());

  it("claims the first available slot atomically", async () => {
    h.upsert.mockResolvedValue({});
    h.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const lease = await tryAcquireWorkSlot({
      kind: "generation",
      maxConcurrent: 2,
      leaseMs: 60_000,
    });

    expect(lease).toMatchObject({ kind: "generation", slot: 1 });
    expect(h.updateMany).toHaveBeenCalledTimes(2);
  });

  it("only releases the matching lease token", async () => {
    h.updateMany.mockResolvedValue({ count: 1 });
    await releaseWorkSlot({ kind: "hero", slot: 0, token: "ours" });

    expect(h.updateMany).toHaveBeenCalledWith({
      where: { kind: "hero", slot: 0, token: "ours" },
      data: { token: null, expiresAt: null },
    });
  });
});
