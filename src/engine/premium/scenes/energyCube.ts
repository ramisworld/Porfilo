import * as THREE from "three";
import type { SceneHandle, SceneMode, SceneOpts } from "../scene-types";

/**
 * energyCube — six holographic faces around a glowing core, sitting in the
 * hero's empty space. Scroll deconstructs the cube; crossing the explode
 * threshold fires the faces outward + a screen beam (fx.flash) + bloom spike;
 * scrolling back up reconstructs it. Reversible: every frame eases to a target
 * derived from scroll `progress`. Mouse adds parallax tumble.
 */
export function createEnergyCube(opts: SceneOpts): SceneHandle {
  const group = new THREE.Group();
  const SIZE = 2.7;
  const HALF = SIZE / 2;
  const SPREAD = 3.4 + opts.intensity * 2.6;
  const EXPLODE_AT = 0.5;
  const BASE = new THREE.Vector3(0, 0.1, 0); // centered (lives in a contained stage)

  const dirs = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ];

  const faceGeo = new THREE.PlaneGeometry(SIZE, SIZE);
  const edgeGeo = new THREE.EdgesGeometry(faceGeo);
  const faces = dirs.map((dir) => {
    const panel = new THREE.Group();
    const fill = new THREE.Mesh(
      faceGeo,
      new THREE.MeshBasicMaterial({
        color: opts.accent,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const edge = new THREE.LineSegments(
      edgeGeo,
      new THREE.LineBasicMaterial({ color: opts.accent, transparent: true, opacity: 1 }),
    );
    panel.add(fill, edge);
    panel.lookAt(dir);
    group.add(panel);
    return { panel, dir, spin: (Math.random() - 0.5) * 2 };
  });

  // Glowing core: bright inner sphere + a soft halo shell.
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.62, 2),
    new THREE.MeshBasicMaterial({ color: opts.accent2, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  const halo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.05, 2),
    new THREE.MeshBasicMaterial({
      color: opts.accent,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(core, halo);

  const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  let exploded = 0;
  let prevPast = false;
  let modeBoost = 0;
  let modeTarget = 0;
  const pos = BASE.clone();

  return {
    group,
    setMode(mode: SceneMode) {
      modeTarget = mode === "climax" ? 1 : mode === "tense" ? 0.45 : 0;
    },
    update(dt, progress, _vel, pointer) {
      const target = smooth(EXPLODE_AT, EXPLODE_AT + 0.2, progress);
      exploded += (target - exploded) * Math.min(1, dt * 6);
      modeBoost += (modeTarget - modeBoost) * Math.min(1, dt * 3);

      const past = progress > EXPLODE_AT;
      if (past && !prevPast) opts.fx.flash(0.9);
      prevPast = past;

      const dist = HALF + exploded * SPREAD;
      const t = performance.now() * 0.001;
      for (const f of faces) {
        f.panel.position.copy(f.dir).multiplyScalar(dist);
        f.panel.rotation.z = exploded * f.spin * 2.4;
        const fill = (f.panel.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
        fill.opacity = 0.14 + exploded * 0.18 + modeBoost * 0.1;
      }

      const cs = 0.9 + progress * 0.7 + exploded * 1.3 + modeBoost * 0.5;
      core.scale.setScalar(cs);
      halo.scale.setScalar(cs * (1.4 + Math.sin(t * 2) * 0.08));
      halo.material.opacity = 0.3 - exploded * 0.22 + modeBoost * 0.1;

      group.rotation.y += dt * (0.22 + modeBoost * 0.5 + exploded * 0.5);
      group.rotation.x = Math.sin(t * 0.3) * 0.18 + pointer.y * 0.25;
      pos.x += (BASE.x + pointer.x * 0.7 - pos.x) * 0.05;
      pos.y += (BASE.y + pointer.y * 0.4 - pos.y) * 0.05;
      group.position.copy(pos);
    },
    dispose() {
      faceGeo.dispose();
      edgeGeo.dispose();
    },
  };
}
