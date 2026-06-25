import * as THREE from "three";
import type { SceneHandle, SceneMode, SceneOpts } from "../scene-types";

/**
 * ghostObject — the GHOST_PROTOCOL centerpiece. A flowing PARTICLE FLOW FIELD
 * wrapped around a thin wireframe icosahedron core, so the shape is intentional
 * (a visible signal artifact) instead of an ambiguous cloud. ~13k fine points
 * seeded in a hollow rounded shell get advected through layered vector-noise;
 * neighbours move together into long emerald filaments that coil and breathe.
 *
 * It sits off to the RIGHT of the hero — the identity column reads on the left.
 *
 * Interactivity:
 *   - Mouse: points near the cursor are swirled + brightened. The core ring
 *     orients toward the pointer.
 *   - Scroll: the whole rig shrinks + dims a bit on the way down, then the
 *     GPU idles entirely once the hero is gone.
 *   - Mode: bumps churn + brightness at "tense" / "climax".
 *
 * Performance: pure Points + one tiny line wireframe. Noise advection runs in
 * the vertex shader only — no per-pixel surface shading. Cheap on a laptop.
 */
const SNOISE = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+1.0*C.xxx; vec3 x2=x0-i2+2.0*C.xxx; vec3 x3=x0-1.0+3.0*C.xxx;
  i=mod(i,289.0);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=1.0/7.0; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const VERT = `
  uniform float uTime,uProgress,uPointerAmt,uChurn,uBreath;
  uniform vec2 uPointer;
  attribute float aRand;
  varying float vBright;
  ${SNOISE}
  vec3 flow(vec3 p){
    float t = uTime*uChurn;
    vec3 q = p*0.5;
    vec3 d = vec3(
      snoise(q + vec3(0.0, t, 0.0)),
      snoise(q + vec3(4.7, t*0.9, 2.3)),
      snoise(q + vec3(8.3, t*1.1, 5.9)));
    vec3 q2 = p*1.15 + 7.0;
    d += 0.5*vec3(
      snoise(q2 + vec3(0.0, t*1.7, 0.0)),
      snoise(q2 + vec3(2.0, t*1.5, 3.0)),
      snoise(q2 + vec3(6.0, t*1.9, 1.0)));
    return d;
  }
  void main(){
    vec3 sp = position * uBreath;
    vec3 disp = flow(sp);
    vec3 pos = sp + disp*0.6;

    // MOUSE SWIRL: points near the cursor get pushed sideways + lit
    vec4 clip = projectionMatrix*modelViewMatrix*vec4(pos,1.0);
    vec2 ndc = clip.xy/clip.w;
    float near = smoothstep(0.55, 0.0, distance(ndc, uPointer));
    float touch = near*uPointerAmt;
    pos += vec3(disp.z, disp.x, -disp.y)*touch*0.85;

    float speed = length(disp);
    vBright = clamp((speed - 0.18)*0.8 + touch*1.1 + 0.22, 0.0, 1.6);

    vec4 mv = modelViewMatrix*vec4(pos,1.0);
    float dz = -mv.z;
    float att = clamp(7.5/dz, 0.55, 1.9);
    // particles are noticeably larger now — the cloud reads as intentional,
    // not as a fog. Bloom + the additive blend do the rest.
    gl_PointSize = (aRand*3.4 + 1.6) * att * (1.0 - uProgress*0.45);
    gl_Position = projectionMatrix*mv;
  }`;

const FRAG = `
  precision highp float;
  uniform vec3 uLite,uGreen;
  uniform float uMode;
  varying float vBright;
  void main(){
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if(d > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, d);
    // Bright phosphor filaments — strong enough to read on a near-black void.
    // At high vBright the core blows almost to white; at low brightness the
    // dim points still hold a clear green silhouette (not invisible).
    vec3 col = mix(uGreen*0.55, uLite, clamp(vBright*0.78, 0.0, 1.0));
    col = mix(col, vec3(0.88, 1.0, 0.92), smoothstep(0.82, 1.45, vBright));
    float a = soft * (0.085 + vBright*0.22 + uMode*0.04);
    gl_FragColor = vec4(col*(0.42 + vBright*0.62), a);
  }`;

