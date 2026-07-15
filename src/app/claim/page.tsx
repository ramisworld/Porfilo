import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "../../../generated/prisma";
import { getSession } from "~/server/auth";
import { db } from "~/server/db";
import { CLAIM_WINDOW_MS } from "~/server/portfolio/claims";

export const dynamic = "force-dynamic";

// A freshly-generated ownerless portfolio can be claimed for this long after
// it was created. Magic-link email delivery + the user clicking through can
// take a few minutes, so we allow a generous window. After it expires the
// portfolio stays ownerless (still publicly served) and is prunable later.
/**
 * Claim-on-auth landing.
 *
 * Flow: an anonymous visitor generates a portfolio on the landing → the build
 * log completes with `{ slug, ownerless: true }` → a claim-auth card appears
 * inline with `callbackURL = /claim?slug=<slug>`. After the visitor signs in
 * (magic link or OAuth), BetterAuth redirects here. We assign the ownerless
 * portfolio to the new user and send them to their dashboard.
 *
 * Guards: the portfolio must exist, be ownerless, and be within the claim
 * window. A user who already owns a portfolio (beta cap) keeps their existing
 * one — the orphan stays for pruning.
 */
export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; ct?: string }>;
}) {
  const { slug, ct } = await searchParams;
  const h = await headers();
  const session = await getSession(h);

  if (!session?.user) {
    // Preserve BOTH the slug and the one-time claim token through sign-in so the
    // token survives the magic-link / OAuth round trip (and works cross-device).
    const q = new URLSearchParams();
    if (slug) q.set("slug", slug);
    if (ct) q.set("ct", ct);
    const qs = q.toString();
    redirect(
      `/sign-in?next=${encodeURIComponent(qs ? `/claim?${qs}` : "/claim")}`,
    );
  }

  if (!slug) redirect("/dashboard");

  const userId = session.user.id;

  // Look up the candidate portfolio.
  const candidate = await db.portfolio.findUnique({
    where: { publicSubdomainSlug: slug },
    select: { id: true, ownerId: true, createdAt: true, claimNonce: true },
  });

  // Bail unless the portfolio exists, is still ownerless, and is within the
  // claim window. Magic-link delivery can take a few minutes, so the window
  // is generous; after it expires the row stays ownerless and prunable.
  // (Each guard returns `never`, so candidate narrows to non-null below.)
  if (!candidate) redirect("/dashboard");
  if (candidate.ownerId !== null) redirect("/dashboard");
  if (Date.now() - candidate.createdAt.getTime() > CLAIM_WINDOW_MS) {
    redirect("/dashboard");
  }

  // Ownership gate: the caller must present the one-time claim token that was
  // handed only to the browser that generated this portfolio. The public
  // preview URL (publicSubdomainSlug) is intentionally NOT sufficient on its
  // own — otherwise anyone who saw the preview link could claim it first.
  const providedHash = ct
    ? createHash("sha256").update(ct).digest("hex")
    : null;
  if (!candidate.claimNonce || providedHash !== candidate.claimNonce) {
    redirect("/dashboard");
  }

  // Race-proof assignment: only claim if the user doesn't already own one
  // (the unique constraint on ownerId backs this up as a hard guard).
  try {
    await db.$transaction(
      async (tx) => {
        const owned = await tx.portfolio.count({ where: { ownerId: userId } });
        if (owned >= 1) return; // keep existing; orphan stays ownerless
        // updateMany lets us scope to the still-ownerless row so a race
        // loser (someone who claimed it in the same instant) no-ops here.
        await tx.portfolio.updateMany({
          where: { id: candidate.id, ownerId: null },
          data: { ownerId: userId },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    // P2002 (unique on ownerId) → user already owns one in a race. Safe to ignore.
  }

  redirect("/dashboard");
}
