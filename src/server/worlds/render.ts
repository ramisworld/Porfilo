import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderPortfolioPage } from "~/engine/render";
import { TERMINAL_NEXUS_SPEC } from "~/engine/presets/terminal-nexus";
import { ENGINE_VERSION } from "~/engine/version";
import { profileDataSchema, type ProfileData } from "~/server/profile/model";
import { getWorld, normalizeWorldId, type WorldId } from "./catalog";
import { toWorldData, type WorldData } from "./data";

const templateCache = new Map<WorldId, string>();

const VARIABLE_COLLECTION = new Set<WorldId>([
  "variable-type-foundry",
  "isometric-microcity",
  "modular-synthesizer",
  "electromechanical-pinball",
  "digital-loom",
  "climate-engine",
  "zen-systems-garden",
  "darkroom",
  "kinetic-sculpture-garden",
  "seismic-archive",
]);

const VARIABLE_POSITIONS =
  "const pos=[[8,60],[35,18],[68,16],[72,58],[41,70],[11,25],[54,42],[24,44],[78,38]]";

/**
 * Collection templates used to infer their active variant from the standalone
 * preview filename. Public portfolios run in `iframe[srcdoc]`, so there is no
 * filename and every collection silently selected its first variant. Bind the
 * validated world id into that lookup while preserving standalone previews.
 */
function bindWorldIdentity(source: string, worldId: WorldId): string {
  const pathname = JSON.stringify(`/world-prompts/${worldId}.html`);
  let code = source.replaceAll("location.pathname", pathname);

  // Four spatial worlds address this shared array directly. Their original
  // six coordinates violated the product's nine-project contract.
  if (VARIABLE_COLLECTION.has(worldId)) {
    code = code.replace(
      /const pos=\[\[10,61\],\[38,20\],\[69,18\],\[73,61\],\[43,70\],\[13,26\]\]/,
      VARIABLE_POSITIONS,
    );
  }
  return code;
}

function worldSafetyCss(worldId: WorldId): string {
  if (worldId !== "variable-type-foundry") return "";
  return `
/* PORFILO TYPE FOUNDRY SAFETY — contain long, unbroken GitHub identities. */
.ty{grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);padding-bottom:92px}
.ty-main,.ty-side,.ty-projects,.ty-card{min-width:0}
.ty-main{container-type:inline-size}
.ty-name{max-width:100%;font-size:clamp(16px,calc(135cqi / var(--porfilo-name-length,8)),220px);line-height:.72;white-space:nowrap}
.ty-head{max-width:min(22ch,100%);font-size:clamp(28px,3vw,50px);line-height:.94;text-wrap:balance}
.ty-tag{max-width:58ch}
@media(max-width:820px){.ty{padding-bottom:0}.ty-name{font-size:clamp(16px,calc(135cqi / var(--porfilo-name-length,8)),105px);white-space:normal;overflow-wrap:anywhere}.ty-head{max-width:18ch}}
`;
}

export function readWorldTemplate(worldId: WorldId): string {
  const cached = templateCache.get(worldId);
  if (cached) return cached;
  const source = readFileSync(
    join(process.cwd(), "world-prompts", `${worldId}.html`),
    "utf8",
  );
  if (
    !source.includes("const DATA =") ||
    !source.includes("/* ===== END DATA")
  ) {
    throw new Error(`World ${worldId} is missing its DATA fill boundary.`);
  }
  templateCache.set(worldId, source);
  return source;
}

function serializeForInlineScript(data: WorldData): string {
  return JSON.stringify(data, null, 2)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function injectData(source: string, data: WorldData): string {
  const start = source.indexOf("const DATA =");
  const end = source.indexOf("/* ===== END DATA", start);
  if (start < 0 || end < 0) throw new Error("Invalid world fill boundary.");
  return `${source.slice(0, start)}const DATA = ${serializeForInlineScript(data)};\n${source.slice(end)}`;
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char,
  );
}

