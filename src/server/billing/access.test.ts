import { describe, expect, it, vi } from "vitest";
import { hasCustomDomainAccess } from "./access";

type Db = Parameters<typeof hasCustomDomainAccess>[0];

/** Minimal db stub whose featureAccess.findUnique resolves to a given row. */
function dbReturning(row: { status: string } | null) {
  const findUnique = vi.fn().mockResolvedValue(row);
  const db = { featureAccess: { findUnique } } as unknown as Db;
  return { db, findUnique };
}

describe("hasCustomDomainAccess", () => {
  it("is true only when the entitlement is paid", async () => {
    const { db } = dbReturning({ status: "paid" });
    expect(await hasCustomDomainAccess(db, "user-1")).toBe(true);
  });

  it("is false for a pending entitlement (checkout started, not completed)", async () => {
    const { db } = dbReturning({ status: "pending" });
    expect(await hasCustomDomainAccess(db, "user-1")).toBe(false);
  });

  it("is false for a failed entitlement", async () => {
    const { db } = dbReturning({ status: "failed" });
    expect(await hasCustomDomainAccess(db, "user-1")).toBe(false);
  });

  it("is false when the user has no entitlement row", async () => {
    const { db } = dbReturning(null);
    expect(await hasCustomDomainAccess(db, "user-1")).toBe(false);
  });

  it("looks the row up by the (userId, featureKey) unique", async () => {
    const { db, findUnique } = dbReturning({ status: "paid" });
    await hasCustomDomainAccess(db, "user-42");
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        userId_featureKey: { userId: "user-42", featureKey: "custom_domain" },
      },
      select: { status: true },
    });
  });
});
