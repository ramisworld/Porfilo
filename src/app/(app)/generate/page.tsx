import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "~/server/auth";
import { db } from "~/server/db";
import { AppShell } from "../_components/app-shell";
import { GenerateClient } from "./client";

export const dynamic = "force-dynamic";

export default async function GeneratePage() {
  // Belt and braces — the (app) layout already redirects unauth users.
  const session = await getSession(await headers());
  if (!session?.user) redirect("/sign-in?next=/generate");

  // Beta cap: one portfolio per account. If the user already has one, send
  // them to the dashboard. /generate stays single-purpose: the build flow.
  const existing = await db.portfolio.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (existing) redirect("/dashboard");

  const displayName =
    session.user.name?.split(" ")[0] ?? session.user.email?.split("@")[0] ?? null;

  return (
    <AppShell displayName={displayName}>
      <GenerateClient />
    </AppShell>
  );
}
