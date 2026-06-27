# PortHub — Architecture

## 0. The core model: facts + art direction + a shared premium engine

PortHub no longer asks the LLM to write full HTML/CSS/JS for every portfolio. That approach
was expensive, brittle, and too dependent on one model call getting layout, animation,
accessibility, and performance right at the same time.

The product now has three layers:

- **Layer 1 — Facts (`ProfileData`):** deterministic GitHub scraping + a small model. Curates the
  user's best work into a small structured object. This is "compaction".
- **Layer 2 — Art direction (`DesignSpec`):** a tiny JSON recipe. The model picks palette,
  typography, motion, WebGL scene, boot treatment, component skins, and an **experience pack**.
- **Layer 3 — Shared engine:** hand-built PortHub code renders `ProfileData + DesignSpec` into
  the actual interactive portfolio. This is where the design quality lives.

The engine is the core IP. It ships once as `public/engine/<version>.js/.css` and every portfolio
references that shared bundle. Existing portfolios store only the recipe, so engine upgrades can
improve old portfolios without regenerating code.

### Experience packs

PortHub should feel like a catalogue of living worlds, not a template with different colors.
Each experience pack owns the whole composition: loader, navigation, section naming, typography,
layout rhythm, project cards, contact treatment, scroll choreography, cursor behavior, and the
WebGL/canvas scene contract.

Examples:

- `terminalNexus` — cyber terminal, side telemetry, reactive particles, command-line modules.
- `directorCut` — cinematic letterbox, scene/take boot slate, timeline scrubber, act-based layout.
- `desktopOS` — draggable-feeling app windows, dock/taskbar, filesystem metaphors.
- `gameHud` — player card, ability tree, inventory, quest log, rank/XP language treatment.
- `liquidGlass` — refractive glass, editorial spacing, fluid cards, premium calm motion.

The art-director LLM should choose an experience pack; it should not invent implementation details.
Variety comes from pack x scene x palette x typography x content x motion parameters.

## 1. Stack (T3-inspired, opinionated)

Scaffolded with **`create-t3-app`**, with BetterAuth for auth.

| Concern                | Choice                                                                      | Why                                                          |
| ---------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Framework              | **Next.js 15, App Router, TypeScript**                                      | SSR, OG images, host-based multi-tenant routing              |
| Styling (app UI)       | **Tailwind v4**                                                             | The PortHub app chrome (not the generated portfolios)        |
| Data layer             | **tRPC** + **one streaming Route Handler** (generate)                       | Typed mutations; SSE for the live build log                  |
| DB                     | **PostgreSQL** — Docker (local) / Railway (prod) + **Prisma**               | Reproducible local DB; managed prod                          |
| Auth                   | **BetterAuth** (GitHub + Google OAuth + email magic link)                   | Self-hosted sessions in our own Postgres                     |
| Facts model (Layer 1)  | **`claude-haiku-4-5`** + deterministic code                                 | Cheap repo→blurb condensing                                  |
| Design model (Layer 2) | **`claude-opus-4-8`** (A/B `claude-sonnet-4-6`)                             | Strong design instincts, low AI-slop                         |
| Portfolio runtime      | **Shared engine bundle** (`public/engine/v*.js/.css`)                       | Rich hand-built interactions, cached once, cheap generations |
| Rendering              | **Sandboxed `<iframe srcdoc>`** (`allow-scripts`, NOT `allow-same-origin`)  | Untrusted generated JS can't touch the app                   |
| GitHub                 | **`@octokit/graphql`**, server-side token                                   | One query, 5,000 req/hr                                      |
| Multi-tenant routing   | **`middleware.ts`** host rewrite (Host **or** `x-porthub-host`)             | `<slug>.porthub.rami.co.nz` + user-owned custom domains      |
| Custom domains         | **Cloudflare for SaaS** (certs) + **Cloudflare Worker** (routing) → Railway | Unlimited user domains, 100 free, no Railway domain-limit    |
| Payments               | **Stripe** (planned)                                                        | Custom-domain / branding / Pro                               |
| Hosting                | **Railway** (app + Postgres); app root at `porthub.rami.co.nz`              | Always-on Node server + managed DB                           |
| IDs                    | **`nanoid`**                                                                | The unguessable `slug` subdomain                             |
| Validation             | **Zod**                                                                     | `ProfileData` contract                                       |