function experienceExtension(
  worldId: WorldId,
  data: WorldData,
): { css: string; markup: string } | null {
  if (data.experience.length === 0) return null;
  const world = getWorld(worldId);
  const items = data.experience
    .map((item, index) => {
      const company = item.url
        ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.company)} ↗</a>`
        : `<span>${escapeHtml(item.company)}</span>`;
      const highlights = item.highlights?.length
        ? `<ul>${item.highlights.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>`
        : "";
      return `<article class="phx-exp-item"><div class="phx-exp-index">${String(index + 1).padStart(2, "0")}</div><div class="phx-exp-main"><div class="phx-exp-meta"><span>${escapeHtml(item.startDate)} — ${escapeHtml(item.endDate ?? "Present")}</span>${item.location ? `<span>${escapeHtml(item.location)}</span>` : ""}</div><h3>${escapeHtml(item.role)}</h3><div class="phx-exp-company">${company}</div>${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ""}${highlights}</div></article>`;
    })
    .join("");

  return {
    css: `
/* PORFILO EXPERIENCE EXTENSION — shared, optional, data-driven */
#porfilo-experience{--phx-bg:${world.theme.background};--phx-fg:${world.theme.foreground};--phx-accent:${world.theme.accent};--phx-muted:${world.theme.muted};position:relative;z-index:60;isolation:isolate;background:var(--phx-bg);color:var(--phx-fg);border-top:1px solid color-mix(in srgb,var(--phx-fg) 22%,transparent);padding:clamp(68px,9vw,132px) clamp(20px,5vw,76px) max(96px,10vh);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-shadow:none}
#porfilo-experience *{box-sizing:border-box}#porfilo-experience a{color:inherit}.phx-exp-wrap{width:min(1180px,100%);margin:0 auto}.phx-exp-kicker{display:flex;align-items:center;gap:14px;margin-bottom:18px;color:var(--phx-accent);font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase}.phx-exp-kicker::after{content:"";height:1px;flex:1;background:color-mix(in srgb,var(--phx-fg) 18%,transparent)}#porfilo-experience h2{margin:0 0 clamp(36px,5vw,68px);font-size:clamp(42px,8vw,112px);line-height:.86;letter-spacing:-.065em;text-transform:uppercase}.phx-exp-list{border-top:1px solid color-mix(in srgb,var(--phx-fg) 26%,transparent)}.phx-exp-item{display:grid;grid-template-columns:58px minmax(0,1fr);gap:18px;padding:clamp(24px,4vw,48px) 0;border-bottom:1px solid color-mix(in srgb,var(--phx-fg) 22%,transparent)}.phx-exp-index{color:var(--phx-accent);font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.phx-exp-meta{display:flex;justify-content:space-between;gap:18px;color:var(--phx-muted);font:600 10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}.phx-exp-main h3{margin:12px 0 4px;font-size:clamp(25px,4vw,52px);line-height:.95;letter-spacing:-.04em}.phx-exp-company{color:var(--phx-accent);font-size:14px;font-weight:700}.phx-exp-company a{text-decoration:none}.phx-exp-main p{max-width:66ch;margin:18px 0 0;color:color-mix(in srgb,var(--phx-fg) 76%,var(--phx-muted));font-size:14px;line-height:1.65}.phx-exp-main ul{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0;padding:0;list-style:none}.phx-exp-main li{border:1px solid color-mix(in srgb,var(--phx-fg) 22%,transparent);padding:7px 10px;font:600 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase}@media(max-width:640px){.phx-exp-item{grid-template-columns:34px 1fr}.phx-exp-meta{flex-direction:column;gap:4px}#porfilo-experience h2{font-size:clamp(38px,16vw,72px)}}
`,
    markup: `<section id="porfilo-experience" aria-labelledby="porfilo-experience-title"><div class="phx-exp-wrap"><div class="phx-exp-kicker">Career timeline</div><h2 id="porfilo-experience-title">Experience</h2><div class="phx-exp-list">${items}</div></div></section>\n`,
  };
}

/**
 * Older approved templates represented an unlinked credential as href="#".
 * Replace those inert anchors after each world's synchronous render while
 * preserving its classes and content. This keeps optional URLs truly optional
 * without maintaining 33 copies of the same defensive branch.
 */
function injectRuntimeHygiene(code: string): string {
  const guard = `
// PORFILO RUNTIME HYGIENE — optional credentials never become dead links.
document.querySelectorAll('a[href="#"]').forEach((link) => {
  const replacement = document.createElement('span');
  for (const attribute of link.attributes) {
    if (!['href','target','rel'].includes(attribute.name)) replacement.setAttribute(attribute.name, attribute.value);
  }
  replacement.innerHTML = link.innerHTML;
  link.replaceWith(replacement);
});
const porfiloTypeName = document.querySelector('.ty-name');
if (porfiloTypeName) {
  porfiloTypeName.style.setProperty(
    '--porfilo-name-length',
    String(Math.max(1, porfiloTypeName.textContent.trim().length)),
  );
}
`;
  const end = code.lastIndexOf("</script>");
  if (end < 0) throw new Error("World has no closing script tag.");
  return `${code.slice(0, end)}${guard}${code.slice(end)}`;
}

export function renderWorld(
  worldId: WorldId,
  profileInput: ProfileData,
  githubUsername: string,
  assetOrigin?: string,
): string {
  const profile = profileDataSchema.parse(profileInput);
  if (worldId === "terminal-nexus") {
    return renderPortfolioPage(
      TERMINAL_NEXUS_SPEC,
      profile,
      ENGINE_VERSION,
      assetOrigin,
    );
  }
  const data = toWorldData(profile, githubUsername);
  let code = injectData(
    bindWorldIdentity(readWorldTemplate(worldId), worldId),
    data,
  );
  const safetyCss = worldSafetyCss(worldId);
  if (safetyCss) code = code.replace("</style>", `${safetyCss}</style>`);
  const extension = experienceExtension(worldId, data);
  if (extension) {
    code = code.replace("</style>", `${extension.css}</style>`);
    const scriptIndex = code.indexOf("<script>");
    if (scriptIndex < 0) throw new Error(`World ${worldId} has no script tag.`);
    code = `${code.slice(0, scriptIndex)}${extension.markup}${code.slice(scriptIndex)}`;
  }
  return injectRuntimeHygiene(code);
}

export function renderStoredWorld(
  input: {
    template: string;
    profileData: unknown;
    githubUsername: string;
  },
  assetOrigin?: string,
): string | null {
  const worldId = normalizeWorldId(input.template);
  if (!worldId) return null;
  const profile = profileDataSchema.safeParse(input.profileData);
  if (!profile.success) return null;
  return renderWorld(worldId, profile.data, input.githubUsername, assetOrigin);
}
