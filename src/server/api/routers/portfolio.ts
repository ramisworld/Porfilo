import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "../../../../generated/prisma";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { profileDataSchema, type ProfileData } from "~/server/profile/model";
import { normalizeWorldId } from "~/server/worlds/catalog";
import { renderWorld } from "~/server/worlds/render";
import { primePortfolioHeroImage } from "~/server/portfolio/hero-image";

/**
 * Portfolio router — the authenticated user can read and manage their own
 * portfolio. Beta cap: one per account, enforced at the DB layer
 * (`Portfolio.ownerId` is `@unique`), so every mutation here can safely
 * scope by `ownerId` without checking ownership separately.
 */
export const portfolioRouter = createTRPCRouter({
  /** Returns the signed-in user's portfolio, or `null` if they don't have one yet. */
  mine: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.portfolio.findUnique({
      where: { ownerId: ctx.user.id },
      select: {
        id: true,
        slug: true,
        githubUsername: true,
        vibe: true,
        template: true,
        isPublic: true,
        views: true,
        profileData: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }),

  /** Flip the public bit. Affects future SSR + `X-Robots-Tag`. */
  setPublic: protectedProcedure
    .input(z.object({ isPublic: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.portfolio.updateMany({
        where: { ownerId: ctx.user.id },
        data: { isPublic: input.isPublic },
      });
      if (updated.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No portfolio." });
      }
      return { ok: true };
    }),

  /** Permanently delete. Frees the beta-cap slot — they can generate again. */
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    const deleted = await ctx.db.portfolio.deleteMany({
      where: { ownerId: ctx.user.id },
    });
    if (deleted.count === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No portfolio." });
    }
    return { ok: true };
  }),

  /**
   * Update the editable ProfileData. The full object is validated against the
   * Zod schema so corrupt edits can't write garbage into the JSON column.
   *
   * `githubUsername` is intentionally NOT editable during beta — changing it
   * would invalidate the scraped facts without a re-scrape, which we don't
   * allow under the 1-portfolio cap.
   */
  updateProfileData: protectedProcedure
    .input(z.object({ profileData: profileDataSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.portfolio.findUnique({
        where: { ownerId: ctx.user.id },
        select: { id: true, template: true, githubUsername: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No portfolio." });
      }
      const payload: ProfileData = input.profileData;
      const worldId = normalizeWorldId(existing.template);
      const code = worldId
        ? renderWorld(worldId, payload, existing.githubUsername)
        : undefined;
      const updated = await ctx.db.portfolio.update({
        where: { id: existing.id },
        data: {
          profileData: JSON.parse(
            JSON.stringify(payload),
          ) as Prisma.InputJsonValue,
          ...(code ? { code } : {}),
          ogImage: null,
          ogImageFingerprint: null,
        },
      });
      try {
        await primePortfolioHeroImage(updated);
      } catch (error) {
        // Preserve a successful profile edit if an optional social-image
        // refresh is temporarily unavailable. The public route still emits a
        // profile-specific fallback instead of returning a broken preview.
        console.error("Failed to refresh portfolio hero image", {
          portfolioId: updated.id,
          error,
        });
      }
      return { ok: true, profileData: payload };
    }),
});