### Local development (Docker)

- **Postgres runs in Docker locally** via `docker-compose.yml`; Prisma uses its `DATABASE_URL`.
- **App runs natively** (`pnpm dev`) for fast HMR — not containerized.
- **Prod:** Railway runs both the Next.js app (Nixpacks build, Node 20+) and a Postgres service.
  - The app is reachable at `porthub.rami.co.nz` (a Railway custom domain).
  - `NEXT_PUBLIC_ROOT_DOMAIN=porthub.rami.co.nz` in prod, `localhost:3000` locally.

## 2. Multi-tenant / subdomain routing (local-first)

```
Request ──▶ middleware.ts  (effectiveHost = x-porthub-host header ?? Host)
   ├─ effectiveHost == ROOT_DOMAIN        → serve the app (marketing / dashboard / editor)
   ├─ effectiveHost == <slug>.ROOT_DOMAIN → rewrite to /sites/<slug>
   └─ anything else (a user-owned domain) → rewrite to /sites-by-host/<host>
                                            (DB lookup of the CustomDomain row)
```

- **`x-porthub-host` takes priority over `Host`.** Custom-domain traffic arrives via the
  Cloudflare Worker (Section 2a) as our own upstream host, with the real domain carried in
  `x-porthub-host`. The middleware honors that header first.
- **Local:** browsers auto-resolve `*.localhost` → `127.0.0.1` (no `/etc/hosts`). `<slug>.localhost:3000` works out of the box. `NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000`.
- **Prod:** `NEXT_PUBLIC_ROOT_DOMAIN=porthub.rami.co.nz`. Reserved subdomains (`www`, `app`, `api`) serve the app.
- **`rewrite`, not redirect** — the host stays in the URL bar.
- The `/engine/*` bundle is never rewritten — it must serve identically on every host.

## 2a. Custom domains (Cloudflare for SaaS + Worker + Railway)

The problem: Railway's edge only serves hostnames it has explicitly registered, and caps
custom domains per service (2 on Hobby, 20 on Pro). That can't scale to arbitrary user domains.
The solution decouples **certificates + routing** (Cloudflare) from **hosting** (Railway).

```
visitor ─▶ https://john.com
   │  (user added: CNAME john.com → proxy-fallback.rami.co.nz  +  ownership TXT)
   ▼
Cloudflare for SaaS   issues & serves john.com's TLS cert (100 free, then $0.10/mo each)
   │  traffic enters the rami.co.nz zone, matched by the Worker route */*
   ▼
Cloudflare Worker (workers/domain-router)
   • reads the original host (john.com)
   • fetches https://porthub.rami.co.nz  (which Railway DOES accept)
   • sets header  x-porthub-host: john.com
   ▼
Railway (Next.js app)  middleware reads x-porthub-host → /sites-by-host/john.com → portfolio
```

Key pieces:

- **Cloudflare for SaaS (Custom Hostnames):** the app calls the CF API (`src/server/domains/cloudflare.ts`)
  to register each user domain; CF issues the cert automatically. Status is polled via `recheck`.
- **Fallback origin** `proxy-fallback.rami.co.nz`: an originless DNS record (`AAAA 100::`, proxied)
  that all custom-hostname traffic is funneled to.
- **Worker route `*/*`** runs the bridge for every host entering the zone. Two **no-worker** routes
  (`rami.co.nz/*` and `*.rami.co.nz/*`) exclude our own hosts so the app, dashboard, portfolio
  subdomains, and the Worker's own upstream request all bypass the Worker (this also prevents loops).
- **`CustomDomain` table** maps `hostname → portfolio`; `/sites-by-host/[host]` only renders when the
  row's `status === "active"`.

