/** Fixed id prefix for favicon / apple-touch (single instance on page). */
export const PORFILO_FAVICON_ID = "porfilo-favicon";

/**
 * Raw SVG markup — single source for nav mark + static favicon files.
 * Keep filters/gradients here; do not route favicons through ImageResponse/Satori.
 */
export function porfiloMarkSvgString(
  idPrefix = "porfilo-mark",
  size = 32,
): string {
  const uid = idPrefix;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" shape-rendering="geometricPrecision" aria-hidden="true"><defs><radialGradient id="${uid}-aurora-a" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(9.6 6.4) rotate(0) scale(18)"><stop stop-color="#6C7BFF" stop-opacity="0.62"/><stop offset="0.55" stop-color="#6C7BFF" stop-opacity="0"/></radialGradient><radialGradient id="${uid}-aurora-b" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(25.6 27.2) rotate(0) scale(16)"><stop stop-color="#9A6CFF" stop-opacity="0.5"/><stop offset="0.5" stop-color="#9A6CFF" stop-opacity="0"/></radialGradient><linearGradient id="${uid}-sheen" x1="16" y1="0" x2="16" y2="14"><stop stop-color="white" stop-opacity="0.14"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><filter id="${uid}-portal-glow" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1.15" result="blur"/><feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.424  0 0 0 0 0.482  0 0 0 0 1  0 0 0 0.55 0"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="32" height="32" rx="9" fill="#08080C"/><rect width="32" height="32" rx="9" fill="url(#${uid}-aurora-a)"/><rect width="32" height="32" rx="9" fill="url(#${uid}-aurora-b)"/><rect width="32" height="32" rx="9" fill="url(#${uid}-sheen)"/><rect width="31" height="31" x="0.5" y="0.5" rx="8.5" stroke="white" stroke-opacity="0.06"/><rect x="6.08" y="6.08" width="19.84" height="19.84" rx="7.04" stroke="white" stroke-opacity="0.88" stroke-width="1.75" filter="url(#${uid}-portal-glow)"/><text x="16" y="16.35" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="12.2" font-weight="700" font-family="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif" letter-spacing="-0.6">P</text></svg>`;
}
