export function webglSupported(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl2") ?? c.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function isTouch(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer:coarse)").matches
  );
}

/**
 * Heuristic for devices that shouldn't run the heavy WebGL scene (thermals +
 * compatibility): phones/tablets (coarse pointer), few CPU cores, low memory,
 * or no WebGL2 (older GPUs). These fall back to a static CSS starfield void.
 */
export function lowPowerDevice(): boolean {
  try {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      hardwareConcurrency?: number;
    };
    const cores = nav.hardwareConcurrency ?? 8;
    const mem = nav.deviceMemory ?? 8;
    const c = document.createElement("canvas");
    const noWebGL2 = !c.getContext("webgl2");
    return isTouch() || cores <= 4 || mem <= 4 || noWebGL2;
  } catch {
    return true;
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
