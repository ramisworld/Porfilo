import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "~/server/auth";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

/**
 * /generate is parked. Generation now starts on the landing page — the user
 * types their GitHub username in the hero and the build log runs inline,
 * anonymous-first. This route remains so old links don't 404:
 *  - signed-in user who already owns a portfolio → dashboard
 *  - anyone else → landing (the new entry point)
 */
export default async function GeneratePage() {
  const session = await getSession(await headers());
  if (session?.user) {
    const existing = await db.portfolio.findUnique({
      where: { ownerId: session.user.id },
      select: { id: true },
    });
    if (existing) redirect("/dashboard");
  }
  redirect("/");
}
