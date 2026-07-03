import "server-only";

/**
 * Cheap sanity check on generated HTML. Replaces the old "quality gate" for the
 * generative approach: if the model returns broken/empty output, the orchestrator
 * regenerates once.
 */
export function isRenderable(html: string): boolean {
  if (!html || html.trim().length < 200) return false;
  const lower = html.toLowerCase();
  const hasDoctypeOrHtml =
    lower.includes("<!doctype html") ||
    (lower.includes("<html") && lower.includes("</html>"));
  const hasBody = lower.includes("<body") || lower.includes("<main");
  return hasDoctypeOrHtml && hasBody;
}
