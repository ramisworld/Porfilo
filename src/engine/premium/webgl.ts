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
import { createGlassOrb } from "./scenes/glassOrb";
import { createEnergyCube } from "./scenes/energyCube";
import { createEnergySphere } from "./scenes/energySphere";
import { createMorphObject } from "./scenes/morphObject";
import { makeRng } from "./prng";
import { rollObject } from "./rollObject";

export interface WebGLHandle {
  setProgress: (progress: number, vel: number) => void;
}

function makeScene(spec: DesignSpec, opts: SceneOpts): SceneHandle {
  switch (spec.webgl.scene) {
    case "morphObject": {
      const g = spec.generative;
      const rng = makeRng(g.seed);
      const params = rollObject(rng, g.temperament, {
        objectComplexity: g.objectComplexity,
        motionEnergy: g.motionEnergy,
        density: g.density,
      });
      const handle = createMorphObject(opts, params, rng);
      // Per-stage framing: fullbleed must DOMINATE the hero (it's the whole backdrop),
      // orb/bare crop tighter. Scale to fill.
      const stage = spec.layout.stage;
      handle.group.scale.setScalar(
        stage === "fullbleed" ? 1.9 : stage === "orb" ? 1.3 : stage === "bare" ? 1.15 : 1,
      );
      return handle;
    }
    case "energyCube":
      return createEnergyCube(opts);
    case "energySphere":
      return createEnergySphere(opts);
    case "glassOrb":
      return createGlassOrb(opts);
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
    ? "position:absolute;inset:0;width:100%;height:100%;pointer-events:none"
    : "position:fixed;inset:0;z-index:0;pointer-events:none";
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
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  let { w, h } = size();
  renderer.setSize(w, h, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
  camera.position.z =
    spec.webgl.scene === "energyCube" ? 7.5 : spec.webgl.scene === "morphObject" ? 6.7 : 6.2;

  const accent = new THREE.Color(spec.theme.accent);
  const accent2 = new THREE.Color(spec.theme.accent2);
  const handle = makeScene(spec, {
    accent,
    accent2,
    intensity: spec.webgl.intensity,
    fx,
  });
  scene.add(handle.group);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const baseBloom = spec.postfx.bloom * 1.4;
  let bloom: UnrealBloomPass | null = null;
  if (spec.postfx.bloom > 0.01) {
    bloom = new UnrealBloomPass(new THREE.Vector2(w, h), baseBloom, 0.6, 0.2);
    composer.addPass(bloom);
  }
  if (spec.postfx.chromatic > 0.01) {
    const rgb = new ShaderPass(RGBShiftShader);
    (rgb.uniforms.amount as { value: number }).value = spec.postfx.chromatic * 0.0026;
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
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const next = modeFor(progress);
    if (next !== mode) {
      mode = next;
      handle.setMode?.(mode);
    }
    handle.update(dt, progress, vel, pointer);
    if (bloom) {
      bloomBoost *= 0.92;
      bloom.strength = baseBloom + bloomBoost * 1.6;
    }
    // Fullbleed objects are dramatic in the hero but must RECEDE for the content
    // sections below, or they wash text out. Fade the canvas as scroll leaves the
    // hero (1.0 at top → 0.22 by ~40% scroll). Contained objects stay full.
    if (!contained) {
      const dim = 0.22 + 0.78 * (1 - Math.min(1, progress * 2.6));
      // Parallax: the fullbleed object drifts up + scales slightly as you scroll,
      // so the hero feels alive (not a static backdrop).
      const ty = -progress * 12;
      const sc = 1 + progress * 0.12;
      canvas.style.opacity = dim.toFixed(3);
      canvas.style.transform = `translateY(${ty.toFixed(2)}vh) scale(${sc.toFixed(3)})`;
    }
    composer.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return {
    setProgress(p, v) {
      progress = p;
      vel = v;
    },
  };
}
