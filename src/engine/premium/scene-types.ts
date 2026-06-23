import type * as THREE from "three";

export type SceneMode = "calm" | "tense" | "climax";

/** Effects the renderer exposes to a scene (screen flash/beam + bloom spike). */
export interface SceneFx {
  flash: (strength?: number) => void;
}

export interface SceneOpts {
  accent: THREE.Color;
  accent2: THREE.Color;
  intensity: number; // 0..1
  fx: SceneFx;
}

export interface SceneHandle {
  group: THREE.Object3D;
  /** Per-frame. progress 0..1 = scroll position, vel = scroll velocity. */
  update: (
    dt: number,
    progress: number,
    vel: number,
    pointer: { x: number; y: number },
  ) => void;
  /** Scroll-driven intensity band (calm → tense → climax). */
  setMode?: (mode: SceneMode) => void;
  /** A section entered view (dir 1 = scrolling down, -1 = up). */
  onSection?: (id: string, dir: 1 | -1) => void;
  dispose?: () => void;
}
