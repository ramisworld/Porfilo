import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

// ── Mocks ────────────────────────────────────────────────────────────────────
const envH = vi.hoisted(() => ({
  priceId: undefined as string | undefined,
}));
// env: undefined price id uses the inline $9 price; individual tests can opt
// into a pre-created Stripe Price through the getter.
vi.mock("~/env", () => ({
  env: {
    get STRIPE_PREMIUM_PRICE_ID() {
      return envH.priceId;
    },
  },
}));
// trpc.ts imports these at module load; we supply the ctx.db ourselves.
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/auth", () => ({ getSession: vi.fn() }));
vi.mock("~/server/ratelimit", () => ({
  limit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
}));

const h = vi.hoisted(() => ({
  createSession: vi.fn(),
  retrieveSession: vi.fn(),
  expireSession: vi.fn(),
  retrievePrice: vi.fn(),
  stripeConfigured: true,
}));
const fulfillmentH = vi.hoisted(() => ({ fulfillCheckout: vi.fn() }));
vi.mock("~/server/billing/stripe", () => ({
  isStripeConfigured: () => h.stripeConfigured,
  getStripe: () => ({
    prices: { retrieve: h.retrievePrice },
    checkout: {
      sessions: {
        create: h.createSession,
        retrieve: h.retrieveSession,
        expire: h.expireSession,
      },
    },
  }),
}));
vi.mock("~/server/billing/fulfillment", () => ({
  fulfillCheckout: fulfillmentH.fulfillCheckout,
}));

import { createCallerFactory } from "~/server/api/trpc";
import { billingRouter } from "./billing";

const createCaller = createCallerFactory(billingRouter);

type FeatureAccessStub = {
  findUnique: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
};

/** Build a caller with a controllable db + a signed-in user. */
function callerFor(userId: string, featureAccess: FeatureAccessStub) {
  const ctx = {
    db: {
      featureAccess,
      customDomain: { findFirst: vi.fn().mockResolvedValue(null) },
    },
    session: { user: { id: userId, email: `${userId}@example.com` } },
    headers: new Headers(),
  } as unknown as Parameters<typeof createCaller>[0];
  return createCaller(ctx);
}

