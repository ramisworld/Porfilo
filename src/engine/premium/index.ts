import { mountBoot } from "./boot";
import { initCursor } from "./cursor";
import { initWebGL, type WebGLHandle } from "./webgl";
import { initReveals } from "./scroll";
import {
  lowPowerDevice,
  prefersReducedMotion,
  webglSupported,
} from "./support";

/**
 * Deep-space void: the always-on background that shows through behind the
 * hero object and shines unobstructed once the visitor scrolls past it.
 *
 * Composition (cheap, all CSS gradients + one canvas):
 *   - near-black neutral base (NOT teal/blue)
 *   - large soft mint glow top-right, cooler cyan haze bottom-left
 *     (radial gradients — zero GPU cost vs WebGL)
 *   - three parallax layers of stars (~640 total): dim back layer, bright
 *     mid layer, sparse close layer that catches scroll velocity as a
 *     subtle hyperspace streak
 *   - very slow infinite drift (RAF capped to ~30fps) so the field is alive
 *     in idle. On `prefers-reduced-motion` we paint once and stop.
 */
function mountStaticVoid(animate: boolean): void {
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const wrap = document.createElement("div");
  wrap.id = "ph-void";
  wrap.style.cssText =
    "position:fixed;inset:0;z-index:0;pointer-events:none;" +
    // Layered atmosphere: top-right phosphor halo, bottom-left cyan haze,
    // soft top-down gradient to add vertical depth without lightening the bulk.
    "background:" +
    "radial-gradient(48% 38% at 86% 12%, rgba(54,212,134,.10), transparent 70%)," +
    "radial-gradient(54% 42% at 8% 92%, rgba(110,200,220,.07), transparent 72%)," +
    "radial-gradient(120% 80% at 50% -10%, rgba(20,40,34,.30), transparent 64%)," +
    "linear-gradient(180deg,#020505 0%,#010303 60%,#000202 100%);";
  const cvs = document.createElement("canvas");
  cvs.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;";
  wrap.appendChild(cvs);
  document.body.appendChild(wrap);

  const ctx = cvs.getContext("2d", { alpha: true });
  if (!ctx) return;

  type Star = {
    x: number;
    y: number;
    r: number;
    a: number; // base alpha
    p: number; // twinkle phase
    s: number; // twinkle speed
    c: string; // hex color
    layer: 0 | 1 | 2; // 0=back, 1=mid, 2=close
  };
  let stars: Star[] = [];
  let w = 0;
  let h = 0;
  let dpr = 1;

  const seed = (W: number, H: number) => {
    stars = [];
    // ~640 total — a real field, not a sprinkle.
    const N = Math.min(720, Math.floor((W * H) / dpr / dpr / 2600));
    for (let i = 0; i < N; i++) {
      const layer: 0 | 1 | 2 =
        Math.random() < 0.58 ? 0 : Math.random() < 0.85 ? 1 : 2;
      const big = layer === 2;
      const rare = Math.random();
      const c =
        rare > 0.985
          ? "#55dca0" // rare phosphor green
          : rare > 0.96
            ? "#9fded0" // rare cool cyan
            : "#e7eee8"; // warm white default
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r:
          (big
            ? 0.85 + Math.random() * 0.65
            : layer === 1
              ? 0.45 + Math.random() * 0.45
              : 0.22 + Math.random() * 0.32) * dpr,
        a:
          layer === 2
            ? 0.5 + Math.random() * 0.3
            : layer === 1
              ? 0.25 + Math.random() * 0.32
              : 0.1 + Math.random() * 0.22,
        p: Math.random() * Math.PI * 2,
        s: 0.4 + Math.random() * 1.4,
        c,
        layer,
      });
    }
  };

  const resize = () => {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    w = cvs.width = Math.floor(window.innerWidth * dpr);
    h = cvs.height = Math.floor(window.innerHeight * dpr);
    seed(w, h);
  };
  resize();

  // Scroll velocity / progress — fed by the engine's scroll hub when available.
  let scrollVel = 0;
  let scrollOff = 0; // accumulated parallax offset (px)
  const PH = (window as unknown as { PH?: { onScroll?: (fn: (s: { vel: number; progress: number }) => void) => void } }).PH;
  if (PH && typeof PH.onScroll === "function") {
    PH.onScroll((s) => {
      // Smooth velocity so single tick spikes don't streak.
      scrollVel += (s.vel - scrollVel) * 0.5;
    });
  }

  let raf = 0;
  const draw = (now: number) => {
    raf = 0;

    // Decay velocity in idle.
    scrollVel *= 0.9;
    // Parallax: close stars drift "down" gently when scrolling down (vel>0)
    // — small enough to feel like depth, not motion sickness.
    scrollOff += scrollVel * 0.06 * dpr;

    ctx.clearRect(0, 0, w, h);

    const t = now / 1000;
    for (let i = 0, len = stars.length; i < len; i++) {
      const st = stars[i]!;
      // Layered parallax: layer 0 barely moves, layer 2 reacts most to scroll.
      const par = st.layer === 0 ? 0.18 : st.layer === 1 ? 0.45 : 1;
      let y = st.y + scrollOff * par * 0.08;
      // wrap softly so the canvas never looks empty
      const hh = h;
      if (y < -4) y = hh + (y % hh);
      else if (y > hh + 4) y = y % hh;

      // very slow idle drift on diagonals (low-amplitude trig)
      const dx = Math.sin(t * 0.06 + st.p) * 0.4 * par * dpr;
      const dy = Math.cos(t * 0.05 + st.p * 0.7) * 0.3 * par * dpr;
      const x = st.x + dx;
      y += dy;

      // gentle twinkle — alpha breathes, never blinks hard
      const tw = 0.78 + 0.22 * Math.sin(t * st.s + st.p);
      const a = Math.min(0.95, st.a * tw);

      ctx.globalAlpha = a;
      ctx.fillStyle = st.c;
      ctx.beginPath();
      ctx.arc(x, y, st.r, 0, Math.PI * 2);
      ctx.fill();

      // Subtle hyperspace streak on fast scroll: only the close layer streaks,
      // and only for a moment (vel decays each frame).
      if (st.layer === 2 && Math.abs(scrollVel) > 6) {
        const len2 = Math.min(28 * dpr, Math.abs(scrollVel) * 0.55 * dpr);
        ctx.globalAlpha = a * 0.45;
        ctx.strokeStyle = st.c;
        ctx.lineWidth = Math.max(0.5, st.r * 0.6);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - Math.sign(scrollVel) * len2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    if (!reduce) raf = requestAnimationFrame(draw);
  };
  if (reduce) draw(performance.now());
  else raf = requestAnimationFrame(draw);

  // Idle when tab is hidden — never burn battery in a background tab.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else if (!reduce && !raf) {
      raf = requestAnimationFrame(draw);
    }
  });

  let rt: number | undefined;
  window.addEventListener("resize", () => {
    window.clearTimeout(rt);
    rt = window.setTimeout(resize, 200);
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
      "position:fixed;inset:0;z-index:998;pointer-events:none;opacity:.22;" +
      "background:repeating-linear-gradient(0deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 2px,rgba(0,0,0,.18) 3px,rgba(0,0,0,0) 4px)";
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
