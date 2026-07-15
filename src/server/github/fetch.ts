import "server-only";
import { graphql } from "@octokit/graphql";
import type { Prisma } from "../../../generated/prisma";
import { env } from "~/env";
import { db } from "~/server/db";
import { scoreAndSelect } from "./select";
import type { RawProfile, RawRepo, RepoNode } from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

function client() {
  if (!env.GITHUB_TOKEN) {
    throw new Error(
      "GITHUB_TOKEN is not set — add a GitHub PAT (public read) to .env before generating.",
    );
  }
  return graphql.defaults({
    headers: { authorization: `token ${env.GITHUB_TOKEN}` },
  });
}

// ---------- query 1: profile + repos + pinned + contributions ----------

interface RepoQueryNode {
  name: string;
  description: string | null;
  url: string;
  homepageUrl: string | null;
  stargazerCount: number;
  forkCount: number;
  isArchived: boolean;
  isFork: boolean;
  pushedAt: string | null;
  primaryLanguage: { name: string } | null;
  defaultBranchRef: { name: string } | null;
  languages: { totalSize: number; edges: { size: number; node: { name: string } }[] };
  repositoryTopics: { nodes: { topic: { name: string } }[] };
}

interface ProfileQuery {
  user: {
    login: string;
    name: string | null;
    bio: string | null;
    location: string | null;
    company: string | null;
    websiteUrl: string | null;
    twitterUsername: string | null;
    avatarUrl: string | null;
    email: string | null;
    url: string;
    followers: { totalCount: number };
    createdAt: string;
    pinnedItems: { nodes: ({ name?: string })[] };
    repositories: { totalCount: number; nodes: RepoQueryNode[] };
    contributionsCollection: {
      totalCommitContributions: number;
      totalPullRequestContributions: number;
      contributionCalendar: { totalContributions: number };
    };
  } | null;
}

const PROFILE_QUERY = /* GraphQL */ `
  query ($login: String!) {
    user(login: $login) {
      login
      name
      bio
      location
      company
      websiteUrl
      twitterUsername
      avatarUrl
      email
      url
      followers { totalCount }
      createdAt
      pinnedItems(first: 6, types: REPOSITORY) {
        nodes { ... on Repository { name } }
      }
      repositories(
        first: 100
        ownerAffiliations: OWNER
        privacy: PUBLIC
        isFork: false
        orderBy: { field: STARGAZERS, direction: DESC }
      ) {
        totalCount
        nodes {
          name
          description
          url
          homepageUrl
          stargazerCount
          forkCount
          isArchived
          isFork
          pushedAt
          primaryLanguage { name }
          defaultBranchRef { name }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            totalSize
            edges { size node { name } }
          }
          repositoryTopics(first: 10) { nodes { topic { name } } }
        }
      }
      contributionsCollection {
        totalCommitContributions
        totalPullRequestContributions
        contributionCalendar { totalContributions }
      }
    }
  }
`;

function toRepoNode(n: RepoQueryNode): RepoNode {
  return {
    name: n.name,
    description: n.description,
    url: n.url,
    homepageUrl: n.homepageUrl,
    stargazerCount: n.stargazerCount,
    forkCount: n.forkCount,
    isArchived: n.isArchived,
    isFork: n.isFork,
    pushedAt: n.pushedAt,
    primaryLanguage: n.primaryLanguage,
    defaultBranch: n.defaultBranchRef?.name ?? null,
    languages: n.languages.edges.map((e) => ({ name: e.node.name, size: e.size })),
    topics: n.repositoryTopics.nodes.map((t) => t.topic.name),
  };
}

// ---------- query 2: per-repo README / file tree / manifest ----------

interface BlobOrNull {
  text?: string | null;
}
interface RepoDetailQuery {
  repository: {
    readmeMd: BlobOrNull | null;
    readmeLower: BlobOrNull | null;
    readmeMdx: BlobOrNull | null;
    tree: { entries: { name: string; type: string }[] } | null;
    pkg: BlobOrNull | null;
    pyproject: BlobOrNull | null;
  } | null;
}

const DETAIL_QUERY = /* GraphQL */ `
  query (
    $owner: String!, $name: String!,
    $md: String!, $lower: String!, $mdx: String!,
    $tree: String!, $pkg: String!, $pyproject: String!
  ) {
    repository(owner: $owner, name: $name) {
      readmeMd: object(expression: $md) { ... on Blob { text } }
      readmeLower: object(expression: $lower) { ... on Blob { text } }
      readmeMdx: object(expression: $mdx) { ... on Blob { text } }
      tree: object(expression: $tree) { ... on Tree { entries { name type } } }
      pkg: object(expression: $pkg) { ... on Blob { text } }
      pyproject: object(expression: $pyproject) { ... on Blob { text } }
    }
  }
`;