export function createGhostObject(opts: SceneOpts): SceneHandle {
  const group = new THREE.Group();

  const green = opts.accent.clone();
  // Pale green-white for bright cores — derived from the signal green.
  const lite = green.clone().lerp(new THREE.Color(0.95, 1.0, 0.95), 0.7);

  // Seed ~13k points in a HOLLOW rounded shell (center stays dark), gently
  // stretched. The flow field warps the shell into a coiling silhouette.
  const N = 13200;
  const pos = new Float32Array(N * 3);
  const rnd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    // shell-biased radius — most particles live near the outer rim.
    const r = 2.05 * (0.68 + 0.32 * Math.pow(Math.random(), 0.45));
    pos[i * 3] = s * Math.cos(th) * r;
    pos[i * 3 + 1] = u * r * 1.12;
    pos[i * 3 + 2] = s * Math.sin(th) * r;
    rnd[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rnd, 1));

  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uChurn: { value: 0.06 + opts.intensity * 0.028 },
    uGreen: { value: green },
    uLite: { value: lite },
    uPointer: { value: new THREE.Vector2(0, 0) },
    uPointerAmt: { value: 0 },
    uBreath: { value: 1 },
    uMode: { value: 0 },
  };

  const points = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  // The intentional core — a thin twin-ring wireframe icosahedron that anchors
  // the shape, so the cloud reads as "an artifact" not "a smudge". Two passes
  // at slightly different scales give a faint glass shell without bloom-bombing.
  const coreGeo = new THREE.IcosahedronGeometry(1.05, 1);
  const coreWire = new THREE.WireframeGeometry(coreGeo);
  const coreMat = new THREE.LineBasicMaterial({
    color: green.clone().lerp(new THREE.Color(1, 1, 1), 0.18),
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const coreA = new THREE.LineSegments(coreWire, coreMat);
  const coreB = new THREE.LineSegments(
    coreWire,
    new THREE.LineBasicMaterial({
      color: 0xb8f4d4,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  coreB.scale.setScalar(1.42);
  coreA.renderOrder = 1;
  coreB.renderOrder = 1;

  // A tiny solid orb at dead center — gives the eye a clear focal point through
  // the bloom. Just a few additive sprite-sized points.
  const dotGeo = new THREE.SphereGeometry(0.18, 16, 16);
  const dotMat = new THREE.MeshBasicMaterial({
    color: 0xeafff3,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dot = new THREE.Mesh(dotGeo, dotMat);

  const obj = new THREE.Group();
  obj.add(coreB, coreA, dot, points);
  obj.rotation.z = -0.35; // tilt → the diamond lean

  // Background starfield — kept (it sells the depth behind the object). Dim
  // specks, no bloom contribution.
  const STAR_N = 820;
  const starPos = new Float32Array(STAR_N * 3);
  const starCol = new Float32Array(STAR_N * 3);
  const starWhite = new THREE.Color(0xe7eee8);
  const starMint = new THREE.Color(0x67dca4);
  const starCyan = new THREE.Color(0x9edbd0);
  for (let i = 0; i < STAR_N; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 50;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 32;
    starPos[i * 3 + 2] = -8 - Math.random() * 14;
    const c =
      Math.random() > 0.975
        ? starMint
        : Math.random() > 0.965
          ? starCyan
          : starWhite;
    starCol[i * 3] = c.r;
    starCol[i * 3 + 1] = c.g;
    starCol[i * 3 + 2] = c.b;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(starCol, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      size: 0.03,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexColors: true,
    }),
  );
  group.add(stars, obj);

  let spin = 0;
  let px = 0;
  let py = 0;
  let amt = 0;

  return {
    group,
    setMode(mode: SceneMode) {
      uniforms.uMode.value = mode === "calm" ? 0 : mode === "tense" ? 0.4 : 1;
    },
    update(dt, progress, _vel, pointer) {
      uniforms.uTime.value += dt;
      uniforms.uProgress.value = progress;
      // gentle breathing — never enough to feel like a pulse animation, just
      // enough to keep the silhouette alive when the visitor lingers.
      uniforms.uBreath.value =
        1 + Math.sin(uniforms.uTime.value * 0.5) * 0.012;

      px += (pointer.x - px) * 0.08;
      py += (pointer.y - py) * 0.08;
      uniforms.uPointer.value.set(px, py);
      amt += (0.95 - amt) * 0.05;
      uniforms.uPointerAmt.value = amt;

      spin += dt * 0.05;
      obj.rotation.y = spin;
      // counter-rotate the inner shell so the wireframe shows shifting facets
      coreA.rotation.x = spin * 1.3;
      coreA.rotation.z = -0.35 + spin * 0.4;
      coreB.rotation.x = -spin * 0.8;
      coreB.rotation.y = spin * 1.1;
      stars.rotation.y = spin * 0.12;

      // pointer-track tilt — the rig leans subtly under the hand.
      obj.rotation.x = py * 0.18;

      // Parked to the RIGHT of the hero, but pull it back inside the camera
      // frustum on narrower windows.
      const aspect =
        window.innerHeight > 0
          ? window.innerWidth / window.innerHeight
          : 16 / 9;
      const narrow = THREE.MathUtils.clamp((1.15 - aspect) / 0.55, 0, 1);
      obj.position.x = THREE.MathUtils.lerp(2.34, 0.46, narrow);
      obj.position.y = THREE.MathUtils.lerp(0.16, 0.06, narrow);
      obj.scale.setScalar(
        THREE.MathUtils.lerp(0.84, 0.46, narrow) * (1 - progress * 0.4),
      );
    },
    dispose() {
      geo.dispose();
      starGeo.dispose();
      coreGeo.dispose();
      coreWire.dispose();
      dotGeo.dispose();
    },
  };
}
