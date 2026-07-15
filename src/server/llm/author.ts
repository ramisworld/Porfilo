import "server-only";
import type { ProfileData } from "~/server/profile/model";
import { LIBRARY_PROMPT } from "~/engine/library";
import { anthropic, isMock, MODELS, textOf } from "./anthropic";
import { buildUsageRecord, logUsage, type UsageRecord } from "./cost";

/**
 * Layer 2 — Author. The art-director agent: given the person's real ProfileData
 * and a short design vibe (10–100 chars), it AUTHORS a complete, self-contained
 * HTML portfolio, composing from the component library. No templates; a fresh
 * page every time. Output is stored on Portfolio.code and served in the sandboxed
 * iframe. There is NO fallback — a broken page is a bug to fix, not to mask.
 */

const AUTHOR_SYSTEM = `You are the art director AND front-end engineer for Porfilo. You receive a developer's real GitHub data (DATA) and a short design vibe. You AUTHOR one complete, self-contained, single-page portfolio **website** that realizes the vibe and is tailored to this specific person.

## MANDATE
- Make it genuinely premium, distinctive, and memorable — a site someone would proudly pay for and share. Never generic "AI slop": no default Inter/Roboto/system-only type without intent, no purple-gradient-on-white cliché (unless the vibe explicitly asks). Take a real point of view.
- INTERPRET THE VIBE BOLDLY and commit to it fully — it defines the whole world (an OS desktop, a magazine, a terminal, an arcade, liquid glass, brutalist, whatever). Do not water it down.
- TAILOR TO THE PERSON: read their archetype from role/focus/languages (an ML researcher, a game dev, a designer, a systems engineer each deserve a different tone) and shape voice + emphasis accordingly.
- Interactive and animation-rich, but tasteful — land ONE signature moment rather than scattering effects. Everything must feel intentional.

## CONTENT (ground every word in DATA)
- Use DATA.identity (name, role, headline, location, links), DATA.languages (label + share%), DATA.projects (name, blurb, tech, stars, repoUrl, demoUrl), DATA.stats, DATA.focus, DATA.stack.
- Reuse the provided blurbs/headline; you may lightly adapt phrasing to the world's voice, but NEVER invent metrics, employers, dates, or facts. If data is thin, be concise — do not pad.
- Every project must link to its repoUrl (and demoUrl if present). Include real contact links from DATA.identity.links.
- Cover, at minimum, the person's identity, their work/projects, their languages/stack, and how to reach them — arranged in whatever structure the vibe implies.

${LIBRARY_PROMPT}

## OUTPUT
Return ONLY the raw HTML document — start with <!doctype html> and end with </html>. No markdown, no code fences, no commentary before or after.`;

/** A minimal but valid self-contained page for MOCK mode (dev, zero spend). */
function mockPage(data: ProfileData, vibe: string): string {
  const esc = (s: string) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const projects = data.projects
    .map(
      (p) =>
        `<li><a href="${esc(p.repoUrl)}" target="_blank" rel="noreferrer"><b>${esc(p.name)}</b></a> — ${esc(p.blurb)}</li>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(data.identity.name)}</title>
<style>:root{--bg:#0a0a0f;--fg:#e8e8ef;--muted:#8a8aa0;--accent:#6c7bff}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.6;padding:8vw}h1{font-size:clamp(2rem,6vw,3.5rem);margin:0}a{color:var(--accent)}ul{padding:0;list-style:none;display:grid;gap:12px;margin-top:24px}li{border:1px solid #23232f;border-radius:12px;padding:14px}</style></head>
<body><main><p style="color:var(--muted);text-transform:uppercase;letter-spacing:.2em;font-size:12px">MOCK · ${esc(vibe)}</p><h1>${esc(data.identity.name)}</h1><p style="color:var(--muted)">${esc(data.identity.role)} — ${esc(data.identity.headline)}</p><ul>${projects}</ul></main></body></html>`;
}

function extractHtml(raw: string): string | null {
  let s = raw.trim();
  // strip a leading/trailing markdown fence if the model added one
  s = s.replace(/^\s*```(?:html)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  // slice from the first document/root tag to be robust to any stray preamble
  const i = s.search(/<!doctype html|<html[\s>]/i);
  if (i > 0) s = s.slice(i);
  return s.length > 200 ? s : null;
}

export async function buildPortfolio(
  data: ProfileData,
  vibe: string,
): Promise<{ code: string | null; usage: UsageRecord | null }> {
  if (isMock) {
    return { code: mockPage(data, vibe), usage: null };
  }

  const brief = {
    identity: data.identity,
    languages: data.languages,
    focus: data.focus,
    stack: data.stack,
    stats: data.stats,
    projects: data.projects,
  };

  // Stream (a full page exceeds the safe non-streaming output size) and cache
  // the large static system+library prefix so repeat runs are cheap.
  const stream = anthropic().messages.stream({
    model: MODELS.design,
    max_tokens: 40000,
    // Adaptive thinking keeps the model's reasoning in thinking blocks (not the
    // visible HTML) and lifts design quality on Opus 4.8.
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: AUTHOR_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: `VIBE: ${vibe}\n\nDATA:\n${JSON.stringify(brief, null, 2)}\n\nAuthor the complete self-contained HTML portfolio now.`,
      },
    ],
  });
  const msg = await stream.finalMessage();

  // Record spend BEFORE parsing — we pay for the tokens regardless.
  const usage = buildUsageRecord("author (Opus)", MODELS.design, msg.usage);
  logUsage(usage);

  return { code: extractHtml(textOf(msg)), usage };
}
