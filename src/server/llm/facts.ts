import "server-only";
import { z } from "zod";
import {
  aggregateLanguages,
  compactReadme,
  pickStats,
} from "~/server/github/select";
import type { RawProfile, RawRepo } from "~/server/github/types";
import {
  profileDataSchema,
  type Ability,
  type Language,
  type ProfileData,
  type Project,
} from "~/server/profile/model";
import { anthropic, isMock, MODELS, textOf } from "./anthropic";
import { buildUsageRecord, logUsage, type UsageRecord } from "./cost";

/**
 * Layer 1 — Facts. Turns the compacted RawProfile into the structured, editable
 * ProfileData. Deterministic for identity/languages/stats/tech; the LLM (Haiku)
 * only writes the headline/role and per-project blurbs. Mockable (zero spend).
 */

// ---- helpers (deterministic) ----

function firstSentences(text: string, n: number): string {
  const parts = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/);
  return parts.slice(0, n).join(" ").slice(0, 280);
}

function repoTech(r: RawRepo): string[] {
  const tech = [
    r.primaryLanguage?.name,
    ...r.languages.slice(0, 4).map((l) => l.name),
    ...r.topics.slice(0, 4),
  ].filter((t): t is string => Boolean(t));
  return [...new Set(tech)].slice(0, 8);
}

const ABILITY_ALIASES: Record<string, string> = {
  react: "React interfaces",
  next: "Next.js apps",
  nextjs: "Next.js apps",
  "next.js": "Next.js apps",
  vue: "Vue interfaces",
  svelte: "Svelte apps",
  tailwind: "Tailwind systems",
  typescript: "TypeScript architecture",
  javascript: "JavaScript engineering",
  node: "Node.js services",
  nodejs: "Node.js services",
  express: "API design",
  prisma: "Database modeling",
  postgres: "Postgres",
  postgresql: "Postgres",
  supabase: "Supabase backends",
  python: "Python tooling",
  fastapi: "FastAPI services",
  django: "Django apps",
  flask: "Flask services",
  pytorch: "ML systems",
  tensorflow: "ML systems",
  "machine-learning": "Machine learning",
  ai: "AI product work",
  openai: "AI integrations",
  anthropic: "AI integrations",
  flutter: "Flutter apps",
  dart: "Dart",
  swift: "iOS apps",
  kotlin: "Android apps",
  docker: "Containerized delivery",
  stripe: "Payments",
  graphql: "GraphQL APIs",
  redux: "Redux state",
  zustand: "State management",
  jotai: "State management",
  mobx: "State management",
  trpc: "tRPC APIs",
  "@trpc/server": "tRPC APIs",
  apollo: "GraphQL APIs",
  "apollo-server": "GraphQL APIs",
  "@apollo/client": "GraphQL APIs",
  three: "WebGL / Three.js",
  threejs: "WebGL / Three.js",
  gsap: "Motion design",
  "framer-motion": "Motion design",
  d3: "Data visualization",
  "chart.js": "Data visualization",
  electron: "Desktop apps",
  "react-native": "React Native",
  expo: "React Native",
  gatsby: "Gatsby sites",
  remix: "Remix apps",
  astro: "Astro sites",
  nuxt: "Nuxt apps",
  angular: "Angular apps",
  "@angular/core": "Angular apps",
  rxjs: "Reactive streams",
  vuex: "Vue interfaces",
  pinia: "Vue interfaces",
  redis: "Redis",
  ioredis: "Redis",
  mongodb: "MongoDB",
  mongoose: "MongoDB",
  sequelize: "SQL ORMs",
  typeorm: "SQL ORMs",
  drizzle: "SQL ORMs",
  "drizzle-orm": "SQL ORMs",
  knex: "SQL queries",
  mysql: "MySQL",
  mysql2: "MySQL",
  sqlite3: "SQLite",
  "better-sqlite3": "SQLite",
  firebase: "Firebase",
  "firebase-admin": "Firebase",
  "aws-sdk": "AWS",
  "@aws-sdk/client-s3": "AWS",
  kafkajs: "Event streaming",
  "socket.io": "Realtime / WebSockets",
  ws: "Realtime / WebSockets",
  jsonwebtoken: "Auth & JWT",
  passport: "Auth",
  "next-auth": "Auth",
  bcrypt: "Auth",
  playwright: "E2E testing",
  cypress: "E2E testing",
  puppeteer: "Browser automation",
  storybook: "Design systems",
  "@storybook/react": "Design systems",
  vitest: "Testing",
  trcp: "tRPC APIs",
  langchain: "AI integrations",
  "@langchain/core": "AI integrations",
  ollama: "AI integrations",
  huggingface: "ML systems",
  numpy: "Data / NumPy",
  pandas: "Data / Pandas",
  "scikit-learn": "Machine learning",
  keras: "ML systems",
  rust: "Rust",
  go: "Go",
  solidity: "Smart contracts",
  ethers: "Web3",
  web3: "Web3",
};

