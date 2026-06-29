import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "~/server/auth";
import { db } from "~/server/db";
import { env } from "~/env";
import { profileDataSchema } from "~/server/profile/model";
import { AppShell } from "../_components/app-shell";
import { DashboardView } from "./view";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession(await headers());
  if (!session?.user) redirect("/sign-in?next=/dashboard");

  const portfolio = await db.portfolio.findUnique({
    where: { ownerId: session.user.id },
    select: {
      id: true,
      slug: true,
      publicSubdomainSlug: true,
      githubUsername: true,
      vibe: true,
      isPublic: true,
      views: true,
      profileData: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // No portfolio yet → /generate is the right place.
  if (!portfolio) redirect("/generate");

  // Parse ProfileData with the Zod schema so the editor opens against a known
  // shape. Older rows that don't quite match the latest schema should still
  // surface — we coerce with safeParse and fall back to a minimal-valid stub
  // so the rest of the dashboard (preview/visibility/copy) keeps working.
  const parsed = profileDataSchema.safeParse(portfolio.profileData);
  const profileData = parsed.success
    ? parsed.data
    : {
        identity: {
          name: portfolio.githubUsername,
          headline: "",
          role: "",
          links: {},
        },
        languages: [],
        focus: [],
        stack: [],
        abilities: [],
        stats: [],
        projects: [],
        credentials: [],
      };

  const displayName =
    session.user.name?.split(" ")[0] ??
    session.user.email?.split("@")[0] ??
    null;

  const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN;
  const protocol =
    rootDomain.startsWith("localhost") || rootDomain.startsWith("127.")
      ? "http://"
      : "https://";
  const previewHost = portfolio.publicSubdomainSlug;
  const publicUrl = `${protocol}${previewHost}.${rootDomain.replace(/:\d+$/, "")}`;
  const embedUrl = `/sites/${portfolio.publicSubdomainSlug}`;

  return (
    <AppShell displayName={displayName} width="wide" fit>
      <DashboardView
        id={portfolio.id}
        slug={portfolio.publicSubdomainSlug}
        githubUsername={portfolio.githubUsername}
        isPublic={portfolio.isPublic}
        views={portfolio.views}
        createdAt={portfolio.createdAt.toISOString()}
        updatedAt={portfolio.updatedAt.toISOString()}
        publicUrl={publicUrl}
        embedUrl={embedUrl}
        profileData={profileData}
      />
    </AppShell>
  );
}
