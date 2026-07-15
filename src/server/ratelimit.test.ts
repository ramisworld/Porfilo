import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
}));

vi.mock("~/server/db", () => ({
  db: {
    rateLimitBucket: {
      upsert: mocks.upsert,
      deleteMany: mocks.deleteMany,
    },
  },
}));

import { limit } from "./ratelimit";

describe("persistent rate limiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows hits through the configured maximum", async () => {
    mocks.upsert.mockResolvedValue({ hits: 3 });
    await expect(
      limit("user:1", { window: "1h", max: 3 }),
    ).resolves.toMatchObject({
      ok: true,
    });
  });

  it("rejects hits above the configured maximum", async () => {
    mocks.upsert.mockResolvedValue({ hits: 4 });
    await expect(
      limit("user:1", { window: "1h", max: 3 }),
    ).resolves.toMatchObject({
      ok: false,
    });
  });

  it("uses an atomic database increment", async () => {
    mocks.upsert.mockResolvedValue({ hits: 1 });
    await limit("gen:global", { window: "1m", max: 10 });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { hits: { increment: 1 } } }),
    );
  });
});