function prettyAbility(raw: string): string {
  const key = raw
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[\s_]+/g, "-");
  if (ABILITY_ALIASES[key]) return ABILITY_ALIASES[key];
  return raw
    .replace(/^@[^/]+\//, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function deriveAbilities(
  languages: { label: string; share: number }[],
  repos: RawRepo[],
): Ability[] {
  const scores = new Map<
    string,
    { label: string; source: string; weight: number }
  >();
  const add = (
    raw: string | null | undefined,
    source: string,
    weight: number,
  ) => {
    if (!raw) return;
    const label = prettyAbility(raw.trim());
    if (!label || label.length > 34) return;
    const key = label.toLowerCase();
    const prev = scores.get(key);
    scores.set(key, {
      label,
      source: prev ? prev.source : source,
      weight: Math.min(100, (prev?.weight ?? 0) + weight),
    });
  };

  // Dependencies are gated to RECOGNISED tech only — the npm long-tail
  // (clsx, babel-*, eslint-*, prop-types, polyfills…) is noise on a skill list.
  // Languages + repo topics + primary languages always count; deps must resolve
  // to a known ability alias to make the cut.
  const knownDep = (d: string) =>
    !!ABILITY_ALIASES[
      d
        .toLowerCase()
        .replace(/^@/, "")
        .replace(/[\s_]+/g, "-")
    ];
  // GitHub linguist reports build/markup files as "languages" — drop the non-skills.
  const NOISE_LANG = new Set([
    "makefile",
    "dockerfile",
    "roff",
    "tex",
    "batchfile",
    "gnuplot",
    "m4",
    "procfile",
    "vim script",
    "vim snippet",
    "rich text format",
    "smarty",
    "ec",
    "hcl",
    "blade",
    "mdx",
    "glossary",
    "raku",
    "nunjucks",
    "pug",
    "ejs",
    "handlebars",
    "gettext catalog",
  ]);
  const skillLang = (label: string) => !NOISE_LANG.has(label.toLowerCase());
  languages.forEach((l) => {
    if (skillLang(l.label)) add(l.label, "language", Math.max(12, l.share));
  });
  repos.forEach((r) => {
    r.topics.forEach((t) => {
      if (skillLang(t)) add(t, "topic", 12);
    });
    r.manifest?.deps?.forEach((d) => {
      if (knownDep(d)) add(d, "dependency", 8);
    });
    if (r.primaryLanguage?.name && skillLang(r.primaryLanguage.name))
      add(r.primaryLanguage.name, "project language", 8);
  });

  return [...scores.values()]
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
    .slice(0, 14);
}

function inferRole(languages: { label: string }[], repos: RawRepo[]): string {
  const langs = languages.map((l) => l.label.toLowerCase());
  const topics = repos.flatMap((r) => r.topics.map((t) => t.toLowerCase()));
  const has = (...xs: string[]) =>
    xs.some((x) => langs.includes(x) || topics.includes(x));
  if (has("machine-learning", "ml", "deep-learning", "pytorch", "tensorflow"))
    return "Machine learning engineer";
  if (
    has("typescript", "javascript", "react", "next") &&
    has("python", "go", "rust")
  )
    return "Full-stack developer";
  if (has("typescript", "javascript", "react", "next", "vue", "svelte"))
    return "Frontend developer";
  if (has("go", "rust", "python", "java", "c++")) return "Backend developer";
  return "Software developer";
}

function safeUrl(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  const v = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    new URL(v);
    return v;
  } catch {
    return undefined;
  }
}

function buildIdentityLinks(
  profile: RawProfile,
): ProfileData["identity"]["links"] {
  const u = profile.user;
  // GitHub returns "" (not null) for unset fields, and websites may lack a scheme.
  const email =
    u.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email) ? u.email : undefined;
  return {
    github: u.url,
    site: safeUrl(u.websiteUrl),
    x: u.twitterUsername ? `https://x.com/${u.twitterUsername}` : undefined,
    email,
  };
}

// ---- the LLM-written part ----

const factsOutputSchema = z.object({
  headline: z.string(),
  role: z.string(),
  projects: z.array(z.object({ name: z.string(), blurb: z.string() })),
});
type FactsOutput = z.infer<typeof factsOutputSchema>;

function mockFacts(
  profile: RawProfile,
  languages: { label: string }[],
): FactsOutput {
  const top = languages.slice(0, 2).map((l) => l.label);
  return {
    headline:
      profile.user.bio?.trim() ??
      (top.length
        ? `Building with ${top.join(" & ")}`
        : "Building things on the internet"),
    role: inferRole(languages, profile.repos),
    projects: profile.repos.map((r) => {
      const intro = compactReadme(r.readme);
      const blurb = intro
        ? firstSentences(intro, 2)
        : (r.description ??
          `A ${r.primaryLanguage?.name ?? "software"} project${
            r.topics[0] ? ` focused on ${r.topics[0]}` : ""
          }.`);
      return { name: r.name, blurb };
    }),
  };
}

