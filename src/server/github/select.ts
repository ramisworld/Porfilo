import type { Language, Stat } from "~/server/profile/model";
import type { RawProfile, RawRepo, RepoNode } from "./types";

export const MAX_PROJECTS = 8;

const LOW_SIGNAL_NAME =
  /(^|[-_])(clone|tutorial|test|tests|example|examples|demo|hello[-_]?world|playground|learn|learning|practice|boilerplate|starter|template|config|dotfiles)([-_]|$)/i;

const daysSince = (iso: string | null): number =>
  iso ? (Date.now() - new Date(iso).getTime()) / 86_400_000 : Infinity;

/** Score every repo and return the best ≤8 (all of them if there are fewer). */
export function scoreAndSelect(
  repos: RepoNode[],
  pinnedNames: string[],
): RepoNode[] {
  const pinned = new Set(pinnedNames);

  const scored = repos
    .filter((r) => !r.isFork)
    .map((r) => {
      let score = r.stargazerCount * 4;
      if (pinned.has(r.name)) score += 6;
      const age = daysSince(r.pushedAt);
      if (age <= 90) score += 3;
      else if (age <= 365) score += 1;
      if (r.description) score += 2;
      if (r.topics.length > 0) score += 2;
      if (r.homepageUrl) score += 3;
      if (r.isArchived) score -= 5;
      if (LOW_SIGNAL_NAME.test(r.name)) score -= 4;
      return { r, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, MAX_PROJECTS).map((s) => s.r);
}

/** Extract the "what is this" intro from a README; strip boilerplate; cap length. */
export function compactReadme(text: string | null): string | null {
  if (!text) return null;
  let s = text.replace(/^﻿/, "");
  s = s.replace(/^---\r?\n[\s\S]*?\r?\n---\s*/, ""); // fenced YAML frontmatter
  s = s.replace(/<!--[\s\S]*?-->/g, ""); // HTML comments
  s = s.replace(/<[^>]+>/g, ""); // HTML tags
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ""); // images / badges
  s = s.replace(/^\[[^\]]*\]:\s*\S+.*$/gm, ""); // reference-style link defs
  s = s.replace(/^\s*[-*]\s*\[[^\]]*\]\([^)]*\)\s*$/gm, ""); // badge-only list items
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // inline links -> link text (empty links vanish)
  s = s.replace(/`([^`]*)`/g, "$1"); // inline code ticks
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1"); // bold
  s = s.replace(/(?<!\*)\*(?!\*)([^*\n]+)\*(?!\*)/g, "$1"); // italic
  s = s.replace(/^\s+/, "");
  // unfenced frontmatter-ish lead (key: value / "- item" lines) at the very top
  s = s.replace(/^(?:[A-Za-z][\w-]*:[ \t].*\r?\n|\s*-[ \t].*\r?\n)+/, "");
  // leading H1 title (the project name belongs elsewhere, not in the blurb)
  s = s.replace(/^\s*#\s+.*\r?\n+/, "");
  // cut at the first subsection heading (## or deeper) — keep just the intro
  const cut = /^#{2,6}\s+/m.exec(s);
  if (cut) s = s.slice(0, cut.index);
  // drop "Welcome to ...!" boilerplate openers
  s = s.replace(/^welcome to [^.!?\n]*[.!?]\s*/i, "");
  s = s.replace(/^#{1,6}\s*/gm, ""); // strip any remaining heading hashes
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  if (s.length > 1600) s = s.slice(0, 1600).trimEnd() + "…";
  return s || null;
}

/** Aggregate + dedupe languages across selected repos into share percentages. */
export function aggregateLanguages(repos: RawRepo[]): Language[] {
  const bytes = new Map<string, number>();
  for (const r of repos) {
    for (const l of r.languages) {
      bytes.set(l.name, (bytes.get(l.name) ?? 0) + l.size);
    }
  }
  const total = [...bytes.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  return [...bytes.entries()]
    .map(([label, size]) => ({ label, share: Math.round((size / total) * 100) }))
    .filter((l) => l.share > 0)
    .sort((a, b) => b.share - a.share)
    .slice(0, 8);
}

const fmt = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);

/** Pick the 3 most impressive *true* stats. Never renders a zero. */
export function pickStats(profile: RawProfile): Stat[] {
  const totalStars = profile.repos.reduce((a, r) => a + r.stargazerCount, 0);
  const years = Math.floor(daysSince(profile.user.createdAt) / 365);
  const langCount = aggregateLanguages(profile.repos).length;

  const candidates: (Stat | null)[] = [
    totalStars > 0 ? { value: fmt(totalStars), label: "GitHub stars" } : null,
    profile.contributions.total > 0
      ? { value: fmt(profile.contributions.total), label: "Contributions (1y)" }
      : null,
    profile.repos.length > 0
      ? { value: fmt(profile.repos.length), label: "Featured projects" }
      : null,
    profile.user.followers > 0
      ? { value: fmt(profile.user.followers), label: "Followers" }
      : null,
    years >= 1 ? { value: `${years}+`, label: "Years on GitHub" } : null,
    langCount > 0 ? { value: String(langCount), label: "Languages" } : null,
  ];

  return candidates.filter((s): s is Stat => s !== null).slice(0, 3);
}
