import { describe, expect, it } from "vitest";
import { cnameLabel } from "./cname-label";

describe("cnameLabel", () => {
  it("uses @ for two-label apex domains", () => {
    expect(cnameLabel("max.com")).toBe("@");
  });

  it("uses @ for multi-part TLD apex domains", () => {
    expect(cnameLabel("rami.co.nz")).toBe("@");
    expect(cnameLabel("example.co.uk")).toBe("@");
  });

  it("uses subdomain label for three-label single-TLD hosts", () => {
    expect(cnameLabel("portfolio.max.com")).toBe("portfolio");
  });

  it("uses subdomain label under multi-part TLDs", () => {
    expect(cnameLabel("www.rami.co.nz")).toBe("www");
  });
});