// DRAFT facts prompt — reviewed at the checkpoint before going live.
const FACTS_SYSTEM = `You write the factual content for a developer's portfolio from real GitHub data.
Rules:
- Ground every sentence in the provided data. Never invent metrics, employers, or facts.
- BANNED filler: "passionate", "dedicated developer", "clean code", "results-driven", "team player", "across the full stack" (unless literally true and specific).
- Each project blurb: 1–2 sentences, concrete — what it does + the notable tech. If the data is thin, be brief; do not pad.
- headline: one specific line about what this person actually builds (from their real projects/languages).
- role: a short, accurate title (e.g. "Machine learning engineer", "Frontend developer").
Return ONLY JSON: {"headline": string, "role": string, "projects": [{"name": string, "blurb": string}]}.`;

function stripFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

async function liveFacts(
  profile: RawProfile,
): Promise<{ out: FactsOutput | null; usage: UsageRecord; reason?: string }> {
  const context = {
    bio: profile.user.bio,
    repos: profile.repos.map((r) => ({
      name: r.name,
      description: r.description,
      topics: r.topics,
      primaryLanguage: r.primaryLanguage?.name ?? null,
      readme: compactReadme(r.readme),
      fileTree: r.readme ? undefined : r.fileTree.slice(0, 20),
      deps: r.manifest?.deps,
    })),
  };

  const msg = await anthropic().messages.create({
    model: MODELS.facts,
    max_tokens: 1500,
    system: FACTS_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(context) }],
  });

  // Log/record usage BEFORE parsing — we pay for the tokens regardless.
  const usage = buildUsageRecord("facts (Haiku)", MODELS.facts, msg.usage);
  logUsage(usage);

  try {
    const raw: unknown = JSON.parse(stripFences(textOf(msg)));
    return { out: factsOutputSchema.parse(raw), usage };
  } catch (e) {
    return {
      out: null,
      usage,
      reason: e instanceof Error ? e.message : "parse failed",
    };
  }
}

// ---- assembly ----

function deriveProfileFocus(role: string): string[] {
  const r = role.toLowerCase();
  if (/ai|ml|machine|agent|llm|model/.test(r)) {
    return ["LLMs", "agents", "developer tooling"];
  }
  if (/full.?stack|backend|frontend|web/.test(r)) {
    return ["Systems", "interfaces", "tooling"];
  }
  return ["Systems", "tooling", "interfaces"];
}

function deriveProfileStack(
  languages: Language[],
  projects: Project[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (label: string | undefined) => {
    const trimmed = label?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };

  languages.forEach((language) => add(language.label));
  projects.forEach((project) => project.tech.forEach(add));
  return out.slice(0, 18);
}

export async function buildFacts(
  profile: RawProfile,
): Promise<{ data: ProfileData; usage: UsageRecord | null }> {
  const languages = aggregateLanguages(profile.repos);
  const stats = pickStats(profile);
  const abilities = deriveAbilities(languages, profile.repos);

  let out: FactsOutput;
  let usage: UsageRecord | null = null;
  if (isMock) {
    out = mockFacts(profile, languages);
  } else {
    try {
      const r = await liveFacts(profile);
      usage = r.usage; // count Haiku spend even if its output was unusable
      if (r.out) {
        out = r.out;
      } else {
        console.warn("[facts] fallback to mock:", r.reason);
        out = mockFacts(profile, languages);
      }
    } catch (e) {
      console.warn(
        "[facts] fallback to mock (request failed):",
        e instanceof Error ? e.message : e,
      );
      out = mockFacts(profile, languages);
    }
  }

  const blurbByName = new Map(out.projects.map((p) => [p.name, p.blurb]));

  const projects: Project[] = profile.repos.map((r) => ({
    name: r.name,
    blurb:
      blurbByName.get(r.name) ??
      r.description ??
      `A ${r.primaryLanguage?.name ?? "software"} project.`,
    tech: repoTech(r),
    stars: r.stargazerCount > 0 ? r.stargazerCount : undefined,
    demoUrl: safeUrl(r.homepageUrl),
    repoUrl: r.url,
  }));

  const focus = deriveProfileFocus(out.role);
  const stack = deriveProfileStack(languages, projects);

  const data: ProfileData = {
    identity: {
      name: profile.user.name ?? profile.user.login,
      headline: out.headline,
      role: out.role,
      location: profile.user.location ?? undefined,
      links: buildIdentityLinks(profile),
    },
    languages,
    focus,
    stack,
    abilities,
    stats,
    projects,
    // User-curated; never populated by the generator. The dashboard's
    // Credentials tab is the only entry point.
    credentials: [],
  };

  return { data: profileDataSchema.parse(data), usage };
}
