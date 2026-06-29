import { describe, expect, it } from "vitest";
import {
  validateFreeSubdomainLabel,
  suggestAlternatives,
} from "./subdomain";

const ROOT = "porfilo.com";

describe("validateFreeSubdomainLabel", () => {
  it("accepts valid labels", () => {
    const r = validateFreeSubdomainLabel("max", ROOT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.label).toBe("max");
      expect(r.hostname).toBe("max.porfilo.com");
    }
  });

  it("rejects reserved names", () => {
    const r = validateFreeSubdomainLabel("admin", ROOT);
    expect(r.ok).toBe(false);
  });

  it("rejects dots", () => {
    const r = validateFreeSubdomainLabel("max.test", ROOT);
    expect(r.ok).toBe(false);
  });

  it("suggests alternatives", () => {
    const alts = suggestAlternatives("admin");
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every((a) => a !== "admin")).toBe(true);
  });
});
