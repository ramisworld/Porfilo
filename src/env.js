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
    // Conservative amount reserved atomically before a generation starts. The
    // exact recorded cost replaces this reservation when the run settles.
    LLM_GENERATION_RESERVATION_USD: z.coerce
      .number()
      .positive()
      .max(10)
      .default(1),
    GLOBAL_GENERATIONS_PER_HOUR: z.coerce
      .number()
      .int()
      .positive()
      .max(10_000)
      .default(120),
    MAX_CONCURRENT_GENERATIONS: z.coerce
      .number()
      .int()
      .positive()
      .max(100)
      .default(4),
    MAX_CONCURRENT_HERO_CAPTURES: z.coerce
      .number()
      .int()
      .positive()
      .max(20)
      .default(2),
    TRUSTED_IP_HEADER: z
      .enum(["x-forwarded-for", "cf-connecting-ip", "x-real-ip"])
      .default("x-forwarded-for"),
    // Enables POST /api/internal/maintenance for a Railway cron/service.
    MAINTENANCE_SECRET: z.string().min(24).optional(),

    // Anthropic model IDs. Defaults match the architecture doc but can be
    // overridden per-environment (e.g. flip to a smaller model in dev / a
    // newer snapshot in prod) without code changes. Pricing in
    // src/server/llm/cost.ts must include any model you switch to.
    ANTHROPIC_MODEL_FACTS: z.string().default("claude-haiku-4-5"),
    // Both semantic jobs use Haiku. Portfolio layout is selected from our
    // approved catalog; the model never authors arbitrary HTML.
    ANTHROPIC_MODEL_CHOOSER: z.string().default("claude-haiku-4-5"),
    // Kept for backwards-compatible deployments; no new generation path uses it.
    ANTHROPIC_MODEL_DESIGN: z.string().default("claude-haiku-4-5"),

    // ── BetterAuth ────────────────────────────────────────────────────────
    // 32+ char random string. Generate with: `openssl rand -base64 32`
    BETTER_AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(16)
        : z.string().min(16).optional(),
    // Public base URL of the app, e.g. http://localhost:3000 in dev,
    // https://porfilo.com in prod.
    BETTER_AUTH_URL: z.string().url().optional(),

    // ── OAuth providers (end-user sign-in) ────────────────────────────────
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),

    // ── Email (Resend) for magic-link sign-in ─────────────────────────────
    RESEND_API_KEY: z.string().optional(),
    // The "from" address. Use a verified domain in prod (e.g. "Porfilo <auth@mail.rami.co.nz>").
    // In dev with no Resend key, the magic-link URL is logged to the server console.
    EMAIL_FROM: z.string().optional(),

    // ── Custom domains (Cloudflare for SaaS) — legacy, kept for fallback ──
    // Zone id of the root domain (porfilo.com) in our Cloudflare account.
    CLOUDFLARE_ZONE_ID: z.string().optional(),
    // API token scoped to: Custom Hostnames:Edit + SSL and Certificates:Edit
    // on the porfilo.com zone. Server-only.
    CLOUDFLARE_API_TOKEN: z.string().optional(),

    // ── Custom domains (Railway Custom Domains API) ───────────────────────
    // Account/team token from railway.com/account/tokens. Server-only.
    RAILWAY_API_TOKEN: z.string().optional(),
    // IDs of the service the custom domains attach to. Get them with
    // Cmd/Ctrl+K → "Copy Project/Service/Environment ID" in the Railway app.
    RAILWAY_PROJECT_ID: z.string().optional(),
    RAILWAY_SERVICE_ID: z.string().optional(),
    RAILWAY_ENVIRONMENT_ID: z.string().optional(),
    // Port the app listens on (Railway routes the custom domain to it).
    RAILWAY_TARGET_PORT: z.coerce.number().optional(),

    // ── Payments (Stripe) — one-time $9 Porfilo Premium unlock ────────────
    // Secret key (sk_test_… in test mode / sk_live_… in prod). Server-only.
    // Optional so the app still boots without it — the checkout mutation
    // friendly-fails (PRECONDITION_FAILED) when unset.
    STRIPE_SECRET_KEY: z
      .string()
      .regex(/^sk_(test|live)_/)
      .optional(),
    // Signing secret for POST /api/stripe/webhook (whsec_…). From the Stripe
    // CLI (`stripe listen`) in dev, or the Dashboard endpoint in prod.
    STRIPE_WEBHOOK_SECRET: z
      .string()
      .regex(/^whsec_/)
      .optional(),
    // Price id (price_…) for the $9 one-time "Porfilo Premium" line item.
    // Optional — falls back to inline price_data (900 / usd) when unset.
    STRIPE_PREMIUM_PRICE_ID: z
      .string()
      .regex(/^price_/)
      .optional(),
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
    LLM_GENERATION_RESERVATION_USD: process.env.LLM_GENERATION_RESERVATION_USD,
    GLOBAL_GENERATIONS_PER_HOUR: process.env.GLOBAL_GENERATIONS_PER_HOUR,
    MAX_CONCURRENT_GENERATIONS: process.env.MAX_CONCURRENT_GENERATIONS,
    MAX_CONCURRENT_HERO_CAPTURES: process.env.MAX_CONCURRENT_HERO_CAPTURES,
    TRUSTED_IP_HEADER: process.env.TRUSTED_IP_HEADER,
    MAINTENANCE_SECRET: process.env.MAINTENANCE_SECRET,
    ANTHROPIC_MODEL_FACTS: process.env.ANTHROPIC_MODEL_FACTS,
    ANTHROPIC_MODEL_CHOOSER: process.env.ANTHROPIC_MODEL_CHOOSER,
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
    RAILWAY_API_TOKEN: process.env.RAILWAY_API_TOKEN,
    RAILWAY_PROJECT_ID: process.env.RAILWAY_PROJECT_ID,
    RAILWAY_SERVICE_ID: process.env.RAILWAY_SERVICE_ID,
    RAILWAY_ENVIRONMENT_ID: process.env.RAILWAY_ENVIRONMENT_ID,
    RAILWAY_TARGET_PORT: process.env.RAILWAY_TARGET_PORT,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PREMIUM_PRICE_ID: process.env.STRIPE_PREMIUM_PRICE_ID,
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

// Checkout without a webhook can collect money without granting access. Treat
// partial Stripe configuration as a deployment error instead of a runtime bug.
if (env.NODE_ENV === "production") {
  if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is configured.",
    );
  }
  if (env.STRIPE_WEBHOOK_SECRET && !env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY is required when STRIPE_WEBHOOK_SECRET is configured.",
    );
  }
}
