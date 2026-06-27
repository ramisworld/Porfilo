import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the env so the Prisma client module loads without real config.
vi.mock("~/env", () => ({
  env: {
    DATABASE_URL: "postgres://test/test",
    NODE_ENV: "test",
  },
}));

// Mock the db module with a controllable $transaction. The lock module's
// branches are exercised by what we throw from inside the transaction.
type TxResult = (tx: TxStub) => Promise<void>;
type TxStub = {
  generationLock: {
    deleteMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  portfolio: { count: ReturnType<typeof vi.fn> };
};

let txFn: ((cb: TxResult) => Promise<void>) | undefined;
let lockFindUniqueResult: { expiresAt: Date } | null = null;

vi.mock("~/server/db", () => ({
  db: {
    $transaction: (cb: TxResult) => txFn!(cb),
    generationLock: {
      findUnique: vi.fn(async () => lockFindUniqueResult),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}));

// Prisma's TransactionIsolationLevel.* is just an enum-shaped object at runtime.
vi.mock("../../generated/prisma", () => ({
  Prisma: {
    TransactionIsolationLevel: { Serializable: "Serializable" },
  },
}));

import {
  acquireGenerationLock,
  releaseGenerationLock,
} from "./generation-lock";

function fakeTx(impl: (tx: TxStub) => Promise<void>): typeof txFn {
  return async (cb) => {
    const tx: TxStub = {
      generationLock: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        create: vi.fn(async () => ({})),
      },
      portfolio: { count: vi.fn(async () => 0) },
    };
    await impl(tx);
    await cb(tx);
  };
}

beforeEach(() => {
  txFn = undefined;
  lockFindUniqueResult = null;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("acquireGenerationLock", () => {
  it("returns ok when the lock row inserts cleanly", async () => {
    txFn = fakeTx(async () => {
      /* defaults: portfolio.count → 0, create succeeds */
    });

    const result = await acquireGenerationLock("user-1", "MaxExample");
    expect(result).toEqual({ ok: true });
  });

  it("maps the quota-exceeded path to 409 quota_reached", async () => {
    // The lock module's transaction throws QUOTA_REACHED when the user already
    // has a portfolio. We override the count check to simulate that.
    txFn = async (cb) => {
      const tx: TxStub = {
        generationLock: {
          deleteMany: vi.fn(async () => ({ count: 0 })),
          create: vi.fn(),
        },
        portfolio: { count: vi.fn(async () => 1) },
      };
      await cb(tx);
    };

    const result = await acquireGenerationLock("user-1", "max");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("quota_reached");
    expect(result.status).toBe(409);
  });

  it("maps Prisma P2002 (unique violation) to generation_in_progress 409", async () => {
    txFn = async (cb) => {
      const tx: TxStub = {
        generationLock: {
          deleteMany: vi.fn(async () => ({ count: 0 })),
          create: vi.fn(async () => {
            const err = new Error("unique") as Error & { code?: string };
            err.code = "P2002";
            throw err;
          }),
        },
        portfolio: { count: vi.fn(async () => 0) },
      };
      await cb(tx);
    };
    lockFindUniqueResult = {
      expiresAt: new Date(Date.now() + 30_000),
    };

    const result = await acquireGenerationLock("user-1", "max");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("generation_in_progress");
    expect(result.status).toBe(409);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(30);
  });

  it("maps Prisma P2003 (FK violation) to session_invalid 401", async () => {
    // This is the bug the dev hit: cookie cache served a stale session that
    // pointed at a User row that no longer exists. The lock insert is the
    // first place that joins to User, so it's where the FK violation surfaces.
    txFn = async (cb) => {
      const tx: TxStub = {
        generationLock: {
          deleteMany: vi.fn(async () => ({ count: 0 })),
          create: vi.fn(async () => {
            const err = new Error("foreign key") as Error & { code?: string };
            err.code = "P2003";
            throw err;
          }),
        },
        portfolio: { count: vi.fn(async () => 0) },
      };
      await cb(tx);
    };

    const result = await acquireGenerationLock("ghost-user", "max");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("session_invalid");
    expect(result.status).toBe(401);
    expect(result.error.toLowerCase()).toContain("sign in");
  });

  it("re-throws unrecognized errors so a 500 surfaces with the original stack", async () => {
    txFn = async (cb) => {
      const tx: TxStub = {
        generationLock: {
          deleteMany: vi.fn(async () => ({ count: 0 })),
          create: vi.fn(async () => {
            throw new Error("connection refused");
          }),
        },
        portfolio: { count: vi.fn(async () => 0) },
      };
      await cb(tx);
    };

    await expect(acquireGenerationLock("u", "max")).rejects.toThrow(
      /connection refused/,
    );
  });
});

describe("releaseGenerationLock", () => {
  it("calls deleteMany scoped to the ownerId", async () => {
    const { db } = await import("~/server/db");
    await releaseGenerationLock("user-1");
    // We're inspecting the vi.fn we ourselves placed on the module mock; the
    // unbound-method rule is paranoid about `this`, but the spy doesn't use it.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const spy = vi.mocked(db.generationLock.deleteMany);
    expect(spy).toHaveBeenCalledWith({ where: { ownerId: "user-1" } });
  });
});
