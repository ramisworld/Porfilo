import { describe, expect, it } from "vitest";
import { buildPortfolioMetadata, portfolioDisplayName } from "./metadata";

describe("portfolio metadata", () => {
  it("falls back to the GitHub username for an empty display name", () => {
    expect(
      portfolioDisplayName({ identity: { name: "" } } as never, "octocat"),
    ).toBe("octocat");
  });

  it("handles malformed stored profile data without throwing", () => {
    expect(() =>
      buildPortfolioMetadata({
        profileData: {},
        githubUsername: "octocat",
        isPublic: true,
        canonicalUrl: "https://example.com",
      }),
    ).not.toThrow();
  });
});
