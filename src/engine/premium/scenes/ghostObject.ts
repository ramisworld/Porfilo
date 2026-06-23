import * as THREE from "three";
import type { SceneHandle, SceneMode, SceneOpts } from "../scene-types";

/**
 * ghostObject — the GHOST_PROTOCOL centerpiece. A faceted, glowing plasma object:
 * an icosphere displaced by slow layered noise so it undulates organically like a
 * floating drop of light. Brightness follows the surface ridges → flowing "veins
 * of light"; flat per-face normals give it crystalline glass facets. It floats in
 * a sparse green starfield void (cheap Points, not a screen-filling shader) so all
 * the glow stays on the object — clean and light, the crazzy way. Mouse creases
 * it; scroll calms + fades it. Bloom + RGB-shift (postfx) finish the look.
 *
 * Performance: geometry is detail 5 (~20k tris) not 7 (~327k) — a 16× cut that
 * keeps the warp smooth while giving slightly larger, more "constructed" facets.
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
  uniform float uTime,uProgress,uChurn,uExplode,uPointerAmt;
  uniform vec2 uPointer;
  varying vec3 vWorld; varying float vRidge;
  ${SNOISE}
  float fbm(vec3 p){ float a=0.0,amp=0.5; for(int i=0;i<4;i++){ a+=amp*snoise(p); p*=1.95; amp*=0.5; } return a; }
  void main(){
    vec3 sp=position;
    // big, slow, organic bulges → the undulating water-drop silhouette.
    // calmer + smaller as you scroll down (uProgress reduces amplitude).
    float bulge=fbm(sp*0.42+vec3(uTime*uChurn*0.5,uTime*uChurn,uTime*uChurn*0.3));
    float detail=snoise(sp*2.4+vec3(0.0,uTime*uChurn*1.4,0.0));
    float disp=bulge*(0.56-uProgress*0.30)+detail*0.085;
    // MOUSE CREASE (screen-space): the surface gently creases wherever the cursor
    // hovers over the object — any side, independent of rotation; smooth, subtle.
    vec4 baseClip=projectionMatrix*modelViewMatrix*vec4(sp,1.0);
    vec2 ndc=baseClip.xy/baseClip.w;
    vec3 vn=normalize(normalMatrix*normal);
    float front=smoothstep(-0.05,0.5,vn.z);                  // near/front faces only
    float near=smoothstep(0.45,0.0,distance(ndc,uPointer));  // close to the cursor
    float touch=near*front*uPointerAmt;
    float crease=snoise(sp*3.4+vec3(0.0,uTime*0.6,0.0));
    disp+=touch*(0.18+crease*0.14);                          // mostly shape, not glow
    vRidge=clamp((bulge+touch*0.18)*0.5+0.5,0.0,1.0);
    vec3 pos=sp+normal*disp;
    vec4 wp=modelMatrix*vec4(pos,1.0);
    vWorld=wp.xyz;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0);
  }`;

export function createGhostObject(opts: SceneOpts): SceneHandle {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(2.2, 5); // ~20k tris — crystalline facets, cheap

  const green = opts.accent.clone();
  const cyan = opts.accent2.clone();

  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uChurn: { value: 0.12 + opts.intensity * 0.04 }, // smooth, water-like, calm
    uExplode: { value: 0 },
    uGreen: { value: green },
    uCyan: { value: cyan },
    uPointer: { value: new THREE.Vector2(0, 0) },
    uPointerAmt: { value: 0 },
  };

  // With fewer triangles the additive sum is leaner, so the per-face contributions
  // are a touch stronger to keep the volumetric glass glow — but restrained, so it
  // stays clean over the black void instead of washing out.
  const frag = `
    precision highp float;
    uniform vec3 uGreen,uCyan; uniform float uProgress;
    varying vec3 vWorld; varying float vRidge;
    void main(){
      // ridges glow cyan, valleys dark green → flowing veins of light
      float b=pow(vRidge,1.6);
      vec3 col=mix(uGreen*0.10,uCyan,b);
      col+=uGreen*b*0.85;
      // flat per-face normal → crystalline facets + silhouette rim glow
      vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
      vec3 vd=normalize(cameraPosition-vWorld);
      float fres=pow(1.0-abs(dot(n,vd)),2.0);
      col+=uCyan*fres*0.55;
      float a=0.14+b*0.26+fres*0.16;
      gl_FragColor=vec4(col,a*(1.0-uProgress*0.7));
    }`;

  const shell = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  // Fine neon net riding the surface (displaced identically).
  const wire = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: `
        uniform vec3 uCyan,uGreen; uniform float uProgress; varying float vRidge;
        void main(){ gl_FragColor=vec4(mix(uGreen,uCyan,vRidge),0.10*(1.0-uProgress*0.7)); }`,
      wireframe: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  // The object (rotates/scales) lives in its own subgroup.
  const obj = new THREE.Group();
  obj.add(shell, wire);

  // Sparse starfield void — a few hundred drifting green points far behind the
  // object. Cheap (no per-pixel shader), and all the bright glow stays on the orb.
  const STAR_N = 340;
  const starPos = new Float32Array(STAR_N * 3);
  for (let i = 0; i < STAR_N; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 44;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 28;
    starPos[i * 3 + 2] = -7 - Math.random() * 12;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: green,
      size: 0.07,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(stars, obj);

  let modeBoost = 0;
  let modeTarget = 0;
  let spin = 0;
  let px = 0;
  let py = 0;
  let amt = 0; // mouse-crease strength, eased in/out smoothly

  return {
    group,
    setMode(mode: SceneMode) {
      modeTarget = mode === "climax" ? 1 : mode === "tense" ? 0.45 : 0;
    },
    update(dt, progress, _vel, pointer) {
      modeBoost += (modeTarget - modeBoost) * Math.min(1, dt * 2.5);
      uniforms.uTime.value += dt;
      uniforms.uProgress.value = progress;
      uniforms.uExplode.value += (modeBoost - uniforms.uExplode.value) * Math.min(1, dt * 3);

      // pointer eased for a smooth-following crease; strength eases in/out gently.
      px += (pointer.x - px) * 0.08;
      py += (pointer.y - py) * 0.08;
      uniforms.uPointer.value.set(px, py);
      amt += (0.8 - amt) * 0.05;
      uniforms.uPointerAmt.value = amt;

      // very slow auto-drift only (mouse no longer rotates — it creases instead)
      spin += dt * 0.03;
      obj.rotation.y = spin;
      obj.rotation.x = Math.sin(uniforms.uTime.value * 0.08) * 0.04;
      stars.rotation.y = spin * 0.15; // gentle parallax drift

      // sit center-right so the hero text (left) stays clear; calmer + smaller on scroll
      obj.position.x = 1.7;
      obj.scale.setScalar(1 - progress * 0.4);
    },
    dispose() {
      geo.dispose();
      starGeo.dispose();
    },
  };
}
