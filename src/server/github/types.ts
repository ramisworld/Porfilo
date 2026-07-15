// Shared GitHub types for the fetch → select → facts pipeline.

/** A repository as returned by the profile query (before detail enrichment). */
export interface RepoNode {
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
  defaultBranch: string | null;
  languages: { name: string; size: number }[];
  topics: string[];
}

/** A selected repo, enriched with README / file-tree / manifest signal. */
export interface RawRepo extends RepoNode {
  readme: string | null; // best of README.md / readme.md / README.mdx
  fileTree: string[]; // top-level entry names
  manifest: { name?: string; deps?: string[] } | null;
}

export interface RawProfile {
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
    followers: number;
    publicRepositories: number;
    createdAt: string;
  };
  contributions: {
    commits: number;
    prs: number;
    total: number;
  };
  /** Selected ≤9 repos, enriched. */
  repos: RawRepo[];
}