**The owner domain `rami.co.nz` is the exception.** It IS the SaaS zone, so it can't be its own
custom hostname (Cloudflare forbids a custom hostname matching the zone name, and the Worker bypasses
`rami.co.nz`). Instead it's registered **directly on Railway** as a custom domain (its own cert),
and its `CustomDomain` row is marked active so the middleware maps `rami.co.nz → the owner's portfolio`.

## 3. Repo layout (target)

```
porthub/
  docker-compose.yml             # local Postgres
  src/
    middleware.ts                # host-based subdomain rewrite
    app/
      (marketing)/page.tsx       # landing: username + vibe inputs (+ later gallery)
      (app)/
        generate/page.tsx        # live build-log screen (SSE)
        dashboard/page.tsx       # (Phase 2) user's portfolios
        edit/[id]/page.tsx       # (Phase 2) ProfileData editor
      sites/[slug]/page.tsx      # REWRITE TARGET (subdomain): renders recipe through shared engine in sandboxed iframe
      sites-by-host/[host]/page.tsx  # REWRITE TARGET (custom domain): DB lookup → same renderer
      sites/[slug]/opengraph-image.tsx
      api/
        generate/route.ts        # streaming pipeline (SSE)
        trpc/[trpc]/route.ts
    server/
      github/                    # GraphQL query + select/compact (deterministic)
      llm/
        facts.ts                 # Layer 1: Haiku blurbs → ProfileData
        design.ts                # Layer 2: art director → tiny DesignSpec JSON
      profile/                   # ProfileData (Zod), data-injection + export helpers
      domains/
        cloudflare.ts            # Cloudflare for SaaS (Custom Hostnames) client — active
        railway.ts               # Railway custom-domain client — legacy/unused
    lib/issuers.ts               # credential issuer registry (logos + colors)
    engine/
      spec.ts                    # DesignSpec contract and registries
      runtime/                   # browser DOM builders, packs, skins, fallback backgrounds
      premium/                   # Three.js, GSAP, boot screens, cursor, scroll choreography
  workers/
    domain-router/               # Cloudflare Worker: custom-domain bridge → Railway (x-porthub-host)
  prisma/schema.prisma
  docs/
```

## 4. The generation engine (core IP)

```
username + vibe
  └─▶ [GitHub GraphQL fetch]      server/github/fetch.ts     (cache by username)
       └─▶ [select + compact]     server/github/select.ts    (≤8 repos, README-or-not)
            └─▶ [Haiku → ProfileData]  server/llm/facts.ts    (cheap, structured FACTS)
                 └─▶ [Art director → DesignSpec] server/llm/design.ts
                      └─▶ persist Portfolio{profileData, designSpec, engineVersion, slug}
                           └─▶ /sites/<slug> renders the shared engine in a sandboxed iframe
```

### Layer 1 — Facts (`ProfileData`): what "compaction" means

Deterministic selection + a cheap Haiku condense. Never feeds raw GitHub to Opus.

- **Repo selection:** score every repo (stars + recency + pinned + topics + has-demo +
  description quality − fork/archived/tutorial). Take the **top 8**; if the user has fewer than
  8 real repos, **include them all.**
- **Signal per repo:** description, topics, language breakdown, stars, demo URL, and the README
  **intro section only** (strip badges/TOC/install/license, cap ~400 tokens).
- **No-README repos still qualify:** use description + topics + languages + top-level file tree
  - `package.json`/`pyproject` (name, deps). A starred README-less repo can outrank a documented
    trivial one.
- **Haiku condense:** turn each repo's signals into a tight 1–2 sentence blurb (~$0.005 total).
- Output is the structured `ProfileData` (Section 5) — the durable, editable layer.

### Layer 2 — Art direction (`DesignSpec`)

One small model call: `ProfileData + vibe -> DesignSpec`.

The model chooses from strict registries:

- `experience`: full-page world/composition.
- `webgl.scene`: reusable premium scene module.
- `theme`, `typography`, `skins`, `motion`, `cursor`, `boot`, `postfx`.
- optional bounded `signatureCss` for tiny visual flourishes only.

The model must not write HTML or arbitrary JS. That keeps generation cheap and keeps the visual
quality in code we can test.

### Layer 3 — Shared engine

