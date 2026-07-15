import { beforeEach, describe, expect, it, vi } from "vitest";

// domain.ts reads env only after the gate + portfolio checks, so an empty stub
// is enough for these tests. trpc.ts loads db + auth at import time.
vi.mock("~/env", () => ({ env: {} }));
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/auth", () => ({ getSession: vi.fn() }));
vi.mock("~/server/ratelimit", () => ({
  limit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { domainRouter } from "./domain";

const createCaller = createCallerFactory(domainRouter);

/** Caller with a controllable entitlement + portfolio lookup. */
function callerFor(opts: { access: string | null; portfolio?: unknown }) {
  const ctx = {
    db: {
      featureAccess: {
        findUnique: vi
          .fn()
          .mockResolvedValue(
            opts.access === null ? null : { status: opts.access },
          ),
      },
      customDomain: { findFirst: vi.fn().mockResolvedValue(null) },
      portfolio: {
        findUnique: vi.fn().mockResolvedValue(opts.portfolio ?? null),
      },
    },
    session: { user: { id: "user-1", email: "user-1@example.com" } },
    headers: new Headers(),
  } as unknown as Parameters<typeof createCaller>[0];
  return createCaller(ctx);
}

beforeEach(() => vi.clearAllMocks());

describe("custom-domain paywall gate (server-side enforcement)", () => {
  it("addCustomDomain is FORBIDDEN without a paid unlock", async () => {
    const caller = callerFor({ access: null });
    await expect(
      caller.addCustomDomain({ hostname: "max.com" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("addFreeSubdomain is FORBIDDEN without a paid unlock (whole tile is gated)", async () => {
    const caller = callerFor({ access: null });
    await expect(
      caller.addFreeSubdomain({ label: "max" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("a pending (unpaid) entitlement does not pass the gate", async () => {
    const caller = callerFor({ access: "pending" });
    await expect(
      caller.addCustomDomain({ hostname: "max.com" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("passes the gate when paid (then fails later on the missing portfolio, not FORBIDDEN)", async () => {
    const caller = callerFor({ access: "paid", portfolio: null });
    await expect(
      caller.addCustomDomain({ hostname: "max.com" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
