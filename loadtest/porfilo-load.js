import http from "k6/http";
import crypto from "k6/crypto";
import { check } from "k6";
import { Rate, Trend } from "k6/metrics";

/**
 * Porfilo load test — dashboard + custom-domain checkout + webhook bursts.
 *
 * Goal: find real breaking points around the $9 unlock, not vanity numbers.
 * Scenarios (run together):
 *   1. dashboard_reads   — the tRPC batch the dashboard fires (domain.mine +
 *                          billing.premiumAccess), ramped 0→1000 VUs.
 *   2. checkout_clicks   — concurrent "+ Add custom domain" → createCheckoutSession.
 *   3. webhook_bursts    — signed checkout.session.completed deliveries, incl.
 *                          duplicates, to prove idempotency holds under retries.
 *
 * Auth: the tRPC procedures are protected — provide a logged-in session cookie
 * via SESSION_COOKIE (name=value). Without it, reads/checkout will 401 (still a
 * useful latency/error baseline for the auth + edge path).
 *
 * Run:
 *   BASE_URL=http://localhost:3000 \
 *   SESSION_COOKIE='better-auth.session_token=...' \
 *   STRIPE_WEBHOOK_SECRET=whsec_... \
 *   k6 run loadtest/porfilo-load.js
 */

const BASE = __ENV.BASE_URL || "http://localhost:3000";
const SESSION_COOKIE = __ENV.SESSION_COOKIE || "";
const WEBHOOK_SECRET = __ENV.STRIPE_WEBHOOK_SECRET || "";
const PEAK_VUS = Number(__ENV.PEAK_VUS || 1000);

const checkoutLatency = new Trend("checkout_latency", true);
const webhookLatency = new Trend("webhook_latency", true);
const businessErrors = new Rate("business_errors");

export const options = {
  scenarios: {
    dashboard_reads: {
      executor: "ramping-vus",
      exec: "dashboardRead",
      startVUs: 0,
      stages: [
        { duration: "30s", target: Math.round(PEAK_VUS * 0.5) },
        { duration: "1m", target: PEAK_VUS },
        { duration: "2m", target: PEAK_VUS },
        { duration: "30s", target: 0 },
      ],
    },
    checkout_clicks: {
      executor: "ramping-arrival-rate",
      exec: "checkoutClick",
      startRate: 5,
      timeUnit: "1s",
      preAllocatedVUs: 200,
      maxVUs: 600,
      stages: [
        { duration: "1m", target: 50 },
        { duration: "2m", target: 120 },
        { duration: "30s", target: 0 },
      ],
    },
    webhook_bursts: {
      executor: "constant-arrival-rate",
      exec: "webhookDelivery",
      rate: 80,
      timeUnit: "1s",
      duration: "3m",
      preAllocatedVUs: 100,
      maxVUs: 300,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<800"],
    checkout_latency: ["p(95)<1200"],
    webhook_latency: ["p(95)<500"],
  },
};

export function setup() {
  if (!SESSION_COOKIE) {
    throw new Error("SESSION_COOKIE is required; 401 responses are not a valid authenticated load test.");
  }
  if (!WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required for signed webhook load tests.");
  }
}

function authHeaders() {
  const headers = { "content-type": "application/json" };
  if (SESSION_COOKIE) headers["cookie"] = SESSION_COOKIE;
  return headers;
}

/** Dashboard read: the exact batched query the dashboard client fires. */
export function dashboardRead() {
  const input = encodeURIComponent(JSON.stringify({ 0: { json: null }, 1: { json: null } }));
  const url = `${BASE}/api/trpc/domain.mine,billing.premiumAccess?batch=1&input=${input}`;
  const res = http.get(url, { headers: authHeaders(), tags: { name: "dashboard_read" } });
  check(res, { "dashboard 2xx": (r) => r.status === 200 });
}

/** "+ Add custom domain" click → create a Checkout Session. */
export function checkoutClick() {
  const url = `${BASE}/api/trpc/billing.createPremiumCheckoutSession?batch=1`;
  const body = JSON.stringify({ 0: { json: null } });
  const res = http.post(url, body, {
    headers: authHeaders(),
    tags: { name: "checkout_click" },
  });
  checkoutLatency.add(res.timings.duration);
  const ok = res.status === 200 || res.status === 429;
  businessErrors.add(!ok);
  check(res, { "checkout handled": () => ok });
}

/** Signed delayed-payment failures. Reuses a small pool of session ids so
 * duplicate deliveries exercise the idempotent database path without making
 * thousands of fake Stripe API retrievals. */
export function webhookDelivery() {
  const sessionId = `cs_load_${(__ITER % 50) + 1}`;
  const payload = JSON.stringify({
    id: `evt_${__VU}_${__ITER}`,
    object: "event",
    type: "checkout.session.async_payment_failed",
    data: { object: { id: sessionId, object: "checkout.session" } },
  });
  const ts = Math.floor(Date.now() / 1000);
  const signature = crypto.hmac("sha256", WEBHOOK_SECRET, `${ts}.${payload}`, "hex");
  const res = http.post(`${BASE}/api/stripe/webhook`, payload, {
    headers: {
      "content-type": "application/json",
      "stripe-signature": `t=${ts},v1=${signature}`,
    },
    tags: { name: "webhook" },
  });
  webhookLatency.add(res.timings.duration);
  check(res, { "webhook accepted": (r) => r.status === 200 });
}
