import "server-only";
import { customAlphabet } from "nanoid";
import { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { fetchRawProfile } from "~/server/github/fetch";
import { buildFacts } from "~/server/llm/facts";
import { buildDesignSpec } from "~/server/llm/design";
import { logRunTotal, type UsageRecord } from "~/server/llm/cost";
import { ENGINE_VERSION } from "~/engine/version";

// DNS-safe lowercase slug for internal routing + legacy fallback.
const newSlug = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);
// Long crypto-safe slug for preview URLs: https://<slug>.porfilo.com
const newPublicSlug = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyz",
  32,
);

export type Stage =
  | "fetching"
  | "curating"
  | "writing"
  | "designing"
  | "saving"
  | "done"
  | "error";

// Typed error codes the client switches on. Anything not enumerated here is
// surfaced as a generic error message.
export type GenerateErrorCode =
  | "github_not_found"
  | "quota_reached"
  | "internal";

export interface GenerateEvent {
  stage: Stage;
  message?: string;
  slug?: string;
  error?: string;
  code?: GenerateErrorCode;
}

export interface RunGenerationOptions {
  /** Currently signed-in user id; required from Phase 3 onward. */
  ownerId: string;
}

/**
 * The pipeline: fetch → curate (in fetch) → facts → apply template →
 * persist. Yields progress events for the live build-log. Honors MOCK_LLM via
 * the facts module. The only LLM call lives inside `buildFacts`.
 */
export async function* runGeneration(
  username: string,
  vibe: string,
  opts: RunGenerationOptions,
): AsyncGenerator<GenerateEvent> {
  try {
    yield { stage: "fetching", message: "Reading your GitHub…" };
    let profile;
    try {
      profile = await fetchRawProfile(username);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not found/i.test(msg)) {
        yield {
          stage: "error",
          code: "github_not_found",
          error: "We couldn't find that GitHub user.",
        };
        return;
      }
      throw err;
    }

    yield { stage: "curating", message: "Curating your best work…" };

    const usages: UsageRecord[] = [];

    yield { stage: "writing", message: "Writing your story…" };
    const { data, usage: factsUsage } = await buildFacts(profile);
    if (factsUsage) usages.push(factsUsage);

    yield { stage: "designing", message: "Designing your site…" };
    const { spec, usage: designUsage } = await buildDesignSpec(data, vibe);
    if (designUsage) usages.push(designUsage);

    yield { stage: "saving", message: "Publishing preview URL…" };
    const slug = newSlug();
    const publicSubdomainSlug = newPublicSlug();
    // Race-proof one-portfolio-per-user: re-check inside a serializable
    // transaction so two concurrent requests can't both slip a row past the
    // pre-flight count in the route handler.
    await db.$transaction(
      async (tx) => {
        const owned = await tx.portfolio.count({ where: { ownerId: opts.ownerId } });
        if (owned >= 1) {
          throw new Error("QUOTA_REACHED");
        }
        await tx.portfolio.create({
          data: {
            ownerId: opts.ownerId,
            githubUsername: profile.user.login,
            slug,
            publicSubdomainSlug,
            vibe,
            profileData: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
            designSpec: JSON.parse(JSON.stringify(spec)) as Prisma.InputJsonValue,
            engineVersion: ENGINE_VERSION,
            template: "terminalNexus",
            isPublic: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    logRunTotal({ username: profile.user.login, slug: publicSubdomainSlug }, usages);
    yield { stage: "done", slug: publicSubdomainSlug };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "QUOTA_REACHED") {
      yield {
        stage: "error",
        code: "quota_reached",
        error:
          "You already have a portfolio. Porfilo is in beta — only one portfolio per account for now.",
      };
      return;
    }
    yield {
      stage: "error",
      code: "internal",
      error: err instanceof Error ? err.message : "Generation failed.",
    };
  }
}
