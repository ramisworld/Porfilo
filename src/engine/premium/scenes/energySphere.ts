import * as THREE from "three";
import type { SceneHandle, SceneMode, SceneOpts } from "../scene-types";

/**
 * energySphere — a large central icosphere displaced by 3D simplex noise in a
 * GLSL shader: a glowing molten "sun" with a triangulated wireframe shell over
 * it (the crazzy Director hero), or a slow watery orb when tuned soft. Scroll
 * raises the displacement + brightness; mouse adds parallax. Constantly warping.
 *
 * Tunables (caller may pass via opts; sensible defaults here):
 *   intensity → displacement amplitude + churn speed.
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

export function createEnergySphere(opts: SceneOpts): SceneHandle {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(2.2, 32);

  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uDisplace: { value: 0.35 + opts.intensity * 0.5 },
    uChurn: { value: 0.25 + opts.intensity * 0.35 },
    uColorA: { value: opts.accent.clone() },
    uColorB: { value: opts.accent2.clone() },
    uWire: { value: 0 },
  };

  const vert = `
    uniform float uTime,uProgress,uDisplace,uChurn;
    varying float vN; varying vec3 vNw; varying vec3 vView;
    ${SNOISE}
    void main(){
      float n=snoise(position*0.85+vec3(0.0,uTime*uChurn,uTime*0.15));
      float amp=uDisplace*(0.55+uProgress*0.9);
      vec3 disp=position+normal*n*amp;
      vN=n;
      vec4 wp=modelMatrix*vec4(disp,1.0);
      vNw=normalize(mat3(modelMatrix)*normal);
      vView=normalize(cameraPosition-wp.xyz);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(disp,1.0);
    }`;
  const frag = `
    uniform vec3 uColorA,uColorB; uniform float uProgress,uWire;
    varying float vN; varying vec3 vNw; varying vec3 vView;
    void main(){
      float fres=pow(1.0-max(dot(vNw,vView),0.0),2.2);
      // Darker troughs reveal the molten/triangulated texture (not a flat blob).
      float shade=0.32+0.68*clamp(vN*0.5+0.5,0.0,1.0);
      vec3 col=mix(uColorA,uColorB,clamp(vN*0.6+0.4,0.0,1.0))*shade;
      col+=fres*uColorB*0.5;
      col*=(0.78+uProgress*0.45);
      float a=mix(0.94,0.6,uWire);
      gl_FragColor=vec4(col,a);
    }`;

  const solid = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: true }),
  );
  const wireUniforms = { ...uniforms, uWire: { value: 1 } };
  const wire = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms: wireUniforms,
      vertexShader: vert,
      fragmentShader: frag,
      wireframe: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  wire.scale.setScalar(1.012);
  group.add(solid, wire);

  let modeBoost = 0;
  let modeTarget = 0;
  let prevHot = false;

  return {
    group,
    setMode(mode: SceneMode) {
      modeTarget = mode === "climax" ? 1 : mode === "tense" ? 0.4 : 0;
    },
    update(dt, progress, _vel, pointer) {
      modeBoost += (modeTarget - modeBoost) * Math.min(1, dt * 2.5);
      uniforms.uTime.value += dt;
      uniforms.uProgress.value = progress + modeBoost * 0.4;
      uniforms.uDisplace.value =
        0.35 + opts.intensity * 0.5 + modeBoost * 0.25;
      wireUniforms.uTime.value = uniforms.uTime.value;
      wireUniforms.uProgress.value = uniforms.uProgress.value;
      wireUniforms.uDisplace.value = uniforms.uDisplace.value;

      const hot = progress > 0.62;
      if (hot && !prevHot) opts.fx.flash(0.7);
      prevHot = hot;

      group.rotation.y += dt * (0.08 + modeBoost * 0.25);
      group.rotation.x += (pointer.y * 0.25 - group.rotation.x) * 0.04;
      group.rotation.z = Math.sin(uniforms.uTime.value * 0.1) * 0.1;
      group.position.x += (pointer.x * 0.5 - group.position.x) * 0.03;
    },
    dispose() {
      geo.dispose();
    },
  };
}
