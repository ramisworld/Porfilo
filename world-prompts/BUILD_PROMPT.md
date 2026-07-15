# Porfilo — World Build Prompt

You are building **three new portfolio "worlds"** for Porfilo, each a **self-contained, data-driven HTML template**. Two finished worlds — **`world-prompts/brutalist.html`** and **`world-prompts/terminal-nexus.html`** — define the quality bar and the technical contract. **Open and study both before writing anything.** Match their level of craft, density, real interactivity, and their fill-contract structure — but **not** their style: each new world is its own creative world.

Build **one world at a time**: build → screenshot (desktop + mobile) → serve a local link → self-critique against the bar → **stop for approval** → next. Never batch.

---

## 0. The three worlds to create

| id | Vibe | One-line concept |
|---|---|---|
| `magazine` | editorial print magazine | A designed journal/magazine issue — masthead, feature spread, pull-quotes, contents index, bylines. |
| `os` | desktop operating system | A developer's desktop OS — menu bar, dock, draggable windows, a Finder of projects. |
| `terminal` | cyber bash/hacker terminal | A real operable terminal — boot sequence, CRT, matrix rain, typed commands. |

Per-world specs are in §7. **Start with `magazine`** unless told otherwise.

> These are new interpretations — do **not** look for or copy any earlier versions. Build each fresh, from the concept, to the bar set by the two reference worlds.

---

## 1. Golden rules (non-negotiable, every world)

1. **Self-contained.** One `.html` file. **No external requests** — served in a sandboxed iframe with a strict CSP that blocks all network (CDNs, webfonts by URL, remote images, fetch/XHR). Inline all CSS/JS; embed assets as `data:` URIs; use system font stacks (or an inlined `@font-face` data URI). Start the file with `<title>…</title>`, then one `<style>`, then markup, then one `<script>` — **no `<html>`/`<head>`/`<body>` wrappers.**
2. **Sandbox-safe.** Runs under `sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"` — no same-origin, no network, no reliable `localStorage`. Links: `target="_blank" rel="noreferrer"`.
3. **Zero console errors.** Verify headless. Errors = not done.
4. **Responsive** at desktop **1440** and mobile **390**. No horizontal body scroll.
5. **`prefers-reduced-motion`:** kill motion but keep the page fully populated and legible.
6. **Performance:** cap canvas/WebGL DPR at **1.5**; pause every `requestAnimationFrame` when `document.hidden`; idle heavy visuals when scrolled out of view.
7. **Data-driven (see §3).** Every piece of content comes from the shared `DATA` object — nothing about the person is hardcoded in markup.
8. **Honest-data rules:** never render a language percentage; show a repo's `stars` only when `>= 50`; omit any metric that undersells the person.
9. **Never empty or minimal.** A full portfolio, not a hero + a list. If a section looks sparse, it isn't finished.

---

## 2. The quality bar + creative mandate

A world passes only if **all** are true (both references clear this):

- **One bold concept, committed to fully** — its own materials, vocabulary, chrome.
- **≥1 signature interaction the visitor _operates_** (types, drags, opens, orbits) — not just watches. An ambient background + static content is an **automatic fail**.
- **Scroll (or, for single-screen worlds, direct operation) is a real dimension** — the page evolves / responds.
- **A full content spine** (§4).
- **Real hover/focus states** with depth.
- **One disciplined accent; a chosen, non-default palette.**
- **Human test:** a real software engineer would proudly ship it; a first-time visitor says "wow."

**Creative mandate.** The two references define the *bar and the range of what's possible* — they are **not** templates to restyle. Each world must be its **own** creative interpretation: its own layout system, motion language, palette, and signature interaction. Diverge boldly; never produce a recolored Brutalist or Terminal Nexus. If you'd rate it below a genuine 9/10, keep iterating.

---

## 3. The fill contract (this is what makes a world "a template")

Read **`world-prompts/FILL_CONTRACT.md`** in full. In short: every world reads **100% of its content from one `DATA` object** at the top of its `<script>`, inside the fill boundary:

```js
/* ===== FILL CONTRACT — the director replaces ONLY the DATA object below ===== */
const DATA = { … };
/* ===== END DATA — template logic below (not per-user) ===== */
```

- **Copy the `DATA` block verbatim from `brutalist.html`** (identical shape in `terminal-nexus.html`) — same fields, same demo values (the developer "Rami"). Do not change the shape.
- Build every node in JS by mapping over `DATA`. **Escape** all injected strings via an `esc()` helper (copy it from a reference) — `DATA` holds user-derived content.
- Enforce the honest-data rules in the render logic (`const STAR_MIN = 50`; no percentages).
- Optional fields degrade gracefully (empty `credentials` → no credentials section; missing `links.x`/`demoUrl` → skip).

This is why the Haiku chooser and deterministic renderer can select and fill any world from a user's vibe by swapping only the `DATA` object.

---

## 4. Content spine (adapt to each world's metaphor)

Re-express, don't copy literally:

1. **Chrome** — wordmark + nav + a **live status signal** themed to the world (menu-bar clock, telemetry, "available for work"…).
2. **Hero / identity** — name, role, headline, location + the world's signature interactive moment.
3. **Stats** — contributions/yr, repos, featured count, "since {year}" (count-up). No stars unless big; no %.
4. **Work** — the projects, richly (name, blurb, tech, year, link, real hover). The heart of the page.
5. **[Optional] Credentials** — only if `DATA.credentials` is non-empty; each world defines its own slot (§7).
6. **Contact / close** — copyable email + links; a strong final moment.

**Exception:** a world that is inherently one surface (the **bash terminal**, the **OS desktop**) may stay single-screen instead of a long scroll — **but then it must be deeply interactive** (a terminal you type into; windows you open/drag) to carry the same depth. Concept dictates structure.