function parseManifest(
  pkg: string | null | undefined,
  pyproject: string | null | undefined,
): RawRepo["manifest"] {
  if (pkg) {
    try {
      const json = JSON.parse(pkg) as {
        name?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = [
        ...Object.keys(json.dependencies ?? {}),
        ...Object.keys(json.devDependencies ?? {}),
      ].slice(0, 15);
      return { name: json.name, deps };
    } catch {
      /* fall through */
    }
  }
  if (pyproject) return { deps: ["python"] };
  return null;
}

async function fetchRepoDetail(
  gql: ReturnType<typeof client>,
  owner: string,
  repo: RepoNode,
): Promise<Pick<RawRepo, "readme" | "fileTree" | "manifest">> {
  const branch = repo.defaultBranch;
  if (!branch) return { readme: null, fileTree: [], manifest: null };

  try {
    const res = await gql<RepoDetailQuery>(DETAIL_QUERY, {
      owner,
      name: repo.name,
      md: `${branch}:README.md`,
      lower: `${branch}:readme.md`,
      mdx: `${branch}:README.mdx`,
      tree: `${branch}:`,
      pkg: `${branch}:package.json`,
      pyproject: `${branch}:pyproject.toml`,
    });
    const r = res.repository;
    const readme =
      r?.readmeMd?.text ?? r?.readmeLower?.text ?? r?.readmeMdx?.text ?? null;
    const fileTree = (r?.tree?.entries ?? []).map((e) => e.name).slice(0, 30);
    const manifest = parseManifest(r?.pkg?.text, r?.pyproject?.text);
    return { readme, fileTree, manifest };
  } catch {
    // A single repo's detail failing must not kill the whole generation.
    return { readme: null, fileTree: [], manifest: null };
  }
}

// ---------- public API ----------

function isFresh(fetchedAt: Date): boolean {
  return Date.now() - fetchedAt.getTime() < CACHE_TTL_MS;
}

/**
 * Cheap pre-flight: does this GitHub login exist? One tiny GraphQL roundtrip,
 * no repos, no readme. Used by the /generate form to fail fast before we
 * burn an LLM call (or even the full repo-walk) on a typo.
 */
export async function githubUserExists(username: string): Promise<boolean> {
  const login = username.trim().replace(/^@/, "");
  if (!login) return false;

  // If we already cached the full profile, the user definitely exists.
  const cached = await db.gitHubCache.findUnique({ where: { username: login } });
  if (cached && isFresh(cached.fetchedAt)) return true;

  try {
    const gql = client();
    const res = await gql<{ user: { id: string } | null }>(
      /* GraphQL */ `query ($login: String!) { user(login: $login) { id } }`,
      { login },
    );
    return Boolean(res.user?.id);
  } catch {
    // Treat network/transport errors as "unknown → assume true" so a flaky
    // GitHub doesn't block legitimate users. The full fetch will surface a
    // real error downstream if the user really doesn't exist.
    return true;
  }
}

/**
 * Fetch + select + enrich a user's public GitHub into a RawProfile.
 * Cached per-username (1h TTL) to respect the 5,000 req/hr limit.
 */
export async function fetchRawProfile(username: string): Promise<RawProfile> {
  const login = username.trim().replace(/^@/, "");

  const cached = await db.gitHubCache.findUnique({ where: { username: login } });
  if (cached && isFresh(cached.fetchedAt)) {
    return cached.raw as unknown as RawProfile;
  }

  const gql = client();
  const data = await gql<ProfileQuery>(PROFILE_QUERY, { login });
  if (!data.user) {
    throw new Error(`GitHub user "${login}" not found.`);
  }
  const u = data.user;

  const repoNodes = u.repositories.nodes.map(toRepoNode);
  const pinnedNames = u.pinnedItems.nodes
    .map((n) => n.name)
    .filter((n): n is string => Boolean(n));
  const selected = scoreAndSelect(repoNodes, pinnedNames);

  const repos: RawRepo[] = await Promise.all(
    selected.map(async (r) => ({
      ...r,
      ...(await fetchRepoDetail(gql, login, r)),
    })),
  );

  const profile: RawProfile = {
    user: {
      login: u.login,
      name: u.name,
      bio: u.bio,
      location: u.location,
      company: u.company,
      websiteUrl: u.websiteUrl,
      twitterUsername: u.twitterUsername,
      avatarUrl: u.avatarUrl,
      email: u.email,
      url: u.url,
      followers: u.followers.totalCount,
      publicRepositories: u.repositories.totalCount,
      createdAt: u.createdAt,
    },
    contributions: {
      commits: u.contributionsCollection.totalCommitContributions,
      prs: u.contributionsCollection.totalPullRequestContributions,
      total: u.contributionsCollection.contributionCalendar.totalContributions,
    },
    repos,
  };

  const rawJson = JSON.parse(JSON.stringify(profile)) as Prisma.InputJsonValue;
  await db.gitHubCache.upsert({
    where: { username: login },
    create: { username: login, raw: rawJson, fetchedAt: new Date() },
    update: { raw: rawJson, fetchedAt: new Date() },
  });

  return profile;
}
