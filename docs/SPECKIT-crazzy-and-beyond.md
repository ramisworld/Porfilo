# PortHub — Speckit: Reaching crazzy-level (and beyond)

**Author:** lead (Opus). **Baseline:** `717c790 "mvp complete"` (clean).
**Status:** plan. **Cost:** all work runs `MOCK_LLM=true` → $0 until the final live step.

## 0. Grounding (what's actually true, verified by screenshot)

I drove the running app and looked at 3 packs × multiple scroll depths. Facts:

- The baseline is **good, not "awful"** (that was a reverted attempt). The **terminal pack
  (`terminalNexus`) is ~80% of the bar already** — visible particle field, bloom, terminal chrome,
  skills-not-scores, clean project grid.
- **Biggest single defect:** `spec.ts` declares 6 WebGL scenes; only `starfield` + `glassOrb`
  exist. `energyCube`/`prismField`/`voidRings` **silently fall back to an invisible starfield** →
  large empty voids in `directorCut`, `liquidGlass`, `desktopOS`, `gameHud`, `cosmicLab`.
- **No scroll/cursor-reactive 3D** yet (the crazzy "wow": cube explodes on scroll, particles chase
  the cursor). Scenes only drift.
- **Content rule half-applied:** abilities render as skills (good), but contact shows only a GitHub
  button — **email + location not surfaced**; languages still carry an internal share.

**The differentiator vs. the last two attempts:** they authored visuals blind. This plan bakes in a
**screenshot-review loop** (§1) — every visual deliverable is captured and eyeballed (by me, then
you) before moving on. No big-bang refactor; one pack perfected at a time.

**Explicit non-goal (for now):** the generative infra (seed/coherence/composition-grammar) that the
prior model built first. That ordering produced soulless output. We parameterize **after** packs
look incredible (Phase 6), not before.

---

## 1. Phase 0 — Harness + scene contract (foundation)

**Goal:** a repeatable visual loop and the API every rich scene needs.

- `scripts/shoot.mjs` — committed Playwright tool: generate a vibe (mock), load
  `/sites/<slug>`, drive boot + scroll, write `/.shots/<pack>_<n>.png`. Headless Chromium with
  `--use-gl=angle --use-angle=swiftshader`. Cross-origin iframe → scroll via `mouse.wheel`.
- Extend **`SceneHandle`** (`src/engine/premium/scene-types.ts`) from `update()`-only to:
  ```ts
  interface SceneHandle {
    group: THREE.Object3D;
    update(dt, progress, vel, pointer): void;       // per frame
    onSection?(id: string, dir: 1 | -1): void;      // a section entered view
    setMode?(mode: "calm" | "tense" | "climax"): void; // scroll-driven intensity band
    burst?(kind?: string): void;                    // explosion / energy beam
    reconstruct?(): void;                           // reverse the burst (scroll-up)
    dispose?(): void;                               // free GPU resources
  }
  ```
- `webgl.ts`: route real scene names (fix the silent fallback — **only declare implemented scenes**),
  expose a **DOM flash/beam overlay** the scene can fire on `burst()` (white/accent screen beam +
  bloom + chromatic spike), and feed `setMode`/`onSection` from the scroll layer.
- **Gate:** harness produces a labeled screenshot of the current terminal pack on demand.

## 2. Phase 1 — WebGL scene library (fill the voids, add the wow)

Each scene is hand-built, **scroll- and cursor-reactive**, parameterized (so one scene → many
looks). Build + screenshot-review **one at a time**.

