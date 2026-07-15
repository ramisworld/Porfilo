import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "~/env";

/**
 * Model IDs are env-controlled so we can switch snapshots per environment
 * (dev → cheap/fast, prod → quality) without a code change. Defaults are
 * defined in src/env.js.
 */
export const MODELS = {
  facts: env.ANTHROPIC_MODEL_FACTS,
  chooser: env.ANTHROPIC_MODEL_CHOOSER,
  /** @deprecated The free-form author path is retained only for legacy code. */
  design: env.ANTHROPIC_MODEL_DESIGN,
} as const;

export const isMock = env.MOCK_LLM !== "false";

let cached: Anthropic | null = null;

/** Lazily construct the client. Throws only when actually used in live mode. */
export function anthropic(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — required when MOCK_LLM=false.",
    );
  }
  cached ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return cached;
}

/** Concatenate the text blocks of a message response. */
export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
