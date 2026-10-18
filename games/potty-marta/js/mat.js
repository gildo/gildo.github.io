/* Materials: procedural fur, skin/cloth, hair, eyes. Patterns are computed from bind-pose model coordinates (aObj). */
(function(){
'use strict';
const PM = window.PM = window.PM || {};

PM.GLSL_NOISE = `
vec3 m289_3(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 m289_4(vec4 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 perm4(vec4 x){return m289_4(((x*34.0)+1.0)*x);}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
  i = m289_3(i);
  vec4 p = perm4(perm4(perm4(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

const C = c => new THREE.Color(c);

/* Fur. pattern: 0 brindle, 1 solid/shaded, 2 merle-ish soft. masks (aMask): x white, y grey/ticking, z black, w pink skin */
PM.furMaterial = function(o){
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0, sheen: 1, sheenRoughness: 0.55, sheenColor: C(o.sheen || '#8a7a6c') });
  const U = {
    uA: { value: C(o.a) }, uB: { value: C(o.b) }, uWhite: { value: C(o.white || '#f1ece4') }, uGrey: { value: C(o.grey || '#a9a39c') },
    uBlack: { value: C(o.black || '#151110') }, uPink: { value: C(o.pink || '#d99a96') }, uPattern: { value: o.pattern || 0 }, uScale: { value: o.scale || 1 }
  };
  m.userData.U = U;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aObj; attribute vec4 aMask; varying vec3 vObj; varying vec4 vMask;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = aObj; vMask = aMask;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vObj; varying vec4 vMask;
uniform vec3 uA, uB, uWhite, uGrey, uBlack, uPink; uniform float uPattern, uScale;
${PM.GLSL_NOISE}
vec3 furColor(){
  vec3 p = vObj * uScale;
  vec3 base;
  if (uPattern < 0.5){
    float s = snoise(p * vec3(110.0, 22.0, 90.0)) * 0.6 + snoise(p * vec3(260.0, 50.0, 220.0)) * 0.4;
    base = mix(uA, uB, smoothstep(-0.1, 0.6, s) * 0.75);
  } else {
    float s = snoise(p * 9.0) * 0.5 + 0.5;
    base = mix(uA, uB, s);
  }
  float fine = snoise(p * vec3(520.0, 1300.0, 520.0));
  float speck = smoothstep(0.35, 0.7, snoise(p * 330.0));
  base = mix(base, uGrey, vMask.y * (1.0 - vMask.x) * (0.25 + 0.55 * speck));
  vec3 wh = uWhite * (0.97 + 0.03 * fine);
  wh = mix(wh, uA * 1.4 + 0.08, vMask.y * vMask.x * smoothstep(0.55, 0.85, snoise(p * 260.0)) * 0.85);
  base = mix(base, wh, vMask.x);
  base = mix(base, uBlack, vMask.z);
  base = mix(base, uPink, vMask.w);
  base *= 0.92 + 0.12 * fine * (1.0 - vMask.w);
  return base;
}`).replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = furColor();')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.42, vMask.w);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec3 q = vObj * uScale * vec3(380.0, 900.0, 380.0);
  vec3 pn = vec3(snoise(q), snoise(q + 17.3), snoise(q + 41.7));
  normal = normalize(normal + pn * 0.06 * (1.0 - vMask.w) * (1.0 - 0.6 * vMask.x)); }`);
  };
  m.customProgramCacheKey = () => 'fur2';
  return m;
};

/* Leaf print texture for Marta's trousers (white palm/monstera line drawings on transparent). */
function leafPrint(){
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const R = PM.rng(61);
  g.strokeStyle = 'rgba(255,255,250,0.95)'; g.lineWidth = 3; g.lineCap = 'round';
  for (let n = 0; n < 14; n++){
    const x = R() * 512, y = R() * 512, a = R() * Math.PI * 2, kind = n % 2, s = 0.8 + R() * 0.4;
    for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]){
      g.save(); g.translate(x + ox, y + oy); g.rotate(a); g.scale(s, s);
      if (kind === 0){
        for (let i = 0; i < 13; i++){ const an = -Math.PI * 0.96 + i * Math.PI * 0.075; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an) * 34, Math.sin(an) * 34); g.stroke(); }
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 26); g.stroke();
      } else {
        g.beginPath(); g.ellipse(0, 0, 24, 30, 0, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.moveTo(0, 32); g.lineTo(0, -27); g.stroke();
        for (let i = -2; i <= 2; i++){ g.beginPath(); g.moveTo(0, i * 9); g.lineTo(-19, i * 9 - 6); g.moveTo(0, i * 9); g.lineTo(19, i * 9 - 6); g.stroke(); }
      }
      g.restore();
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
let printTex = null;

/* Human body: vertex colors + aMat (x roughness, y print, z cloth weave, w skin) */
PM.humanMaterial = function(){
  if (!printTex) printTex = leafPrint();
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7, sheen: 0.6, sheenRoughness: 0.6, sheenColor: C('#c9a08a') });
  const U = { uPrint: { value: printTex } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aObj; attribute vec4 aMat; varying vec3 vObj; varying vec3 vObjN; varying vec4 vMat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = aObj; vObjN = normal; vMat = aMat;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vObj; varying vec3 vObjN; varying vec4 vMat; uniform sampler2D uPrint;
${PM.GLSL_NOISE}`).replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 an = abs(normalize(vObjN)); an = pow(an, vec3(4.0)); an /= (an.x + an.y + an.z);
  float sc = 4.2;
  float pr = texture2D(uPrint, vObj.zy * sc).a * an.x + texture2D(uPrint, vObj.xz * sc).a * an.y + texture2D(uPrint, vObj.xy * sc).a * an.z;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.93, 0.88), pr * vMat.y);
  float weave = snoise(vObj * 900.0) * 0.5 + snoise(vObj * vec3(160.0, 40.0, 160.0)) * 0.5;
  diffuseColor.rgb *= 1.0 + weave * 0.06 * vMat.z;
  float sk = snoise(vObj * 140.0);
  diffuseColor.rgb *= 1.0 + sk * 0.025 * vMat.w;
}`).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vMat.x;');
  };
  m.customProgramCacheKey = () => 'human1';
  return m;
};

PM.hairMaterial = function(col){
  const m = new THREE.MeshPhysicalMaterial({ color: C(col || '#2a1912'), roughness: 0.58, sheen: 0.6, sheenRoughness: 0.45, sheenColor: C('#5a3e2c') });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aObj; varying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = aObj;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;\n' + PM.GLSL_NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 q = vObj; float a = atan(q.x, q.z + 0.02);
  float s = snoise(vec3(a * 60.0, q.y * 40.0, 0.0)) * 0.6 + snoise(vec3(a * 160.0, q.y * 90.0, 3.0)) * 0.4;
  diffuseColor.rgb *= 0.72 + 0.42 * (s * 0.5 + 0.5); }`);
  };
  m.customProgramCacheKey = () => 'hair1';
  return m;
};

