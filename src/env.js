import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // GitHub PAT (public read) for the server-side GraphQL scraping (different
    // from the GitHub OAuth client below — that's for end-user sign-in).
    GITHUB_TOKEN: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    MOCK_LLM: z.enum(["true", "false"]).default("true"),
    // Hard daily cap (USD). When the day's accumulated spend reaches this,
    // /api/generate returns 503 until UTC midnight. Leave unset to disable.
    DAILY_LLM_BUDGET_USD: z.string().optional(),

    // Anthropic model IDs. Defaults match the architecture doc but can be
    // overridden per-environment (e.g. flip to a smaller model in dev / a
    // newer snapshot in prod) without code changes. Pricing in
    // src/server/llm/cost.ts must include any model you switch to.
    ANTHROPIC_MODEL_FACTS: z.string().default("claude-haiku-4-5"),
    ANTHROPIC_MODEL_DESIGN: z.string().default("claude-opus-4-8"),

    // ── BetterAuth ────────────────────────────────────────────────────────
    // 32+ char random string. Generate with: `openssl rand -base64 32`
    BETTER_AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(16)
        : z.string().min(16).optional(),
    // Public base URL of the app, e.g. http://localhost:3000 in dev,
    // https://porthub.dev in prod.
    BETTER_AUTH_URL: z.string().url().optional(),

    // ── OAuth providers (end-user sign-in) ────────────────────────────────
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),

    // ── Email (Resend) for magic-link sign-in ─────────────────────────────
    RESEND_API_KEY: z.string().optional(),
    // The "from" address. Use a verified domain in prod (e.g. "PortHub <auth@porthub.dev>").
    // In dev with no Resend key, the magic-link URL is logged to the server console.
    EMAIL_FROM: z.string().optional(),

    // ── Custom domains (Cloudflare for SaaS) ──────────────────────────────
    // Zone id of the root domain (porthub.dev) in our Cloudflare account.
    CLOUDFLARE_ZONE_ID: z.string().optional(),
    // API token scoped to: Custom Hostnames:Edit + SSL and Certificates:Edit
    // on the porthub.dev zone. Server-only.
    CLOUDFLARE_API_TOKEN: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // Root domain for subdomain routing + Preview links. `localhost:3000` in dev.
    NEXT_PUBLIC_ROOT_DOMAIN: z.string().default("localhost:3000"),
    // The hostname users CNAME their custom domain to. Stable forever — never
    // bake in an IP or a Railway-internal hostname. Falls back to the root
    // domain so dev still works without configuring a separate target.
    NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET: z.string().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    MOCK_LLM: process.env.MOCK_LLM,
    DAILY_LLM_BUDGET_USD: process.env.DAILY_LLM_BUDGET_USD,
    ANTHROPIC_MODEL_FACTS: process.env.ANTHROPIC_MODEL_FACTS,
    ANTHROPIC_MODEL_DESIGN: process.env.ANTHROPIC_MODEL_DESIGN,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET:
      process.env.NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