---

## 5. ReactBits protocol — study, don't ship

Vendored at **`vendor/react-bits/src/ts-tailwind/`** (`Backgrounds/`, `TextAnimations/`, `Animations/`, `Components/`). License is **MIT + Commons Clause**: you may **not** *"sell, sublicense, or redistribute the components themselves — whether alone, in a bundle, or as a ported version."*

- ✅ **Open** a component to understand the effect/technique (shader idea, interaction, math).
- ✅ **Then write genuinely original** vanilla, self-contained code (raw WebGL/GLSL, Canvas2D, CSS) — most ReactBits standouts are React + three.js/ogl and can't be used as-is here.
- ❌ Do **not** transliterate their source (a "ported version"), and never include a ReactBits file in the output.

**The idea is free; the code is not.** §7 names components worth studying per world.

---

## 6. Build & verify loop (per world — do not skip)

1. **Choose** the next world (§7). Commit to its one bold concept + one signature interaction first.
2. **Build** `world-prompts/<id>.html` — full spine (§4), data-driven (§3), effects reimplemented (§5).
3. **Screenshot:** `node scratch-shot.mjs world-prompts/<id>` → writes `<id>.png` (1440) + `<id>.m.png` (390) beside the file and prints console errors; `FULL=1` for a full-page capture. It uses Chromium `--use-gl=swiftshader` so WebGL renders headless.
4. **Serve a link:** start a static server (e.g. `python3 -m http.server 8080`) and give the reviewer **`http://localhost:8080/world-prompts/<id>.html`**.
5. **Verify:** 0 console errors; nothing clipped; mobile works; reduced-motion still fully populated; all content came from `DATA`.
6. **Self-critique** against §2/§3/§4 honestly: dense (never empty)? a real interaction the visitor *operates*? does it evolve? unmistakably its own world (not a restyled reference)? honest-data obeyed? would an engineer ship it? "wow"?
7. **Iterate** to a genuine 9–10/10, then **STOP and wait for approval** before the next world.

---

## 7. Per-world specs

**FULL** = full multi-section scroll. **SINGLE** = one operable surface (must be deeply interactive).

### `magazine` — editorial print magazine · FULL
- **Concept:** a designed magazine/journal issue about the developer — masthead + issue no. + date, a feature spread with a strong headline and standfirst, pull-quotes, a multi-column contents/index of work, bylines, an editor's note.
- **Signature interaction:** editorial-appropriate and restrained — e.g. a kinetic masthead / variable headline, pull-quotes and figures that reveal and drift on scroll, a live "contents" index that tracks the reader. No gimmicks that would cheapen print.
- **Study (reimplement):** `TextAnimations/SplitText`, `ScrollReveal`, `ScrollFloat`, `CurvedLoop`; `Animations/GradualBlur`; `Components/Masonry`, `Carousel`.
- **Credentials slot:** a boxed "Contributor / credentials" sidebar in the masthead area or an editor's-note column.

### `os` — desktop operating system · SINGLE (deeply interactive)
- **Concept:** a developer's desktop OS — top menu bar (with live clock + status), a dock, **draggable/focusable windows**, a "Finder" window listing projects, an "About This Developer" window, a wallpaper.
- **Signature interaction:** real windowing — the dock launches windows; windows drag, focus, and close; opening a project window reveals its detail. It should feel like an OS you operate.
- **Study (reimplement):** `Components/Dock`, `GlassIcons`, `Folder`, `MagicBento`, `Stack`, `CardNav`, `Windows-like chrome`; `Animations/ClickSpark`.
- **Credentials slot:** a "Certificates" folder/window on the desktop (present only if `DATA.credentials` is non-empty).

### `terminal` — cyber bash / hacker terminal · SINGLE (deeply interactive)
- **Concept:** a genuine operable terminal — a boot sequence, CRT scanlines/curvature, subtle matrix rain, a typed autoplay intro, then a **live command line**. **This is NOT Terminal Nexus** (which is a scrolling site with a terminal *card*); this world is a single pure terminal you drive.
- **Signature interaction:** a real command line — `help`, `whoami`, `projects`, `open <n>`, `stack`, `contact`, `clear`, plus an easter egg; commands print from `DATA`.
- **Study (reimplement):** `Backgrounds/FaultyTerminal`, `LetterGlitch`, `Dither`; `TextAnimations/DecryptedText`, `TextType`, `ScrambledText`.
- **Credentials slot:** a `certs` (or `cat credentials.txt`) command that lists them (only if present).

---

## 8. Why Terminal Nexus is good (the interactivity lesson)

Study `terminal-nexus.html`, but the lessons to carry into every world:
- **A system the visitor operates**, not decoration — an interactive `whoami.sh` terminal in the hero; magnetic buttons; a copyable handshake.
- **Scroll is a dimension** — headings **decrypt out of glyph-noise** on entry; the floating **ghost object** intensifies/fades with scroll; a progress bar + section rail track position.
- **A signature hero object** — the canvas ghost cloud that reacts to scroll and cursor.
- **A living wordmark** — the name **glitches** on load, hover, and idle.
- **A complete spine** — telemetry strip → hero → status → systems → (credentials) → signal/contact, with the section rail renumbering when credentials appear.

Do **not** reuse these exact effects — learn the *principle* (operate, evolve, signature moment, never empty) and express it in each world's own language. (A bash terminal should behave like a terminal; a magazine shouldn't be animative like Terminal Nexus.)

---

## 9. Output

- One file per world: `world-prompts/<id>.html`, structured like the references (`<title>` → `<style>` → markup → `<script>`; no `<html>/<head>/<body>`).
- After each: report the file, confirm **0 console errors**, give the **localhost link** + desktop/mobile screenshots and how it clears §2 — then **stop for approval** before the next.
