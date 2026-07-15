# Porfilo — Landing page: "Proof" + real example portfolios

## 0. Mission

Rebuild the marketing landing page at **`src/app/(marketing)/page.tsx`** to the approved **"Proof"** design, and replace its **fake, CSS-mockup portfolio cards** with **real portfolios** — actual Porfilo worlds, filled with real researched data for well-known developers, pre-rendered to images.

**The approved design is `landing-prompts/PROOF_REFERENCE.html`** — a standalone HTML reference. Open and study it first. Match its layout, composition, and feel; port it into the app's React/Next + existing conventions (don't ship the raw HTML).

Work through this in order, and **stop for approval** at the end (§9).

---

## 1. Preserve the working product flow (critical — do not delete)

The current `src/app/(marketing)/page.tsx` (~813 lines) already contains **real, working product logic**:

- `USERNAME_RE` validation (mirrors the server-side Zod check)
- the generate flow + `TERMINAL_STEPS` build log + spinner states
- routing, the wordmark, existing components (`BlurText`, `RotatingText`, `ShinyText`, `Aurora`, etc.)

**This is a re-skin, not a rewrite.** Keep the flow intact and wire the Proof hero's `@your-github` field + **Generate** button to the *existing* generation logic. The Proof reference's inline `<script>` is a static mock — it is a visual spec only, not the implementation. Reuse the app's existing components where they fit (the reference's rotating word ≈ the existing `RotatingText` / `HERO_NOUNS`).

If a Proof element conflicts with working logic, keep the logic and adapt the visual.

---

## 2. What you're replacing

In `PROOF_REFERENCE.html` the background is a **gallery wall**: `#wall` → 5 × `.col` → `.track` (CSS `@keyframes up` scrolling `translateY(-50%)`, content duplicated for a seamless loop), filled with `.card` elements drawn by the `card(p)` function from a **fake `people` array** (Aiko Tanaka, Marco Rossi, Lena Berg…) with invented handles, repos, star counts, and language bars, in 3 CSS mockup variants.

**Delete the fake `people` array and the CSS mockup variants entirely.** Each card becomes **a real portfolio thumbnail** (see §3–§5).

**Keep** the wall's chrome: the 5-column layout, per-column `--dur` scroll speeds, the `perspective/rotateX` tilt, the radial `mask-image`, the per-column `filter` brightness falloff, `.scrim`, `.grain`, the `.card` frame + hover-scale, the mobile rule that hides columns 1 & 5, and the `prefers-reduced-motion` stop.

---

## 3. Use pre-rendered images — do NOT use live iframes

The wall renders **~50 card elements** (5 columns × 5 cards, each duplicated for the seamless loop). Our worlds each run canvas/WebGL animation loops — 50 live `srcdoc` iframes would destroy the page.

**Pre-render each example to an optimized image at build time**, then the wall shows `<img>`. Real worlds, real data, real renders — zero runtime cost. The landing page must stay fast.

Pipeline per example:
1. Fill a world template's `DATA` with the person's researched data (§5) → save `landing-prompts/examples/<handle>-<world>.html`.
2. Render a **portrait** screenshot (a tall thumbnail reads as a real website in a 258px column — e.g. viewport ~1200×1500, or a full-page capture cropped to portrait). Playwright with `--use-gl=swiftshader` so WebGL renders headless; `world-prompts/`'s helper `node scratch-shot.mjs <path>` is a working reference implementation.
3. Save optimized → `public/examples/<handle>-<world>.webp` (webp/avif, correctly sized for the 258px column at 2×, `loading="lazy"`, explicit `width`/`height` to avoid layout shift).

Commit the generated `.html` sources too — they're the provenance for each thumbnail.

---

## 4. The worlds available

Fill these via the `DATA` object **only** — read **`world-prompts/FILL_CONTRACT.md`** first:

