import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

describe("clientIp", () => {
  it("uses the nearest valid X-Forwarded-For hop by default", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.99, 198.51.100.4",
      "x-real-ip": "192.0.2.1",
      "cf-connecting-ip": "192.0.2.2",
    });
    expect(clientIp(headers)).toBe("198.51.100.4");
  });

  it("does not let alternate spoofed headers override the configured ingress", () => {
    const first = new Headers({
      "x-forwarded-for": "198.51.100.4",
      "x-real-ip": "192.0.2.1",
    });
    const second = new Headers({
      "x-forwarded-for": "198.51.100.4",
      "x-real-ip": "192.0.2.200",
    });
    expect(clientIp(first)).toBe(clientIp(second));
  });

  it("only trusts Cloudflare's header when explicitly configured", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.4",
      "cf-connecting-ip": "203.0.113.7",
    });
    expect(clientIp(headers, "cf-connecting-ip")).toBe("203.0.113.7");
  });

  it("collapses missing or malformed identities into one safe bucket", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "not-an-ip" }))).toBe(
      "unknown",
    );
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
