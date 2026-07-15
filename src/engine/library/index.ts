import "server-only";

/**
 * Component Library — Phase 1 (author-agent resources).
 *
 * The author agent writes a *self-contained* HTML document and inlines what it
 * needs. This library is the vocabulary it composes from: a design-token system,
 * a set of vetted interactive components (backgrounds, cursor, boot, effects),
 * and section/layout patterns. It is injected (cached) into the author prompt.
 *
 * These are OUR OWN implementations (reactbits-inspired, not copied). They are
 * reference snippets the agent adapts — recolor, retune, restructure — never a
 * fixed template. Grow this file to widen the agent's range.
 */

// ── Design system: tokens, reset, responsiveness, motion ────────────────────
const DESIGN_SYSTEM = `## DESIGN SYSTEM (always apply)
Author a COMPLETE, self-contained HTML document: <!doctype html><html><head>… (title, one <style>) …</head><body>… content + one <script> …</body></html>. No external requests (no CDN fonts/scripts/images) — inline everything; use system font stacks and CSS/canvas/WebGL for visuals.

Tokens — define CSS custom properties on :root and theme through them (never hardcode a color twice):
  --bg --surface --fg --muted --faint --border --accent --accent2 --ease
Fonts (system, no webfonts):
  sans: -apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Helvetica,Arial,sans-serif
  serif: Charter,"Iowan Old Style","Palatino Linotype",Georgia,serif
  mono: ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace
Type: one fluid scale with clamp(); headings text-wrap:balance; body ~1.5–1.65 line-height; label/eyebrow uppercase + letter-spacing.
Layout: flex/grid + gap (not per-element margins); a max-width content column; generous whitespace.
Required on every page: fully responsive (test ≤390px, no horizontal scroll), a visible :focus-visible state, and a prefers-reduced-motion path that stills animation (static frame). Cap WebGL DPR at 1.5 and pause rAF when document.hidden.`;

// ── Interactive backgrounds (canvas / WebGL; drop into a <script>) ───────────
const BG_AURORA = `### background: aurora (WebGL2) — soft premium gradient ribbons. Calm.
Container: a full-bleed <canvas id="bg">. Recolor uStops to the theme.
const gl=document.getElementById('bg').getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:true});
const VERT='#version 300 es\\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG=\`#version 300 es
precision highp float;uniform float uT,uA,uB;uniform vec2 uR;uniform vec3 uS[3];out vec4 o;
vec3 pm(vec3 x){return mod(((x*34.)+1.)*x,289.);}
float sn(vec2 v){const vec4 C=vec4(.211324865,.366025403,-.577350269,.024390243);vec2 i=floor(v+dot(v,C.yy)),x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1,0):vec2(0,1);vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.);vec3 p=pm(pm(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;vec3 x=2.*fract(p*C.www)-1.,h=abs(x)-.5,ox=floor(x+.5),a0=x-ox;m*=1.79284291-0.85373472*(a0*a0+h*h);vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(m,g);}
void main(){vec2 uv=gl_FragCoord.xy/uR;vec3 r=uv.x<.5?mix(uS[0],uS[1],uv.x/.5):mix(uS[1],uS[2],(uv.x-.5)/.5);float h=exp(sn(vec2(uv.x*2.+uT*.1,uT*.25))*.5*uA);h=uv.y*2.-h+.2;float I=.6*h,a=smoothstep(.2-uB*.5,.2+uB*.5,I);o=vec4(I*r*a,a);}\`;
function sh(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o;}
const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VERT));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(pr);gl.useProgram(pr);
const bf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const lp=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(lp);gl.vertexAttribPointer(lp,2,gl.FLOAT,false,0,0);
gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);const U=n=>gl.getUniformLocation(pr,n);
const hex=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
gl.uniform3fv(U('uS'),new Float32Array([...hex('#6c7bff'),...hex('#9a6cff'),...hex('#4080ff')]));gl.uniform1f(U('uA'),1.1);gl.uniform1f(U('uB'),.55);
const bc=document.getElementById('bg');function rs(){const d=Math.min(devicePixelRatio||1,1.5);bc.width=innerWidth*d;bc.height=innerHeight*d;gl.viewport(0,0,bc.width,bc.height);gl.uniform2f(U('uR'),bc.width,bc.height);}addEventListener('resize',rs);rs();
(function f(t){requestAnimationFrame(f);if(document.hidden)return;gl.uniform1f(U('uT'),t*.0007);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);})(0);`;

