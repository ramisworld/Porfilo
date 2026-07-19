import { describe, expect, it } from "vitest";
import { normalizeWorldId, WORLD_CATALOG } from "./catalog";
import { renderStoredWorld, renderWorld } from "./render";
import { WORLD_TEST_PROFILE } from "./test-profile";

describe("approved world rendering", () => {
  it("contains exactly 36 selectable worlds", () => {
    expect(WORLD_CATALOG).toHaveLength(36);
  });

  for (const world of WORLD_CATALOG) {
    it(`fills ${world.name} from one bounded profile`, () => {
      const code = renderWorld(world.id, WORLD_TEST_PROFILE, "alexrivera");
      if (world.id === "terminal-nexus") {
        expect(code).toContain('"experience":"terminalNexus"');
        expect(code).toContain('"scene":"ghostObject"');
        expect(code).toContain("Long Form Classification Model");
        expect(code).toContain("/engine/v3.js");
        expect(code).not.toContain("ramisworld");
        return;
      }
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

  it("places experience before the final contact moment in new worlds", () => {
    const code = renderWorld(
      "shoji-light-house",
      WORLD_TEST_PROFILE,
      "alexrivera",
    );
    expect(code.indexOf('id="porfilo-experience"')).toBeLessThan(
      code.indexOf('id="contact"'),
    );
  });

  it("normalizes legacy Terminal Nexus identifiers onto the canonical world", () => {
    expect(normalizeWorldId("terminalNexus")).toBe("terminal-nexus");
    const code = renderStoredWorld({
      template: "terminalNexus",
      profileData: WORLD_TEST_PROFILE,
      githubUsername: "alexrivera",
    });
    expect(code).toContain('"experience":"terminalNexus"');
    expect(code).toContain('"scene":"ghostObject"');
    expect(code).toContain("/engine/v3.js");
  });
});
