import * as THREE from "three";
import type { SceneHandle, SceneMode, SceneOpts } from "../scene-types";
import type { MorphParams, Primitive } from "../rollObject";
import type { Rng } from "../prng";

/**
 * morphObject — ONE procedural object that replaces the fixed energyCube /
 * energySphere. Driven by a rolled MorphParams recipe (form, primitive, count,
 * explode, spin, surface, motion), it builds a glowing assembly of pieces that
 * destructures on scroll and reassembles on the way back up. Every distinct
 * seed rolls a genuinely different object; the same seed reproduces exactly.
 *
 * Built from cheap additive fills + edge lines + a glowing core (no per-piece
 * GLSL), so high piece-counts stay smooth. Lives in a contained #ph-stage.
 */

function unitGeometry(primitive: Primitive): THREE.BufferGeometry {
  switch (primitive) {
    case "cube":
      return new THREE.BoxGeometry(1, 1, 1);
    case "prism":
      return new THREE.CylinderGeometry(0.72, 0.72, 1.25, 3);
    case "octa":
      return new THREE.OctahedronGeometry(0.7, 0);
    case "tetra":
      return new THREE.TetrahedronGeometry(0.82, 0);
    case "sphere":
      return new THREE.IcosahedronGeometry(0.74, 1);
    case "icosa":
    default:
      return new THREE.IcosahedronGeometry(0.72, 0);
  }
}

// Even point on a unit sphere (Fibonacci) — used for shards/orbital shells.
function fib(i: number, n: number): THREE.Vector3 {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
  const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
  return new THREE.Vector3(
    Math.cos(theta) * Math.sin(phi),
    Math.cos(phi),
    Math.sin(theta) * Math.sin(phi),
  );
}

interface Piece {
  group: THREE.Group;
  base: THREE.Vector3; // assembled position
  dir: THREE.Vector3; // explode direction
  spinAxis: THREE.Vector3;
  phase: number; // idle-wobble phase
  orbit: number; // orbital angular speed
}