1. **`energyCube`** *(deliverable 1 — Director's Cut)* — six plane faces around a glowing core.
   Scroll 0→`explodeAt`: faces disperse + distort, core energy grows. Cross `explodeAt` down →
   `burst()`: faces fly out, core fires a beam, **screen flash**, bloom spike. Scroll-up →
   `reconstruct()`. Params: `faceColor, coreColor, dispersion, explodeAt, wireframe, distortion,
   speed`.
2. **`particleFly`** *(Terminal/HUD)* — cursor-reactive swarm (swarm/attract/orbit/repel + flutter
   noise), additive + bloom = glowing motes that flutter around the pointer like flies. The thing
   you called out in crazzy.
3. **`shaderOrb`** *(Liquid Glass)* — GLSL noise-displaced orb, fresnel rim, iridescent color mix;
   scroll drives energy; `burst` amplifies. Premium upgrade over `glassOrb`.
4. **`prismField`** *(Desktop/Glass)* — floating refractive shards that catch light; scroll spreads,
   `burst` scatters, `reconstruct` gathers.
5. **`voidRings`** *(Game/Cosmic)* — orbiting rings + lensed warp-grid core; scroll drives rotation +
   lens distortion.
6. **Parameterize `starfield` + `glassOrb`** — add `mode` reactivity (calm/tense/climax: warp,
   streak, speed) so existing packs gain scroll life too.

**Gate per scene:** screenshot at rest + mid-scroll + post-burst; you approve the look before next.

## 3. Phase 2 — Scroll choreography (own the timeline)

**Goal:** scroll *drives* the experience, per pack personality.

- `scroll.ts`: GSAP **ScrollTrigger** scrub + **pin** hero + **snap** between sections, mapped to
  `MOTION` personality (cinematic = long scrub/pin; snappy = staccato; floaty = drift). Drive scene
  `setMode`/`onSection`/`burst` from scroll position (e.g. cube explodes at the act break).
- **ScrollSmoother** done safely: fixed pack chrome (letterbox bars, menubar, dock, timeline)
  stays **outside** `#smooth-wrapper`; if any chrome breaks, fall back to ScrollTrigger native
  smoothing (no hard dependency — matches our GSAP policy).
- **Gate:** screen-recording/scroll-scan of Director's Cut showing cube deconstruct→explode→
  reconstruct synced to scroll.

## 4. Phase 3 — Micro-interactions (hand-feel)

- **ScrambleText** on the hero name (hover → ASCII/symbols → rebuild — your "RAMISWORLD" effect).
- Magnetic buttons, tilt-3d cards, parallax-depth layers, cursor variants
  (`square|circle|dot|ring|crosshair`), optional cursor trail / glitch.
- **Gate:** hover-state screenshots per pack.

## 5. Phase 4 — Content quality (beat crazzy where they're weak)

- Surface **email + location** (already in `ProfileData.identity`) in contact/hero.
- **Kill the language %** everywhere — languages = a clean list/chips/ascii, never a score.
- Richer **skills/abilities** rendering; tighten project blurbs/about copy from the facts layer.
- **Gate:** content sections screenshot-reviewed for spacing/typography (the audit's "no padding"
  complaint — verified visually, not assumed).

## 6. Phase 5 — Per-pack visual polish (the actual "crazzy level")

Perfect each of the 6 packs end-to-end via the screenshot loop: typography scale, spacing rhythm,
section compositions, color treatment, glass accuracy, focal-object placement. Order by impact:
**directorCut → terminalNexus → liquidGlass → gameHud → cosmicLab → desktopOS**.
**Gate:** side-by-side vs. the crazzy reference shots you provided; your sign-off per pack.

## 7. Phase 6 — Parameterization → "100s of unique sites" (beyond crazzy)

**Only now.** Add seeded params (`seed = hash(username+vibe)`) feeding scene params, color
treatments (solid/duotone/mesh/neon/holographic…), motion personalities, and per-section
composition modes — bounded by a **coherence matrix** (quality floor; e.g. `energyCube ⇒ cinematic/
energetic/snappy`). Same input → reproducible site; small input changes → perceptually distinct
worlds. Built on packs that already look great, so variety multiplies quality instead of diluting it.
**Gate:** generate 10 random vibes; all 10 land above the quality bar.

## 8. Phase 7 — Boot screens per pack

Pack-owned ~1.5s skippable loaders: clapperboard (director), BIOS POST (terminal), prism-calibrate
(glass), OS boot (desktop), press-start (game), cryo-wake (cosmic). **Gate:** first-frame screenshot.

## 9. Phase 8 — Go live + cost

Re-enable the live art-director, confirm output parses to a valid spec and stays **~2–3¢/gen**.
Then the product track (editing, auth, gallery, custom domain, **Railway** deploy).

---

## Sequencing & guardrails

- **Order:** Phase 0 → cube → rest of Phase 1 → 2 → 3 → 4, iterating per-pack; then 5, 6, 7, 8.
- **Every visual step ends in a screenshot you approve.** I will not author CSS/scenes blind.
- **No premature infra.** Generative space (Phase 6) comes after packs are great.
- **Keep what works.** Terminal pack is the reference for "good"; don't regress it.
- **Cost:** `MOCK_LLM=true` (=$0) through Phase 7; first spend is the Phase 8 live check.
- **Verify each phase** by running the app + screenshots — never by typecheck alone.

## First concrete step (on your go)

Phase 0 harness + extended `SceneHandle` + **`energyCube` on Director's Cut**, then I show you the
hero-at-rest / mid-scroll / post-explosion screenshots for approval.
