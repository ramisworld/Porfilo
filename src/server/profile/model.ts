import { z } from "zod";

/**
 * ProfileData — the editable "facts" layer (see docs/ARCHITECTURE.md §5).
 *
 * Built by Layer 1 (deterministic select + Haiku condense), stored on
 * Portfolio.profileData, and injected into the generated page as `const DATA`.
 * The LLM writes content into this shape; it never designs layout.
 */

export const linksSchema = z.object({
  github: z.string().url().optional(),
  site: z.string().url().optional(),
  x: z.string().url().optional(),
  linkedin: z.string().url().optional(),
  email: z.string().email().optional(),
});

export const languageSchema = z.object({
  label: z.string(),
  /** 0-100, aggregated + deduped share of bytes across repos. Internal signal, not a skill grade. */
  share: z.number().min(0).max(100),
});

export const abilitySchema = z.object({
  label: z.string(),
  source: z.string().optional(),
  weight: z.number().min(0).max(100).optional(),
});

export const focusLabelSchema = z.string().trim().min(1).max(48);
export const stackLabelSchema = z.string().trim().min(1).max(40);

export const statSchema = z.object({
  /** Pre-formatted, flattering-but-true (never a zero). e.g. "1.2k", "6", "2023". */
  value: z.string(),
  label: z.string(),
});

export const projectSchema = z.object({
  name: z.string(),
  /** 1–2 sentence, grounded blurb (from README intro / topics / manifest). */
  blurb: z.string(),
  tech: z.array(z.string()),
  stars: z.number().int().nonnegative().optional(),
  demoUrl: z.string().url().optional(),
  repoUrl: z.string().url(),
});

// User-curated credentials (certifications / licenses).
//
// Default-empty — generated portfolios never come pre-populated; users opt in
// through the dashboard's Credentials tab. The `issuerKey` is what binds a row
// to a logo in src/lib/issuers.ts; unknown issuers use a generic credential icon.
export const credentialSchema = z.object({
  title: z.string().min(1).max(140),
  issuer: z.string().min(1).max(80),
  issuerKey: z.string().max(40).optional(),
  credentialId: z.string().max(80).optional(),
  url: z.string().url().optional(),
  skills: z.array(z.string().min(1).max(40)).max(15).optional(),
});

export const profileDataSchema = z.object({
  identity: z.object({
    name: z.string(),
    headline: z.string(),
    role: z.string(),
    location: z.string().optional(),
    links: linksSchema,
  }),
  languages: z.array(languageSchema),
  focus: z.array(focusLabelSchema).max(8).default([]),
  stack: z.array(stackLabelSchema).max(18).default([]),
  abilities: z.array(abilitySchema).default([]),
  stats: z.array(statSchema),
  projects: z.array(projectSchema).max(9),
  credentials: z.array(credentialSchema).max(20).default([]),
});

export type Links = z.infer<typeof linksSchema>;
export type Language = z.infer<typeof languageSchema>;
export type Ability = z.infer<typeof abilitySchema>;
export type Stat = z.infer<typeof statSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Credential = z.infer<typeof credentialSchema>;
export type ProfileData = z.infer<typeof profileDataSchema>;