const BG_LIQUID = `### background: liquid chrome (WebGL2) — glossy iridescent metaballs. Bold, premium "liquid glass".
Container: full-bleed <canvas id="bg">. Great for dark/glass vibes. Tune blob colors (steel→indigo→violet) to theme.
const gl=document.getElementById('bg').getContext('webgl2',{alpha:true,antialias:true});
const VERT='#version 300 es\\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG=\`#version 300 es
precision highp float;uniform float uT;uniform vec2 uR;out vec4 o;
void main(){vec2 uv=(gl_FragCoord.xy-.5*uR)/uR.y;float t=uT,f=0.;vec2 gr=vec2(0.);
for(int i=0;i<6;i++){float fi=float(i);vec2 c=.62*vec2(sin(t*(.28+.06*fi)+fi*1.7),cos(t*(.23+.05*fi)+fi*2.3));float r=.11+.05*sin(t*.5+fi);vec2 d=uv-c;float d2=dot(d,d)+4e-4;f+=r*r/d2;gr+=-2.*r*r*d/(d2*d2);}
float surf=smoothstep(.75,1.7,f);vec3 col=mix(vec3(.09,.11,.19),vec3(.30,.34,.85),smoothstep(.6,1.2,f));col=mix(col,vec3(.63,.43,.96),smoothstep(1.3,2.6,f));
vec2 n=normalize(gr+1e-5);float ir=.5+.5*sin(f*3.+n.x*3.+n.y*2.);col=mix(col,mix(vec3(.25,.7,.95),vec3(.7,.5,1.),ir),surf*.35);
float rim=exp(-abs(f-1.)*3.2);col+=vec3(.55,.62,1.)*rim*.5;col+=vec3(.85,.9,1.)*smoothstep(3.4,7.,f)*.32;col*=.55+.45*surf;o=vec4(col,1.);}\`;
function sh(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o;}
const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VERT));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(pr);gl.useProgram(pr);
const bf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const lp=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(lp);gl.vertexAttribPointer(lp,2,gl.FLOAT,false,0,0);
const U=n=>gl.getUniformLocation(pr,n),bc=document.getElementById('bg');function rs(){const d=Math.min(devicePixelRatio||1,1.5);bc.width=innerWidth*d;bc.height=innerHeight*d;gl.viewport(0,0,bc.width,bc.height);gl.uniform2f(U('uR'),bc.width,bc.height);}addEventListener('resize',rs);rs();
(function f(t){requestAnimationFrame(f);if(document.hidden)return;gl.uniform1f(U('uT'),t*.001);gl.drawArrays(gl.TRIANGLES,0,3);})(0);`;

const BG_MATRIX = `### background: matrix / code rain (Canvas2D) — terminal/hacker atmosphere.
Container: full-bleed <canvas id="bg">. Set CSS opacity ~.14 behind content. Recolor to accent.
const c=document.getElementById('bg'),x=c.getContext('2d');let w,h,cols,y;const F=15,ch="01<>{}[]#/$*+=".split('');
function rs(){const d=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;c.width=w*d;c.height=h*d;x.setTransform(d,0,0,d,0,0);cols=Math.ceil(w/F);y=Array(cols).fill(0).map(()=>Math.random()*-40);}rs();addEventListener('resize',rs);
(function draw(){requestAnimationFrame(draw);if(document.hidden)return;x.fillStyle='rgba(2,6,4,0.09)';x.fillRect(0,0,w,h);x.font=F+'px monospace';for(let i=0;i<cols;i++){x.fillStyle=Math.random()<.03?'#8dffc4':'#1c7a51';x.fillText(ch[Math.random()*ch.length|0],i*F,y[i]*F);if(y[i]*F>h&&Math.random()>.975)y[i]=0;y[i]+=.6;}})();`;

const BG_CONSTELLATION = `### background: particle constellation (Canvas2D) — drifting nodes linked near the cursor. Techy, "network of your work".
Container: full-bleed <canvas id="bg">. Recolor link/node rgb to theme.
const c=document.getElementById('bg'),x=c.getContext('2d');let w,h,pts=[];const L=132,LS=L*L,CR=190,CS=CR*CR,ptr={x:-9,y:-9};
addEventListener('pointermove',e=>{ptr.x=e.clientX;ptr.y=e.clientY;});
function build(){const d=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;c.width=w*d;c.height=h*d;x.setTransform(d,0,0,d,0,0);const n=Math.min(120,(w*h/15000)|0);pts=Array.from({length:n},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.28,vy:(Math.random()-.5)*.28}));}build();addEventListener('resize',build);
(function draw(){requestAnimationFrame(draw);if(document.hidden)return;x.clearRect(0,0,w,h);for(const p of pts){p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x+=w;else if(p.x>w)p.x-=w;if(p.y<0)p.y+=h;else if(p.y>h)p.y-=h;}for(let i=0;i<pts.length;i++){const a=pts[i];for(let j=i+1;j<pts.length;j++){const b=pts[j],dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy;if(d2<LS){x.strokeStyle='rgba(108,123,255,'+((1-d2/LS)*.16).toFixed(3)+')';x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke();}}const cx=a.x-ptr.x,cy=a.y-ptr.y,c2=cx*cx+cy*cy;if(c2<CS){x.strokeStyle='rgba(154,108,255,'+((1-c2/CS)*.5).toFixed(3)+')';x.beginPath();x.moveTo(a.x,a.y);x.lineTo(ptr.x,ptr.y);x.stroke();}x.fillStyle='rgba(255,255,255,.5)';x.beginPath();x.arc(a.x,a.y,1.2,0,6.283);x.fill();}})();`;

