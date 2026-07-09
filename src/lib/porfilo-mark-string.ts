/** Fixed id prefix for favicon / apple-touch (single instance on page). */
export const PORFILO_FAVICON_ID = "porfilo-favicon";

/**
 * Raw SVG markup — single source for nav mark + static favicon files.
 * Keep filters/gradients here; do not route favicons through ImageResponse/Satori.
 *
 * The Porfilo mark: a freestanding "aperture P" — a bold gradient monogram whose
 * bowl reads as a lens/portal onto your work. No app-icon container; sits on any
 * surface and stays legible down to a 16px browser tab.
 */
export function porfiloMarkSvgString(
  idPrefix = "porfilo-mark",
  size = 32,
): string {
  const uid = idPrefix;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" shape-rendering="geometricPrecision" aria-hidden="true"><defs><linearGradient id="${uid}-stroke" x1="7" y1="4" x2="25" y2="28" gradientUnits="userSpaceOnUse"><stop stop-color="#9FB0FF"/><stop offset="0.5" stop-color="#6C7BFF"/><stop offset="1" stop-color="#A472FF"/></linearGradient><radialGradient id="${uid}-eye" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(17.9 11.9) scale(3.2)"><stop stop-color="#EAEDFF"/><stop offset="1" stop-color="#9A6CFF"/></radialGradient><filter id="${uid}-glow" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1.05" result="b"/><feColorMatrix in="b" type="matrix" values="0 0 0 0 0.475  0 0 0 0 0.545  0 0 0 0 1  0 0 0 0.6 0"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#${uid}-glow)"><path d="M11 27.4 V5.4 H17.9 A6.8 6.8 0 0 1 17.9 19 H11" fill="none" stroke="url(#${uid}-stroke)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17.9" cy="11.9" r="1.7" fill="url(#${uid}-eye)"/></g></svg>`;
}
