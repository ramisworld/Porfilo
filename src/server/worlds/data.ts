import type { ProfileData } from "~/server/profile/model";

export interface WorldData {
  identity: {
    name: string;
    handle: string;
    role: string;
    headline: string;
    location: string;
    timezone?: string;
    tzLabel?: string;
    available: boolean;
  };
  tagline: string;
  email: string;
  links: {
    github?: string;
    site?: string;
    x?: string;
    linkedin?: string;
  };
  stats: {
    contributionsPastYear: number;
    publicRepos: number;
    featuredBuilds: number;
    buildingSince: number;
  };
  stack: string[];
  primaryStack: string;
  disciplines: [string, string][];
  projects: Array<{
    name: string;
    year: number;
    tech: string[];
    stars: number;
    repoUrl: string;
    demoUrl?: string;
    blurb: string;
  }>;
  experience: ProfileData["experience"];
  credentials: Array<{
    title: string;
    issuer: string;
    year: number | "Verified";
    credentialId?: string;
    skills?: string[];
    url?: string;
  }>;
}

function numericStat(data: ProfileData, matcher: RegExp): number | undefined {
  const stat = data.stats.find((item) => matcher.test(item.label));
  if (!stat) return undefined;
  const parsed = Number.parseInt(stat.value.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Translate the editable app schema into the stable DATA contract used by every world. */
export function toWorldData(
  profile: ProfileData,
  githubUsername: string,
): WorldData {
  const now = new Date().getUTCFullYear();
  const projectYears = profile.projects
    .map((project) => project.year)
    .filter((year): year is number => typeof year === "number");
  const buildingSince =
    profile.github?.memberSinceYear ??
    (projectYears.length ? Math.min(...projectYears) : now);
  const stack = (
    profile.stack.length
      ? profile.stack
      : profile.languages.map((language) => language.label)
  ).slice(0, 18);
  const primaryStack = stack[0] ?? "Software engineering";
  const detailPool = profile.abilities.map((ability) => ability.label);
  const focus = profile.focus.length ? profile.focus : [profile.identity.role];
  const disciplines = focus
    .slice(0, 8)
    .map((label, index): [string, string] => [
      label,
      detailPool[index] ?? profile.identity.role,
    ]);
  const github =
    profile.identity.links.github ?? `https://github.com/${githubUsername}`;

  return {
    identity: {
      name: profile.identity.name,
      handle: githubUsername,
      role: profile.identity.role,
      headline: profile.identity.headline,
      location: profile.identity.location ?? "",
      available: false,
    },
    tagline: [profile.identity.headline, focus.slice(0, 3).join(" · ")]
      .filter(Boolean)
      .join(" — "),
    email: profile.identity.links.email ?? "",
    links: {
      github,
      site: profile.identity.links.site,
      x: profile.identity.links.x,
      linkedin: profile.identity.links.linkedin,
    },
    stats: {
      contributionsPastYear:
        profile.github?.contributionsPastYear ??
        numericStat(profile, /contribution/i) ??
        0,
      publicRepos:
        profile.github?.publicRepos ??
        numericStat(profile, /repositor|public repos/i) ??
        profile.projects.length,
      featuredBuilds: profile.projects.length,
      buildingSince,
    },
    stack,
    primaryStack,
    disciplines,
    projects: profile.projects.slice(0, 9).map((project) => ({
      name: project.name,
      // Legacy/manual projects without a date are treated as part of the
      // current portfolio edition so templates never render NaN/undefined.
      year: project.year ?? now,
      tech: project.tech.slice(0, 8),
      stars: project.stars ?? 0,
      repoUrl: project.repoUrl,
      demoUrl: project.demoUrl,
      blurb: project.blurb,
    })),
    experience: (profile.experience ?? []).slice(0, 12),
    credentials: profile.credentials.slice(0, 20).map((credential) => ({
      title: credential.title,
      issuer: credential.issuer,
      year: credential.year ?? "Verified",
      credentialId: credential.credentialId,
      skills: credential.skills,
      url: credential.url,
    })),
  };
}
