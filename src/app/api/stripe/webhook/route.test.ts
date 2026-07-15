import Stripe from "stripe";
import type * as StripeModule from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const WEBHOOK_SECRET = "whsec_test_secret";

vi.mock("~/env", () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
    STRIPE_SECRET_KEY: "sk_test_dummy",
  },
}));

const h = vi.hoisted(() => ({ fulfillCheckout: vi.fn() }));
vi.mock("~/server/billing/fulfillment", () => ({
  fulfillCheckout: h.fulfillCheckout,
}));

// Real Stripe client (dummy key — no network), so signature verification runs
// for real against a header we sign with the same secret.
vi.mock("~/server/billing/stripe", async () => {
  const actual = await vi.importActual<typeof StripeModule>("stripe");
  const stripe = new actual.default("sk_test_dummy", {
    apiVersion: "2026-05-27.dahlia",
  });
  return { isStripeConfigured: () => true, getStripe: () => stripe };
});

import { POST } from "./route";

const signer = new Stripe("sk_test_dummy", { apiVersion: "2026-05-27.dahlia" });

function eventPayload(type: string, sessionId: string): string {
  return JSON.stringify({
    id: "evt_test_1",
    object: "event",
    type,
    data: { object: { id: sessionId, object: "checkout.session" } },
  });
}

function request(payload: string, signature?: string): Request {
  const headers: Record<string, string> = {};
  if (signature) headers["stripe-signature"] = signature;
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers,
    body: payload,
  });
}

function sign(payload: string): string {
  return signer.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/stripe/webhook", () => {
  it("fulfils on a validly-signed checkout.session.completed", async () => {
    const payload = eventPayload("checkout.session.completed", "cs_123");
    const res = await POST(request(payload, sign(payload)));

    expect(res.status).toBe(200);
    expect(h.fulfillCheckout).toHaveBeenCalledWith("cs_123");
  });

  it("also fulfils on checkout.session.async_payment_succeeded", async () => {
    const payload = eventPayload(
      "checkout.session.async_payment_succeeded",
      "cs_async",
    );
    const res = await POST(request(payload, sign(payload)));

    expect(res.status).toBe(200);
    expect(h.fulfillCheckout).toHaveBeenCalledWith("cs_async");
  });

  it("rejects a tampered payload with 400 and does not fulfil", async () => {
    const payload = eventPayload("checkout.session.completed", "cs_123");
    const signature = sign(payload);
    const tampered = payload.replace("cs_123", "cs_evil");

    const res = await POST(request(tampered, signature));

    expect(res.status).toBe(400);
    expect(h.fulfillCheckout).not.toHaveBeenCalled();
  });

  it("returns 400 when the signature header is missing", async () => {
    const payload = eventPayload("checkout.session.completed", "cs_123");
    const res = await POST(request(payload));

    expect(res.status).toBe(400);
    expect(h.fulfillCheckout).not.toHaveBeenCalled();
  });

  it("acknowledges unrelated events with 200 without fulfilling", async () => {
    const payload = eventPayload("payment_intent.created", "pi_1");
    const res = await POST(request(payload, sign(payload)));

    expect(res.status).toBe(200);
    expect(h.fulfillCheckout).not.toHaveBeenCalled();
  });

  it("stays 200 across duplicate deliveries (fulfilment dedup is downstream)", async () => {
    const payload = eventPayload("checkout.session.completed", "cs_dup");
    const first = await POST(request(payload, sign(payload)));
    const second = await POST(request(payload, sign(payload)));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(h.fulfillCheckout).toHaveBeenCalledTimes(2);
    expect(h.fulfillCheckout).toHaveBeenCalledWith("cs_dup");
  });
});
