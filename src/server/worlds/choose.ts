import "server-only";
import { z } from "zod";
import type { ProfileData } from "~/server/profile/model";
import { anthropic, isMock, MODELS, textOf } from "~/server/llm/anthropic";
import {
  buildUsageRecord,
  logUsage,
  type UsageRecord,
} from "~/server/llm/cost";
import { WORLD_CATALOG, worldIdSchema, type WorldId } from "./catalog";
import { rankWorlds } from "./rank";

const choiceSchema = z.object({
  worldId: worldIdSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().trim().min(1).max(320),
  matchedSignals: z.array(z.string().trim().min(1).max(80)).max(8),
});

export type WorldChoice = z.infer<typeof choiceSchema> & {
  source: "haiku" | "deterministic-fallback";
};

const CHOOSER_SYSTEM = `You choose exactly one visual portfolio world from an approved catalog.

Judge the user's written vibe first. Use the profile only to break a genuine tie. Respect negations such as "not terminal". Do not choose a world merely because one word loosely overlaps. Prefer the world whose complete visual metaphor best matches the request.

Return ONLY compact JSON with this exact shape:
{"worldId":"one-valid-id","confidence":0.0,"reason":"one sentence","matchedSignals":["signal"]}

worldId must be copied exactly from the catalog. Do not return markdown.`;

function stripFences(value: string): string {
  return value
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function deterministicChoice(vibe: string): WorldChoice {
  const ranked = rankWorlds(vibe);
  const first = ranked[0];
  if (!first) throw new Error("The world catalog is empty.");
  const secondScore = ranked[1]?.score ?? 0;
  const margin = Math.max(0, first.score - secondScore);
  return {
    worldId: first.world.id,
    confidence: Math.min(0.98, 0.55 + margin / 40),
    reason: `Best catalog match for: ${first.matchedSignals.slice(0, 3).join(", ") || first.world.concept}`,
    matchedSignals: first.matchedSignals.slice(0, 8),
    source: "deterministic-fallback",
  };
}

function profileSummary(data: ProfileData | undefined) {
  if (!data) return undefined;
  return {
    role: data.identity.role,
    headline: data.identity.headline,
    focus: data.focus,
    stack: data.stack.slice(0, 8),
    projectCount: data.projects.length,
    hasExperience: (data.experience?.length ?? 0) > 0,
    hasCredentials: data.credentials.length > 0,
  };
}

export async function chooseWorld(
  vibe: string,
  data?: ProfileData,
  signal?: AbortSignal,
): Promise<{ choice: WorldChoice; usage: UsageRecord | null }> {
  const fallback = deterministicChoice(vibe);
  if (isMock) return { choice: fallback, usage: null };

  const ranked = rankWorlds(vibe)
    .slice(0, 8)
    .map((entry) => ({
      id: entry.world.id,
      deterministicScore: Math.round(entry.score * 100) / 100,
      matchedSignals: entry.matchedSignals,
    }));
  const catalog = WORLD_CATALOG.map((world) => ({
    id: world.id,
    name: world.name,
    concept: world.concept,
    cues: world.cues,
    avoidWhen: world.antiCues,
  }));

  const message = await anthropic().messages.create(
    {
      model: MODELS.chooser,
      max_tokens: 360,
      temperature: 0,
      system: CHOOSER_SYSTEM,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            vibe,
            profile: profileSummary(data),
            deterministicShortlist: ranked,
            catalog,
          }),
        },
      ],
    },
    { signal },
  );

  const usage = buildUsageRecord(
    "world chooser (Haiku)",
    MODELS.chooser,
    message.usage,
  );
  logUsage(usage);

  try {
    const raw: unknown = JSON.parse(stripFences(textOf(message)));
    const parsed = choiceSchema.parse(raw);
    return { choice: { ...parsed, source: "haiku" }, usage };
  } catch (error) {
    console.warn(
      "[world chooser] invalid Haiku output; using deterministic fallback:",
      error instanceof Error ? error.message : error,
    );
    return { choice: fallback, usage };
  }
}

export function assertWorldId(value: string): WorldId {
  return worldIdSchema.parse(value);
}
