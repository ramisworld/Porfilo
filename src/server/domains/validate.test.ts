import { describe, expect, it } from "vitest";
import { validateHostname } from "./validate";

const ROOT = "porfilo.com";

describe("validateHostname", () => {
  describe("accepts", () => {
    it.each([
      "max.com",
      "portfolio.max.com",
      "deep.sub.example.co.uk",
      "rami-portfolio.dev",
      "MAX.COM", // case-normalized
      "  example.com  ", // trimmed
      "https://example.com/path", // protocol + path stripped
      "example.com.", // trailing dot stripped
    ])("'%s' is valid", (input) => {
      const result = validateHostname(input, ROOT);
      expect(result.ok).toBe(true);
    });

    it("lowercases the result", () => {
      const result = validateHostname("MAX.COM", ROOT);
      expect(result).toEqual({ ok: true, hostname: "max.com" });
    });

    it("strips protocol and path", () => {
      const result = validateHostname("https://portfolio.max.com/x?y=1", ROOT);
      expect(result).toEqual({ ok: true, hostname: "portfolio.max.com" });
    });
  });

  describe("rejects", () => {
    it.each([
      ["", "empty"],
      [" ", "empty whitespace"],
      ["singlelabel", "no TLD"],
      ["foo .com", "space in middle"],
      ["-bad.com", "leading dash"],
      ["bad-.com", "trailing dash"],
      ["192.168.1.1", "IPv4"],
      ["::1", "IPv6"],
      ["localhost", "localhost"],
      ["x.localhost", "localhost subdomain"],
      ["porfilo.com", "the root itself"],
      ["x.porfilo.com", "subdomain of the root"],
      ["x".repeat(254) + ".com", "too long"],
      ["space ce.com", "internal space"],
    ])("rejects '%s' (%s)", (input) => {
      const result = validateHostname(input, ROOT);
      expect(result.ok).toBe(false);
    });

    it("returns a clear reason for each rejection", () => {
      // Smoke-test that the .reason field is always a non-empty string.
      for (const input of ["", "localhost", "porfilo.com", "1.2.3.4"]) {
        const result = validateHostname(input, ROOT);
        if (result.ok) throw new Error("unexpected pass: " + input);
        expect(result.reason).toBeTruthy();
        expect(typeof result.reason).toBe("string");
      }
    });
  });

  describe("rootDomain awareness", () => {
    it("honors a different root", () => {
      expect(
        validateHostname("foo.app.example", "app.example").ok,
      ).toBe(false);
      expect(validateHostname("foo.app.example", "porfilo.com").ok).toBe(true);
    });

    it("ignores :port suffixes in the root (dev localhost:3000)", () => {
      expect(
        validateHostname("max.com", "localhost:3000").ok,
      ).toBe(true);
    });
  });
});
