import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

// ── Mocks ────────────────────────────────────────────────────────────────────
// env: billing.ts reads STRIPE_CUSTOM_DOMAIN_PRICE_ID (undefined → inline price).
vi.mock("~/env", () => ({ env: { STRIPE_CUSTOM_DOMAIN_PRICE_ID: undefined } }));
// trpc.ts imports these at module load; we supply the ctx.db ourselves.
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/auth", () => ({ getSession: vi.fn() }));

const h = vi.hoisted(() => ({
  createSession: vi.fn(),
  stripeConfigured: true,
}));
vi.mock("~/server/billing/stripe", () => ({
  isStripeConfigured: () => h.stripeConfigured,
  getStripe: () => ({ checkout: { sessions: { create: h.createSession } } }),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { billingRouter } from "./billing";

const createCaller = createCallerFactory(billingRouter);

type FeatureAccessStub = {
  findUnique: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

/** Build a caller with a controllable db + a signed-in user. */
function callerFor(userId: string, featureAccess: FeatureAccessStub) {
  const ctx = {
    db: { featureAccess },
    session: { user: { id: userId, email: `${userId}@example.com` } },
    headers: new Headers(),
  } as unknown as Parameters<typeof createCaller>[0];
  return createCaller(ctx);
}

function featureAccessStub(accessStatus: string | null): FeatureAccessStub {
  return {
    findUnique: vi.fn().mockResolvedValue(
      accessStatus === null ? null : { status: accessStatus },
    ),
    upsert: vi.fn().mockResolvedValue({ id: "fa_new" }),
    update: vi.fn().mockResolvedValue({ id: "fa_new" }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.stripeConfigured = true;
  h.createSession.mockResolvedValue({
    id: "cs_created_1",
    url: "https://checkout.stripe.com/c/pay/cs_created_1",
  });
});

describe("billing.customDomainAccess", () => {
  it("reports unlocked=true for a paid user", async () => {
    const caller = callerFor("user-paid", featureAccessStub("paid"));
    expect(await caller.customDomainAccess()).toEqual({ unlocked: true });
  });

  it("reports unlocked=false for a user with no entitlement", async () => {
    const caller = callerFor("user-free", featureAccessStub(null));
    expect(await caller.customDomainAccess()).toEqual({ unlocked: false });
  });
});

describe("billing.createCustomDomainCheckoutSession", () => {
  it("creates a Checkout Session and returns its URL for a fresh user", async () => {
    const fa = featureAccessStub(null);
    const caller = callerFor("user-fresh", fa);

    const result = await caller.createCustomDomainCheckoutSession();

    expect(result).toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_created_1",
    });
    // Pending entitlement row upserted (not paid) — a cancelled checkout leaves
    // this pending, so access stays locked until the webhook fulfils it.
    expect(fa.upsert).toHaveBeenCalledWith({
      where: {
        userId_featureKey: { userId: "user-fresh", featureKey: "custom_domain" },
      },
      create: {
        userId: "user-fresh",
        featureKey: "custom_domain",
        status: "pending",
        amount: 900,
        currency: "usd",
      },
      update: { status: "pending" },
    });
    // Session created in one-time payment mode with a single $9 line item.
    expect(h.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        client_reference_id: "user-fresh",
        metadata: {
          userId: "user-fresh",
          featureKey: "custom_domain",
          featureAccessId: "fa_new",
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: 900,
              product_data: { name: "Porfilo Custom Domains" },
            },
          },
        ],
      }),
    );
    // Session id bound back to the record for webhook matching.
    expect(fa.update).toHaveBeenCalledWith({
      where: { id: "fa_new" },
      data: { stripeCheckoutSessionId: "cs_created_1" },
    });
  });

  it("never re-charges an already-unlocked user (duplicate-purchase guard)", async () => {
    const fa = featureAccessStub("paid");
    const caller = callerFor("user-paid", fa);

    const result = await caller.createCustomDomainCheckoutSession();

    expect(result).toEqual({ alreadyUnlocked: true });
    expect(h.createSession).not.toHaveBeenCalled();
    expect(fa.upsert).not.toHaveBeenCalled();
  });

  it("fails cleanly when Stripe is not configured", async () => {
    h.stripeConfigured = false;
    const fa = featureAccessStub(null);
    const caller = callerFor("user-fresh", fa);

    await expect(
      caller.createCustomDomainCheckoutSession(),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(h.createSession).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    const ctx = {
      db: { featureAccess: featureAccessStub(null) },
      session: null,
      headers: new Headers(),
    } as unknown as Parameters<typeof createCaller>[0];
    const caller = createCaller(ctx);

    await expect(caller.createCustomDomainCheckoutSession()).rejects.toBeInstanceOf(
      TRPCError,
    );
  });
});