export function createMorphObject(
  opts: SceneOpts,
  p: MorphParams,
  rng: Rng,
): SceneHandle {
  const group = new THREE.Group();
  const geo = unitGeometry(p.primitive);
  const edgeGeo = new THREE.EdgesGeometry(geo, 18);

  const fillOpacity = 0.1 + (1 - p.wire) * 0.26;
  const edgeOpacity = 0.42 + p.wire * 0.58; // floor high so the geometry always reads

  const pieces: Piece[] = [];
  const n = Math.max(1, p.count);

  // ---- arrangement per form ----
  const layout = (i: number): { base: THREE.Vector3; dir: THREE.Vector3; scale: THREE.Vector3; orbit: number } => {
    const jitter = () => (rng.next() * 2 - 1) * p.asymmetry;
    if (p.form === "monolith") {
      return { base: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 1, 0), scale: new THREE.Vector3(1.9, 1.9, 1.9), orbit: 0 };
    }
    if (p.form === "cluster") {
      const v = new THREE.Vector3(rng.range(-0.7, 0.7), rng.range(-0.7, 0.7), rng.range(-0.7, 0.7));
      const dir = v.clone().normalize();
      const s = 0.42 + rng.next() * 0.5 * p.sizeMix + 0.18;
      return { base: v, dir, scale: new THREE.Vector3(s, s, s), orbit: 0 };
    }
    if (p.form === "lattice") {
      const dim = Math.ceil(Math.cbrt(n));
      const x = (i % dim) - (dim - 1) / 2;
      const y = (Math.floor(i / dim) % dim) - (dim - 1) / 2;
      const z = Math.floor(i / (dim * dim)) - (dim - 1) / 2;
      const span = 1.15;
      const base = new THREE.Vector3(x, y, z).multiplyScalar(span / Math.max(1, (dim - 1) / 2 || 1));
      base.addScalar(0).add(new THREE.Vector3(jitter() * 0.3, jitter() * 0.3, jitter() * 0.3));
      const dir = base.lengthSq() < 1e-4 ? new THREE.Vector3(0, 1, 0) : base.clone().normalize();
      const s = 0.46 * (1 - p.sizeMix * 0.4 + rng.next() * p.sizeMix * 0.4);
      return { base, dir, scale: new THREE.Vector3(s, s, s), orbit: 0 };
    }
    if (p.form === "orbital") {
      const ring = i % 3;
      const r = 0.82 + ring * 0.32 + jitter() * 0.15;
      const ang = (i / n) * Math.PI * 2 + ring * 0.7;
      const yb = (rng.next() * 2 - 1) * 0.4;
      const base = new THREE.Vector3(Math.cos(ang) * r, yb, Math.sin(ang) * r);
      const dir = base.clone().normalize();
      const s = 0.4 * (1 - p.sizeMix * 0.4 + rng.next() * p.sizeMix * 0.4);
      return { base, dir, scale: new THREE.Vector3(s, s, s), orbit: 0.2 + rng.next() * 0.3 };
    }
    // shards — pieces on a sphere shell, flattened, facing outward
    const d = fib(i, n);
    const base = d.clone().multiplyScalar(0.95 + jitter() * 0.2);
    const s = 0.5 * (1 - p.sizeMix * 0.4 + rng.next() * p.sizeMix * 0.4);
    return { base, dir: d, scale: new THREE.Vector3(s, s, s * 0.42), orbit: 0 };
  };

  for (let i = 0; i < n; i++) {
    const { base, dir, scale, orbit } = layout(i);
    const sub = new THREE.Group();
    const fill = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: opts.accent,
        transparent: true,
        opacity: fillOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const edge = new THREE.LineSegments(
      edgeGeo,
      new THREE.LineBasicMaterial({ color: opts.accent, transparent: true, opacity: edgeOpacity }),
    );
    sub.add(fill, edge);
    sub.scale.copy(scale);
    if (p.form === "shards") sub.lookAt(dir);
    sub.position.copy(base);
    group.add(sub);
    pieces.push({
      group: sub,
      base,
      dir,
      spinAxis: new THREE.Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize(),
      phase: rng.range(0, Math.PI * 2),
      orbit,
    });
  }

  // ---- glowing core + fresnel-ish halo. Kept SMALL so it accents the piece
  // assembly rather than engulfing it (a giant halo turns every form into a blob). ----
  const coreBase = 0.32 + p.glow * 0.38; // ≈0.32–0.70
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.5, 2),
    new THREE.MeshBasicMaterial({ color: opts.accent2, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 + p.glow * 0.4 }),
  );
  const halo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.9, 2),
    new THREE.MeshBasicMaterial({ color: opts.accent, transparent: true, opacity: 0.06 + p.fresnel * 0.12, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  core.scale.setScalar(coreBase);
  halo.scale.setScalar(coreBase * 1.35);
  group.add(core, halo);

  const SPREAD = 1.4 + p.explode * 2.6;
  const EXPLODE_AT = 0.5;
  const smooth = (x: number) => {
    const t = Math.min(1, Math.max(0, x));
    return Math.pow(t, p.explodeCurve);
  };

  let exploded = 0;
  let prevPast = false;
  let modeBoost = 0;
  let modeTarget = 0;
  const tmp = new THREE.Vector3();
  const q = new THREE.Quaternion();

  return {
    group,
    setMode(mode: SceneMode) {
      modeTarget = mode === "climax" ? 1 : mode === "tense" ? 0.4 : 0;
    },
    update(dt, progress, _vel, pointer) {
      const target = smooth((progress - (EXPLODE_AT - 0.3)) / 0.6);
      exploded += (target - exploded) * Math.min(1, dt * 5);
      modeBoost += (modeTarget - modeBoost) * Math.min(1, dt * 2.5);
      const t = performance.now() * 0.001;

      // Raw/shard burst: screen beam when crossing the threshold.
      const past = progress > EXPLODE_AT;
      if (past && !prevPast && p.explode > 0.5) opts.fx.flash(0.55 + p.explode * 0.4);
      prevPast = past;

      for (const pc of pieces) {
        // explode outward + idle breathing along dir
        const breath = Math.sin(t * (0.6 + p.noiseSpeed * 1.6) + pc.phase) * p.noiseAmp * 0.4;
        const dist = exploded * SPREAD + breath + modeBoost * 0.4;
        tmp.copy(pc.dir).multiplyScalar(dist);
        if (pc.orbit) {
          // orbital drift around Y
          const a = t * pc.orbit;
          const c = Math.cos(a), s = Math.sin(a);
          pc.group.position.set(
            (pc.base.x + tmp.x) * c - (pc.base.z + tmp.z) * s,
            pc.base.y + tmp.y,
            (pc.base.x + tmp.x) * s + (pc.base.z + tmp.z) * c,
          );
        } else {
          pc.group.position.copy(pc.base).add(tmp);
        }
        // per-piece spin (grows with explode)
        const spinAmt = (0.2 + exploded * 1.8 + modeBoost * 0.6) * p.spin * dt;
        if (spinAmt) {
          q.setFromAxisAngle(pc.spinAxis, spinAmt);
          pc.group.quaternion.premultiply(q);
        }
      }

      const cs = coreBase * (1 + progress * 0.45 + modeBoost * 0.35);
      core.scale.setScalar(cs);
      halo.scale.setScalar(cs * 1.35 * (1 + Math.sin(t * 1.6) * 0.06));
      halo.material.opacity = (0.06 + p.fresnel * 0.12) * (1 - exploded * 0.4);

      group.rotation.y += dt * (0.12 + p.drift * 0.5 + exploded * 0.4 + modeBoost * 0.3);
      group.rotation.x = Math.sin(t * 0.25) * 0.12 * (0.4 + p.drift) + pointer.y * 0.25 * p.pointer;
      group.position.x += (pointer.x * 0.6 * p.pointer - group.position.x) * 0.04;
    },
    dispose() {
      geo.dispose();
      edgeGeo.dispose();
    },
  };
}