- `world-prompts/brutalist.html` — done
- `world-prompts/terminal-nexus.html` — done
- `magazine`, `os`, `terminal` — being built separately; **add them as they land** (see §7 — the example set is config-driven so this is a one-line change).

Assign each person a world that genuinely suits their character/work (a kernel hacker → terminal; a design-engineer → brutalist/magazine; etc.). Aim for even spread across worlds so the wall looks varied.

---

## 5. The research (the most important part)

Choose **~10 well-known developers with a real, public GitHub presence.** For each, research and **verify**:

- Real full name, real GitHub handle, real role/title, real location
- An accurate headline — what they're genuinely known for
- **4–6 real repositories**: exact repo names, real star counts, real primary language, and an accurate one-line description
- Their real primary stack / languages

**Rules — accuracy is non-negotiable:**
- **Verify every fact** against the GitHub API/profile and reputable sources. **Never invent** a repo, a statistic, a location, or a bio. If you cannot verify a field, **omit it** — do not guess or approximate.
- **Snapshot star/contribution counts** with the date you fetched them (they drift). Put the date in a comment in the config.
- The honest-data rules still apply and are already enforced inside the world templates: **no language percentages**, and **stars render only when `>= 50`** — for these developers stars are legitimately large, so they'll show, which is the point.
- Use only **public** profile data. Do not scrape anything private, and do not use their photographs/avatars.

**Candidate pool** (verify each, swap freely): `torvalds`, `karpathy`, `gaearon`, `rauchg`, `yyx990803`, `sindresorhus`, `tiangolo`, `simonw`, `mitchellh`, `Rich-Harris`, `addyosmani`, `charliermarsh`. Prefer people whose *work* is legible in a portfolio.

---

## 6. Attribution + labeling (required)

These are **real people who have not endorsed this product**. The page must not imply they use, endorse, or are affiliated with Porfilo.

- Add a clear, visible disclosure near the wall / in the footer, e.g.:
  > *Illustrative examples generated from public GitHub profiles. Not affiliated with, or endorsed by, the developers shown.*
- Review the hero copy so nothing reads as a testimonial. The reference's line — *"Every site below was generated from a real GitHub in seconds"* — stays accurate **only if** each thumbnail really is generated from that person's real public data. Keep it true or change it.
- No avatars/photographs of the people. Name + handle + their public repo facts only.

---

## 7. Keep the example set config-driven

Put the examples in **one config module** (e.g. `landing-prompts/examples.ts` or `src/app/(marketing)/_examples.ts`):

```ts
export const EXAMPLES = [
  { handle: "torvalds", name: "Linus Torvalds", world: "terminal", thumb: "/examples/torvalds-terminal.webp", w: 1200, h: 1500 },
  …
];
```

The wall maps over this. Adding a person or a newly-finished world must be a **one-line change**, never a page edit. Keep each person's researched `DATA` beside its generated `.html` so it can be re-rendered.

---

## 8. Verify

- `pnpm typecheck` passes. **Note: `pnpm lint` / `pnpm check` are broken repo-wide** (bad `typescript-estree`) — use `pnpm typecheck`, don't try to fix lint.
- The landing renders: wall scrolls smoothly in 5 columns, hover-scale works, the tilt/mask/scrim/grain match the reference.
- **Mobile 390**: columns 1 & 5 hidden, hero legible, no horizontal scroll. **Desktop 1440** matches the reference composition.
- `prefers-reduced-motion`: the wall stops, page stays fully populated.
- **The generate flow still works end-to-end** (type a username → the existing generation path runs).
- Performance: no jank; images lazy, sized, optimized. The wall must not regress FCP.
- Screenshot desktop + mobile.

---

## 9. Report and stop

When done: show the desktop + mobile screenshots, the `pnpm dev` URL, the list of people + the world each got (with the star-count snapshot date), confirm `pnpm typecheck` passes and the generate flow works — then **stop and wait for approval**. Don't move on to other work.
