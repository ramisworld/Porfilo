import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { RGBShiftShader } from "three/examples/jsm/shaders/RGBShiftShader.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { DesignSpec } from "../spec";
import type { SceneFx, SceneHandle, SceneMode, SceneOpts } from "./scene-types";
import { createStarfield } from "./scenes/starfield";
import { createGhostObject } from "./scenes/ghostObject";

export interface WebGLHandle {
  setProgress: (progress: number, vel: number) => void;
}

function makeScene(spec: DesignSpec, opts: SceneOpts): SceneHandle {
  switch (spec.webgl.scene) {
    case "ghostObject":
      return createGhostObject(opts);
    case "starfield":
    default:
      return createStarfield(opts);
  }
}

function modeFor(progress: number): SceneMode {
  if (progress > 0.66) return "climax";
  if (progress > 0.33) return "tense";
  return "calm";
}

/**
 * Mount the WebGL scene. If `container` is given, the canvas fills that element
 * (a contained "stage" — the object lives in a panel, never washing the page);
 * otherwise it's a fixed full-screen background.
 */
export function initWebGL(
  spec: DesignSpec,
  container?: HTMLElement | null,
): WebGLHandle {
  const contained = !!container;
  const host = container ?? document.body;

  const canvas = document.createElement("canvas");
  canvas.id = "ph-webgl";
  canvas.style.cssText = contained
    ? "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none"
    : "position:fixed;inset:0;width:100%;height:100%;display:block;z-index:0;pointer-events:none";
  host.appendChild(canvas);

  const size = () =>
    contained
      ? { w: host.clientWidth || 1, h: host.clientHeight || 1 }
      : { w: window.innerWidth, h: window.innerHeight };

  // Screen beam/flash overlay (fired by scenes on a burst) — scoped to the host.
  const flashEl = document.createElement("div");
  flashEl.style.cssText =
    (contained ? "position:absolute" : "position:fixed;z-index:2") +
    ";inset:0;pointer-events:none;opacity:0;transition:opacity .5s ease;mix-blend-mode:screen;" +
    `background:radial-gradient(circle at 50% 50%, ${spec.theme.glow}, transparent 70%)`;
  host.appendChild(flashEl);

  let bloomBoost = 0;
  const fx: SceneFx = {
    flash(strength = 0.8) {
      flashEl.style.opacity = String(Math.min(1, strength));
      requestAnimationFrame(() => (flashEl.style.opacity = "0"));
      bloomBoost = Math.max(bloomBoost, strength);
    },
  };

  const renderer = new THREE.WebGLRenderer({
    canvas,
    // Bloom softens edges, so MSAA on the fullbleed scene is wasted GPU.
    antialias: contained,
    // ALWAYS alpha — even fullbleed — so the static void layer (stars +
    // atmospheric glows) shows through behind the hero object instead of
    // being covered by an opaque clear color.
    alpha: true,
    powerPreference: "high-performance",
  });
  // Cap DPR hard — a fullbleed bloom scene at 2× retina is 4× the fragments for
  // no visible gain. 1.5 keeps it crisp while cutting GPU/heat dramatically.
  renderer.setPixelRatio(
    Math.min(contained ? 2 : 1.5, window.devicePixelRatio || 1),
  );
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const ghostObject = spec.webgl.scene === "ghostObject";
  // Slightly hotter exposure on the ghost so the filaments read on near-black
  // without the whole hero going milky. Bloom does the heavy lifting; this
  // just lifts the floor so the cloud isn't invisible at idle.
  renderer.toneMappingExposure = ghostObject ? 0.92 : 1.0;
  // Transparent clear — the static void layer behind composites through.
  // UnrealBloomPass works fine on a transparent buffer when the underlying
  // page background is dark (the void layer is near-black with subtle glows).
  renderer.setClearColor(new THREE.Color(0x000000), 0);
  let { w, h } = size();
  renderer.setSize(w, h, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
  camera.position.z = spec.webgl.scene === "ghostObject" ? 5.6 : 6.2;

  const accent = new THREE.Color(ghostObject ? "#36d486" : spec.theme.accent);
  const accent2 = new THREE.Color(ghostObject ? "#80e8bd" : spec.theme.accent2);
  const handle = makeScene(spec, {
    accent,
    accent2,
    intensity: spec.webgl.intensity,
    fx,
  });
  scene.add(handle.group);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Slightly stronger bloom on the ghost — enough to give the filaments a
  // proper phosphor glow without washing the whole hero in fog.
  const baseBloom = spec.postfx.bloom * (ghostObject ? 0.62 : 1.32);
  let bloom: UnrealBloomPass | null = null;
  if (spec.postfx.bloom > 0.01) {
    bloom = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      baseBloom,
      ghostObject ? 0.42 : 0.6,
      ghostObject ? 0.7 : 0.4,
    );
    composer.addPass(bloom);
  }
  if (spec.postfx.chromatic > 0.01) {
    const rgb = new ShaderPass(RGBShiftShader);
    (rgb.uniforms.amount as { value: number }).value =
      spec.postfx.chromatic * 0.0026;
    composer.addPass(rgb);
  }
  composer.addPass(new OutputPass());

  const pointer = { x: 0, y: 0 };
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    },
    { passive: true },
  );

  const resize = () => {
    const s = size();
    w = s.w;
    h = s.h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  if (contained && "ResizeObserver" in window) {
    new ResizeObserver(resize).observe(host);
  } else {
    window.addEventListener("resize", resize);
  }

  const clock = new THREE.Clock();
  let progress = 0;
  let vel = 0;
  let mode: SceneMode = "calm";

  // ---- thermal governor ----
  // 1) frame-cap to ~40fps (don't render every 120Hz tick).
  // 2) pause entirely when the tab is hidden.
  // 3) fade + pause once the hero is scrolled away — the static void shows through
  //    and the GPU goes idle while the visitor reads (the big heat win).
  const TARGET_DT = 1 / 40;
  let acc = 0;
  let visible = !document.hidden;
  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    clock.getDelta(); // drop the gap so we don't fast-forward on resume
  });

  const loop = () => {
    requestAnimationFrame(loop);
    if (!visible) return;

    // Fullbleed: the object owns the hero, then recedes as the hero scrolls out of
    // view so the content sections stay clean (static void + starfield show
    // through). Tie this to viewport scroll (robust on short AND long pages), not
    // the global progress fraction. Gone by ~0.7 viewport scrolled → idle the GPU.
    if (!contained) {
      const vh = window.innerHeight || 1;
      const sy = window.scrollY || document.documentElement.scrollTop || 0;
      const out = sy / (vh * 0.9);
      // Keep the object at full strength for most of the hero, then a longer
      // smooth fade so it never pops to black mid-scroll.
      const fade = out <= 0.4 ? 1 : Math.max(0, 1 - (out - 0.4) * 1.3);
      canvas.style.opacity = String(fade);
      if (fade <= 0.001) return; // hero gone — idle the GPU
    }

    acc += clock.getDelta();
    if (acc < TARGET_DT) return; // frame cap
    const dt = Math.min(acc, 0.05);
    acc = 0;

    const next = modeFor(progress);
    if (next !== mode) {
      mode = next;
      handle.setMode?.(mode);
    }
    handle.update(dt, progress, vel, pointer);
    if (bloom) {
      bloomBoost *= 0.92;
      bloom.strength = baseBloom + bloomBoost * (ghostObject ? 0.42 : 1.6);
    }
    composer.render();
  };
  requestAnimationFrame(loop);

  return {
    setProgress(p, v) {
      progress = p;
      vel = v;
    },
  };
}
