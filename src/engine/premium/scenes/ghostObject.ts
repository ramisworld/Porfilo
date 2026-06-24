import * as THREE from "three";
import type { SceneHandle, SceneMode, SceneOpts } from "../scene-types";

/**
 * ghostObject — the GHOST_PROTOCOL centerpiece. A flowing PARTICLE FLOW FIELD:
 * ~14k fine points seeded in a hollow rounded shell and advected through layered
 * vector-noise, so neighbours move together into long green filaments that coil
 * and breathe — bright white-green where streams bunch, hollow + dim at the core.
 * It lives off to the RIGHT of the hero so the identity column reads on the left.
 *
 * Mouse: points near the cursor are swirled + brightened (the field reacts under
 * your hand). Scroll: shrinks + fades, then the GPU idles. Bloom + RGB-shift
 * (postfx) and the global scanline overlay finish the look.
 *
 * Performance: pure Points, one ShaderMaterial, no per-pixel surface shading and
 * no re-tessellation — the noise advection runs in the vertex shader only. Cheap
 * and cool on a laptop.
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
  uniform float uTime,uProgress,uPointerAmt,uChurn;
  uniform vec2 uPointer;
  attribute float aRand;
  varying float vBright;
  ${SNOISE}
  // layered vector-noise field → coherent flowing displacement (neighbours move
  // together into filaments). Two octaves: big sweeps + fine detail. Animated.
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
    vec3 sp = position;
    vec3 disp = flow(sp);
    vec3 pos = sp + disp*0.55;

    // MOUSE SWIRL (screen-space): points near the cursor get pushed + lit
    vec4 clip = projectionMatrix*modelViewMatrix*vec4(pos,1.0);
    vec2 ndc = clip.xy/clip.w;
    float near = smoothstep(0.55, 0.0, distance(ndc, uPointer));
    float touch = near*uPointerAmt;
    pos += vec3(disp.z, disp.x, -disp.y)*touch*0.7;

    float speed = length(disp);
    vBright = clamp((speed - 0.2)*0.7 + touch*0.9 + 0.12, 0.0, 1.4);

    vec4 mv = modelViewMatrix*vec4(pos,1.0);
    float dz = -mv.z;
    float att = clamp(6.5/dz, 0.5, 1.7);
    gl_PointSize = (aRand*2.6 + 1.0) * att * (1.0 - uProgress*0.45);
    gl_Position = projectionMatrix*mv;
  }`;

const FRAG = `
  precision highp float;
  uniform vec3 uLite,uGreen;
  varying float vBright;
  void main(){
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if(d > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, d);
    // green-to-pale-green gradient, white-hot only where streams bunch. Reads
    // as a wireframe ribbon of green/white dots — never blue, never a cloud.
    vec3 col = mix(uGreen*0.5, uLite, clamp(vBright, 0.0, 1.0));
    col = mix(col, vec3(0.94, 1.0, 0.95), smoothstep(0.75, 1.3, vBright));
    float a = soft * (0.11 + vBright*0.34);
    gl_FragColor = vec4(col*(0.45 + vBright*0.8), a);
  }`;

export function createGhostObject(opts: SceneOpts): SceneHandle {
  const group = new THREE.Group();

  const green = opts.accent.clone();
  // Pale green-white for bright cores — derived from the signal green, never the
  // theme's amber accent2 (kept neutral so the core never reads blue/amber).
  const lite = green.clone().lerp(new THREE.Color(0.95, 1.0, 0.95), 0.72);

  // Seed ~9k points in a HOLLOW rounded shell (center stays dark), slightly
  // stretched vertically. The flow field warps the shell into an organic
  // coiling silhouette. Fewer points than v1 → dimmer, more restrained.
  const N = 9000;
  const pos = new Float32Array(N * 3);
  const rnd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    // uniform direction on the sphere
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    // shell-biased radius (pow pushes density to the outer rim → hollow core)
    const r = 2.05 * (0.66 + 0.34 * Math.pow(Math.random(), 0.5));
    pos[i * 3] = s * Math.cos(th) * r;
    pos[i * 3 + 1] = u * r * 1.18; // gentle vertical stretch
    pos[i * 3 + 2] = s * Math.sin(th) * r;
    rnd[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rnd, 1));

  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uChurn: { value: 0.05 + opts.intensity * 0.026 },
    uGreen: { value: green },
    uLite: { value: lite },
    uPointer: { value: new THREE.Vector2(0, 0) },
    uPointerAmt: { value: 0 },
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

  // The flow cloud lives in its own subgroup so we can park it to the right and
  // spin it slowly without touching the starfield. No central glow orb — the
  // brightness comes from the filament dots/linework themselves + soft bloom.
  const obj = new THREE.Group();
  obj.add(points);
  obj.rotation.z = -0.35; // tilt → the diamond lean from the reference

  // Sparse starfield void behind — small, clear, sparse pale specks on black.
  const STAR_N = 220;
  const starPos = new Float32Array(STAR_N * 3);
  for (let i = 0; i < STAR_N; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 46;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 30;
    starPos[i * 3 + 2] = -8 - Math.random() * 12;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: new THREE.Color(0xdfeee4),
      size: 0.05,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(stars, obj);

  let spin = 0;
  let px = 0;
  let py = 0;
  let amt = 0;

  return {
    group,
    setMode(_mode: SceneMode) {
      // intensity handled by churn; no discrete mode swap needed for the field
    },
    update(dt, progress, _vel, pointer) {
      uniforms.uTime.value += dt;
      uniforms.uProgress.value = progress;

      px += (pointer.x - px) * 0.08;
      py += (pointer.y - py) * 0.08;
      uniforms.uPointer.value.set(px, py);
      amt += (0.85 - amt) * 0.05;
      uniforms.uPointerAmt.value = amt;

      spin += dt * 0.04;
      obj.rotation.y = spin;
      stars.rotation.y = spin * 0.12;

      // Parked to the RIGHT of the hero, but pull it back inside the camera
      // frustum as portrait-ish windows lose horizontal world space.
      const aspect =
        window.innerHeight > 0
          ? window.innerWidth / window.innerHeight
          : 16 / 9;
      const narrow = THREE.MathUtils.clamp((1.15 - aspect) / 0.55, 0, 1);
      obj.position.x = THREE.MathUtils.lerp(2.0, 0.45, narrow);
      obj.position.y = THREE.MathUtils.lerp(0.18, 0.06, narrow);
      obj.scale.setScalar(
        THREE.MathUtils.lerp(0.9, 0.44, narrow) * (1 - progress * 0.4),
      );
    },
    dispose() {
      geo.dispose();
      starGeo.dispose();
    },
  };
}
