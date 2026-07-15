# Agent instructions — Porfilo portfolio "worlds"

These apply when building or editing any portfolio **world** in this folder.

1. **Read `world-prompts/BUILD_PROMPT.md` in full before writing any code.** It is the authoritative spec: the three worlds to build (`magazine`, `os`, `terminal`), the quality bar, the golden rules, the honest-data rules, and the ReactBits protocol.
2. **Study the two finished reference worlds first:** `world-prompts/brutalist.html` and `world-prompts/terminal-nexus.html`. They set the quality bar and the technical contract — match their craft and structure, **not** their style. Each new world is its own creative interpretation, never a restyle.
3. **Honor the fill contract** (`world-prompts/FILL_CONTRACT.md`): every world reads 100% of its content from one `DATA` object (copy the block verbatim from `brutalist.html`), escapes injected strings via `esc()`, and enforces the honest-data rules (no language %, stars only if `>= 50`).
4. **Build ONE world at a time** → `world-prompts/<id>.html` (self-contained; `<title>` → `<style>` → markup → `<script>`; no `<html>/<head>/<body>`).
5. **Verify + preview before showing:**
   - `node scratch-shot.mjs world-prompts/<id>` → `<id>.png` (desktop) + `<id>.m.png` (mobile) beside the file, and prints console errors (`FULL=1` for full-page). Iterate until **0 console errors** and it clears the bar.
   - Start a static server (`python3 -m http.server 8080`) and give me the link **`http://localhost:8080/world-prompts/<id>.html`**.
6. **STOP after each world.** Show the file, the localhost link, and the screenshots, then **wait for my explicit approval** before starting the next world. Never batch.

**Recommended session settings**
- `/model` → `gpt-5.6-sol` at **high** reasoning effort (these are design-heavy).
- `/permissions` → allow file writes + command execution in the workspace, so builds, screenshots, and the local server run without a prompt on every command. The per-world **STOP** in rule 6 is the review gate.
