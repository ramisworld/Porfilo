import { describe, expect, it } from "vitest";
import { WORLD_CHOOSER_CASES } from "./chooser-cases";

const runLive = process.env.RUN_LIVE_WORLD_CHOOSER === "true";

describe
  .skipIf(!runLive)
  .sequential("live Haiku world chooser acceptance loop", () => {
    for (const testCase of WORLD_CHOOSER_CASES) {
      it(`chooses ${testCase.expected}`, async () => {
        // Keep env-bound Anthropic code out of the default unit-test graph.
        const { chooseWorld } = await import("./choose");
        const result = await chooseWorld(testCase.vibe);
        expect(result.choice.source).toBe("haiku");
        expect(result.choice.worldId).toBe(testCase.expected);
      }, 30_000);
    }
  });
