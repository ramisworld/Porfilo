import "server-only";
import { customAlphabet } from "nanoid";
import { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { fetchRawProfile } from "~/server/github/fetch";
import { buildFacts } from "~/server/llm/facts";
import { chooseWorld } from "~/server/worlds/choose";
import { renderWorld } from "~/server/worlds/render";
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
  /** True when the portfolio was created without an owner (anonymous, pre-claim). */
  ownerless?: boolean;
  /**
   * One-time claim token (plaintext), emitted only on `done` for anonymous
   * runs. The route injects it — the generator only persists its hash.
   */
  claimToken?: string;
  error?: string;
  code?: GenerateErrorCode;
}

export interface RunGenerationOptions {
  /**
   * Owning user id, or `null` for an anonymous (pre-claim) generation.
   *
   * Anonymous generations create an ownerless portfolio (`ownerId = null`)
   * that a signed-in user later claims. The one-per-account quota check only
   * applies when an owner exists.
   */
  ownerId: string | null;
  /**
   * SHA-256 hash of the one-time claim token for an anonymous run. Persisted so
   * `/claim` can require the plaintext token (delivered only to the generating
   * browser) — the public preview URL alone must not grant ownership. Null for
   * signed-in runs (they own the row immediately).
   */
  claimNonceHash?: string | null;
  /**
   * Existing owned portfolio to replace atomically after the new snapshot has
   * rendered. Its id, preview URL, visibility, and CustomDomain relation are
   * preserved; only generated content/design fields change.
   */
  replacePortfolioId?: string;
}

/**
 * The pipeline: fetch → curate → facts (Haiku) → world choice (Haiku) →
 * deterministic template fill → persist. The model selects from approved IDs;
 * it never writes executable portfolio code.
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
    const { choice, usage: chooserUsage } = await chooseWorld(vibe, data);
    if (chooserUsage) usages.push(chooserUsage);
    const code = renderWorld(choice.worldId, data, profile.user.login);

    yield { stage: "saving", message: "Publishing preview URL…" };
    const slug = newSlug();
    const publicSubdomainSlug = newPublicSlug();
    let publishedSlug = publicSubdomainSlug;
    // Race-proof one-portfolio-per-user: re-check inside a serializable
    // transaction so two concurrent requests can't both slip a row past the
    // pre-flight count in the route handler. Anonymous (ownerless)
    // generations skip this — there's no per-owner cap to enforce.
    await db.$transaction(
      async (tx) => {
        if (opts.replacePortfolioId) {
          if (!opts.ownerId) throw new Error("REPLACEMENT_REQUIRES_OWNER");

          const existing = await tx.portfolio.findFirst({
            where: { id: opts.replacePortfolioId, ownerId: opts.ownerId },
            select: { publicSubdomainSlug: true },
          });
          if (!existing) throw new Error("PORTFOLIO_NOT_FOUND");

          publishedSlug = existing.publicSubdomainSlug;
          await tx.portfolio.update({
            where: { id: opts.replacePortfolioId },
            data: {
              githubUsername: profile.user.login,
              vibe,
              profileData: JSON.parse(
                JSON.stringify(data),
              ) as Prisma.InputJsonValue,
              designSpec: Prisma.JsonNull,
              code,
              engineVersion: ENGINE_VERSION,
              template: choice.worldId,
              claimNonce: null,
              ogImage: null,
              ogImageFingerprint: null,
            },
          });
          return;
        }

        if (opts.ownerId) {
          const owned = await tx.portfolio.count({
            where: { ownerId: opts.ownerId },
          });
          if (owned >= 1) {
            throw new Error("QUOTA_REACHED");
          }
        }
        await tx.portfolio.create({
          data: {
            ownerId: opts.ownerId,
            githubUsername: profile.user.login,
            slug,
            publicSubdomainSlug,
            vibe,
            profileData: JSON.parse(
              JSON.stringify(data),
            ) as Prisma.InputJsonValue,
            // `code` is a deterministic snapshot for portability. Serve-time
            // rendering uses template + profileData so edits cannot go stale.
            code,
            engineVersion: ENGINE_VERSION,
            template: choice.worldId,
            isPublic: true,
            // Only anonymous rows carry a claim hash; owned rows are already claimed.
            claimNonce: opts.ownerId ? null : (opts.claimNonceHash ?? null),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    logRunTotal({ username: profile.user.login, slug: publishedSlug }, usages);
    yield {
      stage: "done",
      slug: publishedSlug,
      ownerless: !opts.ownerId,
    };
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
