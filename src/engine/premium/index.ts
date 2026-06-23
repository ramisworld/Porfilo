import { mountBoot } from "./boot";
import { initCursor } from "./cursor";
import { initWebGL, type WebGLHandle } from "./webgl";
import { initReveals } from "./scroll";
import { lowPowerDevice, prefersReducedMotion, webglSupported } from "./support";

/**
 * Cheap, static fallback background for low-power devices / no-WebGL / reduced
 * motion: a black void with a sparse green starfield painted once into a canvas
 * (no per-frame work). Keeps the "deep space terminal" vibe without the GPU cost.
 */
function mountStaticVoid(animate: boolean): void {
  const wrap = document.createElement("div");
  wrap.id = "ph-void";
  wrap.style.cssText =
    "position:fixed;inset:0;z-index:0;pointer-events:none;background:#03060a;";
  const cvs = document.createElement("canvas");
  cvs.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
  wrap.appendChild(cvs);
  document.body.appendChild(wrap);
  const paint = () => {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const w = (cvs.width = Math.floor(window.innerWidth * dpr));
    const h = (cvs.height = Math.floor(window.innerHeight * dpr));
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const n = Math.min(220, Math.floor((w * h) / 14000));
    for (let i = 0; i < n; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = Math.random() * 1.5 * dpr;
      ctx.globalAlpha = 0.15 + Math.random() * 0.5;
      ctx.fillStyle = Math.random() > 0.7 ? "#39ff14" : "#7dffb0";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  paint();
  // Repaint only on resize — never per-frame. `animate` reserved for a slow drift
  // we deliberately skip on the lowest tier to stay cool.
  let t: number | undefined;
  window.addEventListener("resize", () => {
    window.clearTimeout(t);
    t = window.setTimeout(paint, 200);
  });
  void animate;
}

// Premium layer. Runs synchronously after the base runtime registers its
// DOMContentLoaded boot, so these flags are set before the engine builds the DOM.
(function premium() {
  const spec = window.SPEC;
  const data = window.DATA;
  if (!spec || !data) return;

  window.__PHP = true;
  document.body.classList.add("php-premium");

  const reduce = prefersReducedMotion();
  const boot = mountBoot(spec, data, { reduce });

  initCursor(spec);

  if (spec.postfx.scanlines && !reduce) {
    const sl = document.createElement("div");
    sl.id = "ph-scanlines";
    sl.style.cssText =
      "position:fixed;inset:0;z-index:998;pointer-events:none;opacity:.32;" +
      "background:repeating-linear-gradient(0deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 2px,rgba(0,0,0,.16) 3px,rgba(0,0,0,0) 4px)";
    document.body.appendChild(sl);
  }

  // The static starfield void is ALWAYS the base background — cheap, painted once,
  // and what shows through when the WebGL hero fades on scroll. Premium owns the
  // background entirely now, so the base engine never draws its 2D one.
  mountStaticVoid(false);

  // Run the heavy WebGL scene (object on top of the void) only on capable,
  // non-touch, motion-OK devices. Everything else just keeps the static void.
  const useWebGL =
    spec.webgl.scene !== "off" &&
    webglSupported() &&
    !reduce &&
    !lowPowerDevice();

  // The base engine calls this once it has built the DOM into #ph-app.
  let ran = false;
  const onReady = () => {
    if (ran) return;
    ran = true;
    let webgl: WebGLHandle | null = null;
    if (useWebGL) {
      try {
        // A pack may give the object a contained stage; else full-screen.
        const stage = document.getElementById("ph-stage");
        webgl = initWebGL(spec, stage);
      } catch {
        webgl = null; // static void is already mounted underneath
      }
    }
    if (webgl && window.PH) {
      const wg = webgl;
      window.PH.onScroll((s) => wg.setProgress(s.progress, s.vel));
    }
    initReveals();
    boot.finish();
  };
  window.__PHP_domReady = onReady;

  // Safety net: if the engine never signals (e.g. error), reveal + drop boot.
  setTimeout(onReady, 4000);
})();
