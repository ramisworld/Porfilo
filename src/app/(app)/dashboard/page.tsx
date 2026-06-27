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
  // Public URL — what Preview / "open in new tab" point at. We use a PATH on
  // the (always cert-covered) root domain rather than `<slug>.<root>`: a
  // multi-level subdomain like `slug.porthub.rami.co.nz` isn't covered by
  // Cloudflare's universal cert, so the subdomain form fails TLS. The path
  // form works on every deployment regardless of cert scope.
  const publicUrl = `${protocol}${rootDomain}/sites/${portfolio.slug}`;
  // Same-origin render route — what the embedded preview iframe loads.
  const embedUrl = `/sites/${portfolio.slug}`;

  return (
    <AppShell displayName={displayName} width="wide" fit>
      <DashboardView
        id={portfolio.id}
        slug={portfolio.slug}
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
