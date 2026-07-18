import { describe, expect, it, vi } from "vitest";
import { hasPremiumAccess } from "./access";

type Db = Parameters<typeof hasPremiumAccess>[0];

/** Minimal db stub whose featureAccess.findUnique resolves to a given row. */
function dbReturning(
  row: { status: string } | null,
  connectedDomain: { id: string } | null = null,
) {
  const findUnique = vi.fn().mockResolvedValue(row);
  const findFirst = vi.fn().mockResolvedValue(connectedDomain);
  const db = {
    featureAccess: { findUnique },
    customDomain: { findFirst },
  } as unknown as Db;
  return { db, findUnique, findFirst };
}

describe("hasPremiumAccess", () => {
  it("is true only when the entitlement is paid", async () => {
    const { db } = dbReturning({ status: "paid" });
    expect(await hasPremiumAccess(db, "user-1")).toBe(true);
  });

  it("is false for a pending entitlement (checkout started, not completed)", async () => {
    const { db } = dbReturning({ status: "pending" });
    expect(await hasPremiumAccess(db, "user-1")).toBe(false);
  });

  it("is false for a failed entitlement", async () => {
    const { db } = dbReturning({ status: "failed" });
    expect(await hasPremiumAccess(db, "user-1")).toBe(false);
  });

  it("is false when the user has no entitlement row", async () => {
    const { db } = dbReturning(null);
    expect(await hasPremiumAccess(db, "user-1")).toBe(false);
  });

  it("grandfathers an existing connected custom domain", async () => {
    const { db } = dbReturning(null, { id: "domain-1" });
    expect(await hasPremiumAccess(db, "user-1")).toBe(true);
  });

  it("looks the row up by the (userId, featureKey) unique", async () => {
    const { db, findUnique } = dbReturning({ status: "paid" });
    await hasPremiumAccess(db, "user-42");
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        userId_featureKey: { userId: "user-42", featureKey: "premium" },
      },
      select: { status: true },
    });
  });
});