const eyeTexCache = {};
PM.eyeMaterial = function(iris, human){
  const key = iris + (human ? 'h' : 'd');
  if (!eyeTexCache[key]){
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
    // rows: 0 = front pole
    const grd = g.createLinearGradient(0, 0, 0, 256);
    if (human){
      grd.addColorStop(0, '#050403'); grd.addColorStop(0.07, '#070504'); grd.addColorStop(0.09, iris); grd.addColorStop(0.2, iris); grd.addColorStop(0.225, '#1c110a'); grd.addColorStop(0.25, '#ece4dc'); grd.addColorStop(1, '#e6dad2');
    } else {
      grd.addColorStop(0, '#030202'); grd.addColorStop(0.16, '#050303'); grd.addColorStop(0.2, iris); grd.addColorStop(0.36, iris); grd.addColorStop(0.4, '#0d0806'); grd.addColorStop(0.5, '#e8ddd6'); grd.addColorStop(1, '#e0d2c8');
    }
    g.fillStyle = grd; g.fillRect(0, 0, 64, 256);
    const R = PM.rng(9); g.globalAlpha = 0.25;
    for (let i = 0; i < 160; i++){ g.fillStyle = R() < 0.5 ? '#000' : '#c58a4a'; const y = human ? 18 + R() * 20 : 34 + R() * 40; g.fillRect(R() * 64, y, 1 + R() * 2, 2 + R() * 4); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; eyeTexCache[key] = t;
  }
  return new THREE.MeshPhysicalMaterial({ map: eyeTexCache[key], roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.04 });
};
PM.eyeGeometry = function(r){ const g = new THREE.SphereGeometry(r, 24, 18); g.rotateX(Math.PI / 2); return g; };

PM.glossy = (c, r) => new THREE.MeshPhysicalMaterial({ color: C(c), roughness: r == null ? 0.35 : r, clearcoat: 0.6, clearcoatRoughness: 0.25 });
})();