function featureAccessStub(accessStatus: string | null): FeatureAccessStub {
  return {
    findUnique: vi
      .fn()
      .mockResolvedValue(
        accessStatus === null ? null : { status: accessStatus },
      ),
    upsert: vi.fn().mockResolvedValue({
      id: "fa_new",
      status: accessStatus ?? "pending",
      stripeCheckoutSessionId: null,
    }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  envH.priceId = undefined;
  h.stripeConfigured = true;
  h.createSession.mockResolvedValue({
    id: "cs_created_1",
    url: "https://checkout.stripe.com/c/pay/cs_created_1",
  });
  fulfillmentH.fulfillCheckout.mockResolvedValue({ status: "fulfilled" });
  h.expireSession.mockResolvedValue({ id: "cs_created_1", status: "expired" });
});

describe("billing.premiumAccess", () => {
  it("reports unlocked=true for a paid user", async () => {
    const caller = callerFor("user-paid", featureAccessStub("paid"));
    expect(await caller.premiumAccess()).toEqual({ unlocked: true });
  });

  it("reports unlocked=false for a user with no entitlement", async () => {
    const caller = callerFor("user-free", featureAccessStub(null));
    expect(await caller.premiumAccess()).toEqual({ unlocked: false });
  });
});

describe("billing.createPremiumCheckoutSession", () => {
  it("creates a Checkout Session and returns its URL for a fresh user", async () => {
    const fa = featureAccessStub(null);
    const caller = callerFor("user-fresh", fa);

    const result = await caller.createPremiumCheckoutSession();

    expect(result).toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_created_1",
    });
    // Pending entitlement row upserted (not paid) — a cancelled checkout leaves
    // this pending, so access stays locked until the webhook fulfils it.
    expect(fa.upsert).toHaveBeenCalledWith({
      where: {
        userId_featureKey: {
          userId: "user-fresh",
          featureKey: "premium",
        },
      },
      create: {
        userId: "user-fresh",
        featureKey: "premium",
        status: "pending",
        amount: 900,
        currency: "usd",
      },
      update: {},
    });
    // Session created in one-time payment mode with a single $9 line item.
    expect(h.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        payment_method_types: ["card"],
        client_reference_id: "user-fresh",
        metadata: {
          userId: "user-fresh",
          featureKey: "premium",
          featureAccessId: "fa_new",
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: 900,
              product_data: {
                name: "Porfilo Premium",
                description:
                  "Use your own domain and regenerate your portfolio with new designs. One-time payment.",
              },
            },
          },
        ],
      }),
      { idempotencyKey: "porfilo:premium:usd-900-v1:fa_new:initial" },
    );
    // Session id bound back to the record for webhook matching.
    expect(fa.updateMany).toHaveBeenCalledWith({
      where: { id: "fa_new", status: { not: "paid" } },
      data: {
        status: "pending",
        amount: 900,
        currency: "usd",
        stripeCheckoutSessionId: "cs_created_1",
        stripePaymentIntentId: null,
        paidAt: null,
      },
    });
  });

  it("uses one Stripe idempotency key when the buy action is spammed", async () => {
    const fa = featureAccessStub(null);
    const caller = callerFor("user-spam", fa);

    const results = await Promise.all([
      caller.createPremiumCheckoutSession(),
      caller.createPremiumCheckoutSession(),
      caller.createPremiumCheckoutSession(),
    ]);

    expect(results).toEqual([
      { url: "https://checkout.stripe.com/c/pay/cs_created_1" },
      { url: "https://checkout.stripe.com/c/pay/cs_created_1" },
      { url: "https://checkout.stripe.com/c/pay/cs_created_1" },
    ]);
    const calls = h.createSession.mock.calls as unknown as Array<
      [unknown, { idempotencyKey?: string }]
    >;
    const keys = calls.map(([, options]) => options.idempotencyKey);
    expect(new Set(keys)).toEqual(
      new Set(["porfilo:premium:usd-900-v1:fa_new:initial"]),
    );
  });

  it("accepts only an active one-time $9 USD configured Price", async () => {
    envH.priceId = "price_premium_9";
    h.retrievePrice.mockResolvedValue({
      id: "price_premium_9",
      active: true,
      type: "one_time",
      unit_amount: 900,
      currency: "usd",
    });

    await callerFor(
      "user-priced",
      featureAccessStub(null),
    ).createPremiumCheckoutSession();

    expect(h.retrievePrice).toHaveBeenCalledWith("price_premium_9");
    expect(h.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_premium_9", quantity: 1 }],
      }),
      expect.any(Object),
    );
  });

  it("rejects a misconfigured Price before it can charge the user", async () => {
    envH.priceId = "price_wrong_amount";
    h.retrievePrice.mockResolvedValue({
      id: "price_wrong_amount",
      active: true,
      type: "one_time",
      unit_amount: 1500,
      currency: "usd",
    });

    await expect(
      callerFor(
        "user-priced",
        featureAccessStub(null),
      ).createPremiumCheckoutSession(),
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(h.createSession).not.toHaveBeenCalled();
  });

  it("reuses an existing open, correctly-priced Checkout Session", async () => {
    const fa = featureAccessStub(null);
    fa.upsert.mockResolvedValue({
      id: "fa_existing",
      status: "pending",
      stripeCheckoutSessionId: "cs_open",
    });
    h.retrieveSession.mockResolvedValue({
      id: "cs_open",
      status: "open",
      mode: "payment",
      payment_status: "unpaid",
      amount_total: 900,
      currency: "usd",
      client_reference_id: "user-existing",
      metadata: {
        userId: "user-existing",
        featureKey: "premium",
      },
      url: "https://checkout.stripe.com/c/pay/cs_open",
    });

    const result = await callerFor(
      "user-existing",
      fa,
    ).createPremiumCheckoutSession();

    expect(result).toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_open",
    });
    expect(h.createSession).not.toHaveBeenCalled();
  });

  it("expires a newly-created Session if payment wins the database race", async () => {
    const fa = featureAccessStub(null);
    fa.updateMany.mockResolvedValue({ count: 0 });

    const result = await callerFor(
      "user-race",
      fa,
    ).createPremiumCheckoutSession();

    expect(result).toEqual({ alreadyUnlocked: true });
    expect(h.expireSession).toHaveBeenCalledWith(
      "cs_created_1",
      {},
      { idempotencyKey: "porfilo:expire:cs_created_1" },
    );
  });

  it("never re-charges an already-unlocked user (duplicate-purchase guard)", async () => {
    const fa = featureAccessStub("paid");
    const caller = callerFor("user-paid", fa);

    const result = await caller.createPremiumCheckoutSession();

    expect(result).toEqual({ alreadyUnlocked: true });
    expect(h.createSession).not.toHaveBeenCalled();
    expect(fa.upsert).not.toHaveBeenCalled();
  });

  it("fails cleanly when Stripe is not configured", async () => {
    h.stripeConfigured = false;
    const fa = featureAccessStub(null);
    const caller = callerFor("user-fresh", fa);

    await expect(caller.createPremiumCheckoutSession()).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(h.createSession).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    const ctx = {
      db: {
        featureAccess: featureAccessStub(null),
        customDomain: { findFirst: vi.fn().mockResolvedValue(null) },
      },
      session: null,
      headers: new Headers(),
    } as unknown as Parameters<typeof createCaller>[0];
    const caller = createCaller(ctx);

    await expect(caller.createPremiumCheckoutSession()).rejects.toBeInstanceOf(
      TRPCError,
    );
  });
});

describe("billing.confirmPremiumCheckout", () => {
  it("confirms only for the authenticated user and reports current access", async () => {
    const fa = featureAccessStub(null);
    fa.findUnique.mockResolvedValue({ status: "paid" });

    const result = await callerFor("user-confirm", fa).confirmPremiumCheckout({
      sessionId: "cs_live_confirm_1",
    });

    expect(fulfillmentH.fulfillCheckout).toHaveBeenCalledWith(
      "cs_live_confirm_1",
      "user-confirm",
    );
    expect(result).toEqual({ unlocked: true });
  });

  it("rejects a malformed Checkout Session id without calling Stripe", async () => {
    await expect(
      callerFor("user-confirm", featureAccessStub(null)).confirmPremiumCheckout(
        { sessionId: "not-a-session" },
      ),
    ).rejects.toBeInstanceOf(TRPCError);
    expect(fulfillmentH.fulfillCheckout).not.toHaveBeenCalled();
  });
});
