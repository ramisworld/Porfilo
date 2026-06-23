# PortHub — Generative Engine (seeded, parameterized, tasteful-by-construction)

**Status:** PLAN — for review. No code until approved.
**Supersedes the "build more packs" direction.** The 3 current designs (`instrument`,
`brutalist`, `aurora`) become *regions* in a parameter space, not endpoints.

---

## 0. The one idea

Today: `pickExperience(vibe) → "aurora"` then swap the accent. Two users who type
"soft premium indigo" get the **identical** layout and the **identical** orb. That's
templates-with-paint.

Target: a **seeded generative recipe**. The same input is reproducible; every *distinct*
input rolls a genuinely different object, motion, and layout — but **every roll looks
designed**, never random soup.

```
seed = hash(username + "·" + vibe)        // stable per user+vibe
prng = mulberry32(seed)                    // deterministic pseudo-random stream
spec = artDirector(vibe)                   // LLM: palette + temperament + a few biases (tiny, ~2-3¢)
recipe = roll(prng, spec)                  // ENGINE (0 tokens): fills every knob within bounds
render(recipe)                             // contained object + composed page
```

The LLM stays tiny (it emits palette + a temperament + a few bias knobs). The **engine**
rolls the full recipe from the seed. Cost stays ~2–3¢; the generator is our code.

---

## 1. Why it stays tasteful (the crucial mechanism)

Rolling every knob *independently* would produce garbage 90% of the time. Two rules
prevent that:

### 1a. Roll a **temperament** first, then vary *around* it
A temperament is a coherence center — a personality that sets where each slider's range
*centers* before we add per-roll variation. Examples (these are centers, not fixed values):

| Temperament | radius | borders | spacing | type | motion | object bias | mode bias |
|---|---|---|---|---|---|---|---|
| **engineered** | soft | hairline | normal | grotesk/mono | measured | lattice/sphere | dark |
| **raw** | sharp | heavy | tight | condensed/serif | snappy | cube/shards | mono |
| **serene** | round | none | airy | rounded/serif | gentle | sphere/orbital | light |
| **cinematic** | soft | hairline | airy | serif | slow-drift | monolith/cluster | dark |
| **playful** | round | soft | normal | rounded/geometric | bouncy | cluster/prisms | light/color |

The art-director picks the temperament from the vibe. Then each knob rolls in a **narrow
band around that temperament's center** — so the result is *coherent* (everything matches)
but *unique* (no two rolls identical). `instrument`/`brutalist`/`aurora` are roughly the
"engineered/raw/serene" centers — they survive as anchors, but the generator can now land
anywhere in and between these regions.

### 1b. **Bounds + correlations + guarantees**
- **Bounds:** every numeric knob has a safe min/max (shard count 6–40, never 2, never 5000).
- **Correlations:** some knobs are linked, not free (heavy borders ⇒ sharp radius ⇒ snappy
  motion; light mode ⇒ softer object glow so it reads on a bright page).
- **Hard guarantees** checked after every roll: text/bg contrast ≥ WCAG AA; the contained
  object's stage backdrop always contrasts the object; spacing never collapses or blows out;
  one accent does the work (no 3-color clashes).

Variety **within** quality. That's the whole game.

---

## 2. The parameter space

Grouped by system. **Bold** = new work; the rest already exist as schema fields we'll start
*rolling* instead of hardcoding per-pack.

### 2a. Object — `morphObject` (the big new build)
One procedural builder replaces the fixed `energyCube.ts` / `energySphere.ts`. Knobs:

| Knob | Range / values | Notes |
|---|---|---|
| `form` | monolith · cluster · shards · lattice · orbital | top-level shape strategy |
| `primitive` | cube · prism · octa · icosa · sphere · tetra | "cubes of all sizes, even prisms" |
| `count` | 1–40 (bounded by form) | pieces |
| `sizeMix` | 0–1 | how varied piece sizes are |
| `asymmetry` | 0–1 | off-center / irregular arrangement |
| `explodeAmount` | 0–1 | how far it destructures on scroll |
| `explodeCurve` | ease presets | linear/expo/back/elastic |
| `shardSpin` | 0–1 | per-piece rotation while exploded |
| `reassemble` | bool | reverse-scroll rebuilds it |
| `morphMode` | none · breathe · melt · crystallize | surface life |
| `noiseAmp` / `noiseSpeed` | bounded | displacement amount/speed |
| `surface` | wire · solid · hybrid | + `fresnel`, `glow`, `colorTrough` 0–1 |
| `idleDrift` / `pointerResponse` / `scrollReactivity` | 0–1 | motion feel |

