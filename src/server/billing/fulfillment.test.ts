import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks so the vi.mock factories can reference them.
const h = vi.hoisted(() => ({
  retrieve: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {
    featureAccess: {
      findUnique: h.findUnique,
      updateMany: h.updateMany,
    },
  },
}));

vi.mock("./stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { retrieve: h.retrieve } },
  }),
}));

import { fulfillCheckout } from "./fulfillment";

type SessionShape = {
  id: string;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  payment_intent: string | { id: string } | null;
  metadata: Record<string, string> | null;
};

function session(overrides: Partial<SessionShape> = {}): SessionShape {
  return {
    id: "cs_test_1",
    payment_status: "paid",
    payment_intent: "pi_test_1",
    metadata: { userId: "user-1", featureKey: "custom_domain" },
    ...overrides,
  };
}

const paidRecord = { id: "fa_1", userId: "user-1", status: "pending" };

beforeEach(() => {
  vi.clearAllMocks();
  h.updateMany.mockResolvedValue({ count: 1 });
});

describe("fulfillCheckout", () => {
  it("marks the matching record paid and records the payment intent", async () => {
    h.retrieve.mockResolvedValue(session());
    h.findUnique.mockResolvedValue(paidRecord);

    const result = await fulfillCheckout("cs_test_1");

    expect(result).toEqual({ status: "fulfilled" });
    const call = h.updateMany.mock.calls[0]?.[0] as {
      where: unknown;
      data: { status: string; stripeCheckoutSessionId: string; paidAt: unknown };
    };
    expect(call.where).toEqual({ id: "fa_1", status: { not: "paid" } });
    expect(call.data).toMatchObject({
      status: "paid",
      stripeCheckoutSessionId: "cs_test_1",
      stripePaymentIntentId: "pi_test_1",
    });
    expect(call.data.paidAt).toBeInstanceOf(Date);
  });

  it("is idempotent: a second delivery is a no-op (updateMany matches nothing)", async () => {
    h.retrieve.mockResolvedValue(session());
    h.findUnique.mockResolvedValue({ ...paidRecord, status: "paid" });
    h.updateMany.mockResolvedValue({ count: 0 });

    const result = await fulfillCheckout("cs_test_1");

    expect(result).toEqual({ status: "already_fulfilled" });
  });

  it("ignores sessions whose payment has not completed (unpaid)", async () => {
    h.retrieve.mockResolvedValue(session({ payment_status: "unpaid" }));

    const result = await fulfillCheckout("cs_test_1");

    expect(result).toEqual({ status: "ignored", reason: "payment_status=unpaid" });
    expect(h.findUnique).not.toHaveBeenCalled();
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to fulfil when metadata userId does not match the record (spoofing)", async () => {
    h.retrieve.mockResolvedValue(
      session({ metadata: { userId: "attacker", featureKey: "custom_domain" } }),
    );
    h.findUnique.mockResolvedValue(paidRecord); // record.userId = "user-1"

    const result = await fulfillCheckout("cs_test_1");

    expect(result).toEqual({ status: "ignored", reason: "userId mismatch" });
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("ignores sessions with no matching FeatureAccess record", async () => {
    h.retrieve.mockResolvedValue(session());
    h.findUnique.mockResolvedValue(null); // neither by session id nor by user+feature

    const result = await fulfillCheckout("cs_test_1");

    expect(result).toEqual({
      status: "ignored",
      reason: "no matching FeatureAccess record",
    });
  });

  it("falls back to the (userId, featureKey) unique when the session id isn't stored", async () => {
    h.retrieve.mockResolvedValue(session());
    // First lookup (by session id) misses, fallback (by user+feature) hits.
    h.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(paidRecord);

    const result = await fulfillCheckout("cs_test_1");

    expect(result).toEqual({ status: "fulfilled" });
    expect(h.findUnique).toHaveBeenCalledTimes(2);
    expect(h.findUnique).toHaveBeenNthCalledWith(2, {
      where: {
        userId_featureKey: { userId: "user-1", featureKey: "custom_domain" },
      },
    });
  });

  it("handles an expanded payment_intent object", async () => {
    h.retrieve.mockResolvedValue(session({ payment_intent: { id: "pi_expanded" } }));
    h.findUnique.mockResolvedValue(paidRecord);

    await fulfillCheckout("cs_test_1");

    const call = h.updateMany.mock.calls[0]?.[0] as {
      data: { stripePaymentIntentId: string };
    };
    expect(call.data.stripePaymentIntentId).toBe("pi_expanded");
  });

  it("expands line_items when retrieving the session", async () => {
    h.retrieve.mockResolvedValue(session());
    h.findUnique.mockResolvedValue(paidRecord);

    await fulfillCheckout("cs_test_1");

    expect(h.retrieve).toHaveBeenCalledWith("cs_test_1", {
      expand: ["line_items"],
    });
  });
});
