import { describe, expect, it } from "vitest";
import { WORLD_CHOOSER_CASES } from "./chooser-cases";
import { rankWorlds } from "./rank";

describe("deterministic world shortlist", () => {
  for (const testCase of WORLD_CHOOSER_CASES) {
    it(`ranks ${testCase.expected} first for its acceptance vibe`, () => {
      expect(rankWorlds(testCase.vibe)[0]?.world.id).toBe(testCase.expected);
    });
  }

  it("respects an explicit terminal negation", () => {
    const result = rankWorlds(
      "Dark and technical, but not a terminal; use an atmospheric geological archive.",
    );
    expect(result[0]?.world.id).toBe("seismic-archive");
    expect(result[0]?.world.id).not.toBe("terminal");
  });
});
