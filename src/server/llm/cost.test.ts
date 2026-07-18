import { describe, expect, it, vi } from "vitest";

vi.mock("~/env", () => ({
  env: {
    DAILY_LLM_BUDGET_USD: undefined,
    LLM_GENERATION_RESERVATION_USD: 1,
    MOCK_LLM: "true",
    NODE_ENV: "test",
  },
}));
vi.mock("~/server/db", () => ({ db: {} }));

import { committedSpendMicros } from "./cost";

describe("durable LLM budget accounting", () => {
  const now = new Date("2026-07-18T10:00:00.000Z");

  it("counts active reservations conservatively and settled rows exactly", () => {
    expect(
      committedSpendMicros(
        [
          {
            status: "pending",
            reservedMicros: 1_000_000,
            actualMicros: 30_000,
            expiresAt: new Date("2026-07-18T10:10:00.000Z"),
          },
          {
            status: "settled",
            reservedMicros: 1_000_000,
            actualMicros: 42_000,
            expiresAt: now,
          },
        ],
        now,
      ),
    ).toBe(1_042_000);
  });

  it("retains recorded actual spend after a crashed reservation expires", () => {
    expect(
      committedSpendMicros(
        [
          {
            status: "pending",
            reservedMicros: 1_000_000,
            actualMicros: 55_000,
            expiresAt: new Date("2026-07-18T09:00:00.000Z"),
          },
        ],
        now,
      ),
    ).toBe(55_000);
  });
});
