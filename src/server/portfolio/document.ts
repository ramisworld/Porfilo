import "server-only";
import { appOrigin } from "~/lib/root-domain";
import { profileDataSchema } from "~/server/profile/model";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function portfolioDocument({
  portfolioHtml,
  profileData,
  githubUsername,
  canonicalUrl,
  imageUrl,
  isPublic,
}: {
  portfolioHtml: string;
  profileData: unknown;
  githubUsername: string;
  canonicalUrl: string;
  imageUrl: string;
  isPublic: boolean;
}): string {
  const parsed = profileDataSchema.safeParse(profileData);
  const data = parsed.success ? parsed.data : null;
  const name = data?.identity.name ?? githubUsername;
  const role = data?.identity.role ?? "Developer";
  const headline = data?.identity.headline ?? role;
  const title = `${name} — ${role}`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(headline)}"><meta property="og:type" content="profile"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(headline)}"><meta property="og:url" content="${escapeHtml(canonicalUrl)}"><meta property="og:image" content="${escapeHtml(imageUrl)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(headline)}"><meta name="twitter:image" content="${escapeHtml(imageUrl)}">${isPublic ? "" : '<meta name="robots" content="noindex,nofollow">'}<link rel="icon" href="/icon"><link rel="apple-touch-icon" href="/apple-icon"><style>html,body,iframe{width:100%;height:100%;margin:0;border:0;overflow:hidden}iframe{position:fixed;inset:0}</style></head><body><iframe title="portfolio" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcdoc="${escapeHtml(portfolioHtml)}"></iframe></body></html>`;
}

export function portfolioNotFoundDocument(host: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Portfolio not found — Porfilo</title><style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#f4f3ee;color:#0d0d0c;font-family:system-ui,sans-serif}.card{width:min(680px,calc(100% - 96px));border:3px solid;padding:36px;box-shadow:10px 10px 0 #e8380d}.k{font:700 12px ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase}h1{font-size:clamp(42px,8vw,88px);line-height:.9;letter-spacing:-.06em;margin:28px 0 20px}p{font-size:18px;line-height:1.5}a{display:inline-block;margin-top:18px;background:#0d0d0c;color:#f4f3ee;padding:14px 18px;text-decoration:none;font-weight:700}</style></head><body><main class="card"><div class="k">404 / ${escapeHtml(host)}</div><h1>Portfolio not found.</h1><p>This address is not connected to a public Porfilo portfolio.</p><a href="${escapeHtml(appOrigin())}">Return to Porfilo →</a></main></body></html>`;
}

export function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