// ── Cursor, boot, effects ────────────────────────────────────────────────────
const FX_CURSOR = `### effect: spotlight cursor — a soft light that follows the pointer via CSS var.
CSS: body{--mx:50%;--my:50%} .spot{position:fixed;inset:0;pointer-events:none;z-index:1;background:radial-gradient(320px circle at var(--mx) var(--my),color-mix(in srgb,var(--accent) 22%,transparent),transparent 60%)}
JS: addEventListener('pointermove',e=>{document.body.style.setProperty('--mx',e.clientX+'px');document.body.style.setProperty('--my',e.clientY+'px');});`;

const FX_BOOT = `### effect: boot / loading screen — a brief typed boot sequence that fades to reveal the page. Good for terminal/OS/cyber vibes.
Overlay a fixed <div id="boot"> with mono lines; append lines on a timer, then fade it out (opacity→0, remove) after ~1.2s. Skip entirely under prefers-reduced-motion. Example lines: "booting <name>.sys", "loading modules [OK]", "mounting profile", "ready".`;

const FX_GLASS = `### effect: glass surface — frosted premium card.
CSS: background:color-mix(in srgb,var(--surface) 100%,transparent);backdrop-filter:blur(24px) saturate(1.2);border:1px solid var(--border);border-radius:16px;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 30px 60px -20px rgba(0,0,0,.6); Add a rotating conic glow-ring via @property --a{syntax:"<angle>";inherits:false;initial-value:0deg} + a masked conic-gradient ::before if the vibe wants extra shine.`;

const FX_CRT = `### effect: CRT / scanlines — retro terminal texture. Two fixed overlays (pointer-events:none):
scanlines: background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.28) 3px,transparent 4px);
vignette: background:radial-gradient(120% 120% at 50% 50%,transparent 55%,rgba(0,0,0,.65)); Optional faint flicker via a low-opacity animated layer. Chromatic aberration on a banner: text-shadow:1.5px 0 #ff4fa3,-1.5px 0 #39d3e6.`;

const FX_REVEAL = `### effect: scroll reveal — fade/rise sections on scroll (IntersectionObserver).
CSS: .rev{opacity:0;transform:translateY(18px)} .rev.in{opacity:1;transform:none;transition:opacity .8s var(--ease),transform .8s var(--ease)} @media(prefers-reduced-motion:reduce){.rev{opacity:1;transform:none}}
JS: const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.12,rootMargin:'0px 0px -8% 0px'});document.querySelectorAll('.rev').forEach(el=>io.observe(el));`;

const FX_TYPEWRITER = `### effect: typewriter / rotating word — animate a headline noun through a list (e.g. portfolio / résumé / story). Vertical slide + fade, ~2.2s interval; under reduced-motion show the first word statically.`;

// ── Section / layout patterns (the coherence layer) ──────────────────────────
const SECTIONS = `## SECTION & LAYOUT PATTERNS (compose these into a coherent page — don't just stack effects)
A portfolio is a coherent SITE, not a pile of visuals. Choose an overall structure that fits the vibe, then fill these roles with the person's real data:
- NAV / chrome — wordmark + a few links (or a menu bar / dock / command palette per vibe).
- HERO — name, role, one-line headline (from DATA.identity), a primary action; the signature moment of the chosen world.
- WORK — the projects (DATA.projects: name, blurb, tech, stars, repoUrl, demoUrl). A grid of cards, a list of numbered entries, files/apps, or ls output — whatever the world implies. Link each to repoUrl.
- SKILLS/STACK — DATA.languages (label + share%) as a bar/legend/ascii chart; optionally DATA.stack chips.
- ABOUT — a short grounded paragraph from the headline + projects.
- CONTACT — DATA.identity.links (github/site/x/email) as clear affordances.
Rules: every project links to its repoUrl; never invent metrics or employers; keep copy specific (reuse DATA blurbs). Make the composition feel intentional for the vibe — an OS vibe → windows+dock; editorial → masthead+columns; terminal → prompt+commands; minimal → whitespace+type.`;

// ── Catalog (short index the agent scans first) ──────────────────────────────
const CATALOG = `## COMPONENT CATALOG (pick what fits the vibe; full source below)
backgrounds: aurora (calm gradient) · liquid-chrome (bold glossy metaballs / "liquid glass") · matrix (terminal rain) · constellation (cursor-linked network)
effects: spotlight-cursor · boot-screen · glass-surface · crt-scanlines · scroll-reveal · typewriter
sections: nav · hero · work · skills · about · contact (see patterns)
You are NOT limited to these — invent structure the vibe calls for (OS desktop, magazine, arcade, etc.) and hand-write anything missing. These vetted snippets exist so you don't reinvent the hard interactive parts; adapt (recolor/retune) rather than paste verbatim.`;

/** The full library text injected (and prompt-cached) into the author system prompt. */
export const LIBRARY_PROMPT = [
  DESIGN_SYSTEM,
  CATALOG,
  "## COMPONENT SOURCE (adapt to the vibe & theme)",
  BG_AURORA,
  BG_LIQUID,
  BG_MATRIX,
  BG_CONSTELLATION,
  FX_CURSOR,
  FX_BOOT,
  FX_GLASS,
  FX_CRT,
  FX_REVEAL,
  FX_TYPEWRITER,
  SECTIONS,
].join("\n\n");
