import { describe, expect, it } from "vitest";
import { WORLD_CATALOG } from "./catalog";
import { renderWorld } from "./render";
import { WORLD_TEST_PROFILE } from "./test-profile";

describe("approved world rendering", () => {
  it("contains exactly 33 selectable worlds", () => {
    expect(WORLD_CATALOG).toHaveLength(33);
  });

  for (const world of WORLD_CATALOG) {
    it(`fills ${world.name} from one bounded profile`, () => {
      const code = renderWorld(world.id, WORLD_TEST_PROFILE, "alexrivera");
      expect(code.match(/const DATA =/g)).toHaveLength(1);
      expect(code).toContain('"handle": "alexrivera"');
      expect(code).toContain("Long Form Classification Model");
      expect(code).toContain('id="porfilo-experience"');
      expect(code).not.toContain("ramisworld");
      expect(code).not.toContain("classificationModel");
    });
  }

  it("omits the experience extension with no experience data", () => {
    const code = renderWorld(
      "magazine",
      { ...WORLD_TEST_PROFILE, experience: [] },
      "alexrivera",
    );
    expect(code).not.toContain('id="porfilo-experience"');
  });
});
