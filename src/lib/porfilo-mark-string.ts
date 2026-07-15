/** Fixed id prefix for favicon / apple-touch (single instance on page). */
export const PORFILO_FAVICON_ID = "porfilo-favicon";

/**
 * Raw SVG markup — single source for nav mark + static favicon files.
 * The block-built P stays legible at favicon size without relying on fonts.
 */
export function porfiloMarkSvgString(
  _idPrefix = "porfilo-mark",
  size = 32,
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" shape-rendering="crispEdges" aria-hidden="true"><rect width="32" height="32" fill="#F4F3EE"/><rect x="1" y="1" width="30" height="30" stroke="#0D0D0C" stroke-width="2"/><path fill-rule="evenodd" clip-rule="evenodd" d="M7 6H21V9H25V17H21V20H13V27H7V6ZM13 11V15H19V11H13Z" fill="#0D0D0C"/><rect x="23" y="5" width="5" height="5" fill="#E8380D"/></svg>`;
}
