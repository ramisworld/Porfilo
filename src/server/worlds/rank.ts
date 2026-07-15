import { WORLD_CATALOG, type WorldDefinition } from "./catalog";

export interface RankedWorld {
  world: WorldDefinition;
  score: number;
  matchedSignals: string[];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNegated(vibe: string, cue: string): boolean {
  const escaped = cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:not|no|without|avoid)\\s+(?:a\\s+)?${escaped}`).test(
    vibe,
  );
}

/**
 * Cheap, deterministic first pass. It provides a safe fallback when Haiku is
 * unavailable and gives the chooser explicit evidence instead of an unbounded
 * aesthetic guessing task.
 */
export function rankWorlds(vibe: string): RankedWorld[] {
  const normal = normalize(vibe);
  const vibeTokens = new Set(
    normal.split(" ").filter((token) => token.length > 2),
  );

  return WORLD_CATALOG.map((world, stableIndex) => {
    let score = 0;
    const matchedSignals: string[] = [];
    const names = [world.id.replace(/-/g, " "), world.name, ...world.cues];

    for (const rawCue of names) {
      const cue = normalize(rawCue);
      if (!cue) continue;
      if (isNegated(normal, cue)) {
        score -= 45;
        continue;
      }
      if (normal.includes(cue)) {
        score += cue.includes(" ") ? 18 : 10;
        matchedSignals.push(rawCue);
        continue;
      }
      const cueTokens = cue.split(" ").filter((token) => token.length > 2);
      const overlap = cueTokens.filter((token) => vibeTokens.has(token)).length;
      score += overlap * 2;
      if (overlap === cueTokens.length && overlap > 0)
        matchedSignals.push(rawCue);
    }

    for (const rawCue of world.antiCues ?? []) {
      const cue = normalize(rawCue);
      if (normal.includes(cue)) score -= 24;
    }

    // Stable, explicit default for a completely abstract vibe.
    if (world.id === "magazine") score += 0.01;
    return { world, score: score - stableIndex * 0.0001, matchedSignals };
  }).sort((a, b) => b.score - a.score);
}