The engine renders the portfolio in the iframe. It contains:

- DOM renderers for each experience pack.
- Premium WebGL scenes using Three.js shaders, particles, bloom, chromatic shift, and scroll-driven
  uniforms.
- GSAP choreography: ScrollTrigger timelines, ScrollSmoother, ScrambleText, hover/cursor effects,
  section-aware nav, and per-pack animation hooks.
- 2D fallbacks and reduced-motion paths.
- A stable component vocabulary for stats, abilities, projects, contact, and identity.

### Model strategy & cost

In the shared-engine approach, output tokens are tiny because the model writes only JSON:

| Layer             | Model              | Tokens             | Cost                 |
| ----------------- | ------------------ | ------------------ | -------------------- |
| Facts             | `claude-haiku-4-5` | ~3K in / ~0.4K out | ~$0.005              |
| Art direction     | small/medium model | ~2K in / ~0.5K out | ~2-3 cents target    |
| **Per portfolio** |                    |                    | **low cents target** |

- **The cost lever is the engine:** invest engineering time in reusable premium packs instead of
  paying models to retype UI code.
- **The quality lever is pack depth:** every pack needs its own layout rules, not just a theme.
- **What blows the product:** generic grids, generic bars, generic cards, and background-only wow.

## 5. `ProfileData` (the contract — Zod)

The editable facts layer. The generated page reads it as injected `DATA`.

```
ProfileData {
  identity    { name, headline, role, location, links{github,site,x,linkedin,email} }
  languages   [{ label, share }]                // aggregated + deduped; share is not displayed as skill grade
  abilities   [{ label, source?, weight? }]      // derived from languages/topics/deps; rendered as skills/abilities
  stats       [{ value, label }]                // flattering-but-true, never a zero
  projects    [{ name, blurb, tech[], stars?, demoUrl?, repoUrl }]   // ≤ 9 (3×3 grid)
  credentials [{ title, issuer, issuerKey?, credentialId?, url?, skills?[] }]   // ≤ 20, user-curated
}
```

- **Credentials** are user-curated (not generated): the dashboard's Credentials tab. `issuerKey`
  binds a row to a logo in `src/lib/issuers.ts`; unknown issuers use a neutral certificate fallback.
  (There are intentionally **no issued/expiry dates** — credentials are date-less.)
- Editing `ProfileData` updates the injected `DATA` (free, no regeneration). Restyling regenerates
  the `DesignSpec`. Export bundles the engine + `DATA` into a self-hostable file.

## 6. Data model (Prisma)

```
User         { id, name, email, plan(free|pro), createdAt }          // BetterAuth
Session/Account/Verification { … }                                    // BetterAuth tables
Portfolio    { id, ownerId(unique), githubUsername, slug(unique),
               vibe(String), profileData(Json), designSpec(Json), engineVersion(String),
               isPublic, views, createdAt }
CustomDomain { id, portfolioId(unique), hostname(unique), status(pending|active|action_needed|error),
               cfHostnameId?, cnameTarget?, verificationHost?, verificationToken?,
               ownershipStatus?, sslStatus?, activatedAt?, lastCheckedAt, errorReason? }
GitHubCache  { username(unique), raw(Json), fetchedAt }               // TTL for rate limits
GenerationLock { ownerId(unique), githubUsername, expiresAt }         // one generation at a time
```

- One portfolio per user (`ownerId` unique). `CustomDomain` is 1:1 with a portfolio for now.
- `cfHostnameId` is set for Cloudflare-for-SaaS domains; a null `cfHostnameId` means the row is
  externally/Railway-managed (e.g. the owner's `rami.co.nz`) and `recheck` leaves it untouched.

## 7. Security & limits

- **Generated code is untrusted** → render only in a sandboxed `<iframe srcdoc>` with
  `allow-scripts` and **without** `allow-same-origin`. Never `dangerouslySetInnerHTML` into the app.
- GitHub token server-side only; per-username cache + TTL.
- README markdown sanitized before it reaches any model context.
- Rate-limit `api/generate` per IP/user.
- Middleware rewrites (not redirects); reserve root subdomains.
