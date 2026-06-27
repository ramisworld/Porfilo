# PortHub

Turn a GitHub username into a beautiful, hosted developer portfolio in seconds —
one that **looks hand-made, actually represents you, and is yours to keep.**

## The one-line thesis

> Competitors (Crazzy, Foliox) wrap a **fixed template** around a lazy three-sentence LLM call —
> so every user's portfolio looks the same. PortHub **generates a bespoke, interactive site**
> from your real work *and your stated vibe* — and the generated code is **yours to keep.**

## How it works (user flow)

1. Land on the page → type your GitHub username (e.g. `ramisworld`).
2. **Describe the vibe** in your own words ("dark hacker terminal, neon green, minimal").
3. Hit generate → a live "build log" plays while we fetch → curate → write → compose.
4. **Tada** — your portfolio is live on `<slug>.localhost:3000` (dev) / `<slug>.porthub.rami.co.nz` (prod).
5. Create an account to **claim & edit** it, and connect your own **custom domain** (`you.com`) — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §2a.

No login wall in front of the magic. The first generation is anonymous and costs us **~$0.05**.

## Differentiators (the moat)

1. **Bespoke generative design** — the LLM writes the actual interactive, animated UI to match
   *your* vibe. Not a template everyone shares.
2. **Substance** — curates your best (≤8) repos, writes specific copy from real signals. No
   duplicate language pills, no giant "0 stars". README or not.
3. **Ownership** — the generated code is the artifact: edit the facts, restyle with AI, export
   and host anywhere.
4. **Gallery flywheel** — community portfolios under the CTA = proof + distribution.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, data model, the generation engine.
- [`docs/specs/`](docs/specs/) — one spec-kit per delivery phase:
  - [Phase 1 — MVP](docs/specs/phase-1-mvp.md)
  - [Phase 2 — Loop](docs/specs/phase-2-loop.md)
  - [Phase 3 — Control](docs/specs/phase-3-control.md)
  - [Phase 4 — Monetize](docs/specs/phase-4-monetize.md)

## Status

Live on Railway, served at `porthub.rami.co.nz`. Generation, accounts, editing, credentials, and
user-owned custom domains (Cloudflare for SaaS) are all working. The `docs/specs/` phase docs are
kept as historical planning notes; `docs/ARCHITECTURE.md` is the source of truth for the current system.