`energyCube` (explode) and `energySphere` (noise sphere) become **two presets** = specific
points in this space. Your "glowing destructured morphing cube" is one roll, not a template.

### 2b. Palette (mostly exists)
`mode` (light/dark, biased by temperament), `accent` (vibe or rolled), `accent2`
(analogous/complementary *rule*, not a lookup that can clash), surface/border tints. Contrast
guarantee enforced.

### 2c. Layout / chrome (exists as fields; start rolling)
| Knob | Values |
|---|---|
| `chrome` | floating-pill · side-rail · top-bar · letterbox · menubar |
| `heroComposition` | split-left · centered · stage-dominant · asymmetric |
| `container` | band · card · window · bento |
| `sectionOrder` | rolled within sensible constraints (hero first, contact last) |
| `gridDensity` | cards/row 2–4, gap tight/normal/airy |

### 2d. Type & spacing (exists)
`font` (display/body from FONTS), `scale` ratio, `case` (CAPS default for names), `radius`
(sharp/soft/round), `spacingRhythm` (tight/normal/airy) — all rolled around temperament.

### 2e. Page motion & background (exists)
`motion` style + intensity, reveal choreography, parallax; `background` mode + intensity —
rolled to **complement** the object (e.g. busy object ⇒ calm background).

---

## 3. How the 3 current designs map (proof it dissolves cleanly)

| Today's pack | Becomes region | temperament | object preset | chrome | mode |
|---|---|---|---|---|---|
| `instrument` | engineered | engineered | sphere/lattice | side/top-bar | dark |
| `brutalist` | raw | raw | cube/shards | top-bar | mono |
| `aurora` | serene | serene | sphere/orbital | floating-pill | light |

They keep working as anchors during the migration; we don't delete them until the generator
covers their range.

---

## 4. The art-director's new output

Instead of `experience: "aurora"`, the LLM emits a **compact** spec:

```jsonc
{
  "seed": "ramisworld·soft premium indigo",   // engine hashes this
  "temperament": "serene",                      // 1 of ~6
  "palette": { "accent": "#6366f1", "mode": "light" },
  "bias": {                                     // optional nudges, all 0–1, all skippable
    "objectComplexity": 0.3,
    "motionEnergy": 0.2,
    "density": 0.4
  }
}
```

Everything else (the full object recipe, layout, type, spacing, background) is **rolled by
the engine from the seed**, centered on the temperament, nudged by `bias`. Same tiny token
cost. The vibe → temperament + bias mapping lives in the mock now (`MOCK_LLM=true`, $0) and
swaps to the live model later unchanged.

---

## 5. Build sequence

1. **Seed + PRNG plumbing** — `seed` field on the spec; `mulberry32` in the engine; a single
   `roll()` entry that produces a full recipe deterministically.
2. **`morphObject` system** — the procedural builder (§2a). Verify the two current presets
   reproduce, then open the knobs. *This is the heart of the work.*
3. **Temperament + bounded rolling layer** — §1a/§1b: temperament table, per-knob bands,
   correlations, the post-roll guarantee checks.
4. **Roll layout/chrome/type/spacing/background** — turn the existing hardcoded per-pack
   values into rolled-within-range; retire the 3 packs into regions.
5. **Art-director emits temperament + bias + seed** (mock, $0) — vibe → distributions.
6. **Polish** — boot screens per temperament, content/copy cleanup (README markdown still
   leaks into blurbs — fix here, affects every render).
7. **Go-live** (your part).

## 6. Verification
Every step: generate **8–12 different username+vibe inputs**, full-page screenshot each
(`scripts/shoot.mjs`), and confirm — (a) they look *meaningfully different* from each other,
(b) the *same* input reproduces identically, (c) *every* one passes the taste guarantees.
A "variety contact sheet" of thumbnails is the real pass/fail.

## 7. Open questions for you
- **How many temperaments?** ~6 (above) feels right — enough range, few enough to tune each
  to excellence. More = more variety but more surface to keep tasteful.
- **How wild should rolls be?** Conservative bands (safe, slightly samey) vs wide bands (more
  unique, more tuning to keep tasteful). I'd start conservative and widen once the guarantees
  hold.
- **Keep the 3 packs as named presets** a user could request by name, or fully dissolve them?
