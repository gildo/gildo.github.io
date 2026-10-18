/* Parco Vetra, Milano: lawns, trees, paths, dog area, fountain; San Lorenzo, Sant'Eustorgio and Milanese palazzi around. */
(function(){
'use strict';
const PM = window.PM = window.PM || {};
const V3 = THREE.Vector3, TAU = Math.PI * 2;
const C = c => new THREE.Color(c);

/* ---------- Layout (metres; north = -z) ---------- */
const PARK = { x0: -46, x1: 46, z0: -33, z1: 33 };
const DOG = { x0: 13, x1: 34, z0: -24, z1: -8, gate: { x: 13, z: -16, w: 1.6 } };
const PLAY = { x0: -34, x1: -20, z0: 9, z1: 22 };
const COURT = { x0: -34, x1: -19, z0: -25, z1: -12 };
const FOUNT = { x: 5, z: 3 };
const ENTR = { x: 0, z: 33 };
const LOOP = { x0: -36, x1: 38, z0: -27, z1: 27, r: 9 };
const MARTA_SPOTS = [];
/* The walk from Piazza Mondadori 2 (Santa Sofia) to Parco Vetra, compressed: piazza -> via Santa Sofia -> crossing Corso Italia ->
   Parco delle Basiliche (Sant'Eustorgio side) -> crossing via Molino delle Armi -> Parco Vetra south gate. */
const ROADS = {
  molino: { x0: -130, x1: 130, z0: 40.2, z1: 48 },
  italia: { x0: 0, x1: 12, z0: 48, z1: 330 },
  sofia: { x0: 12, x1: 200, z0: 172, z1: 180 },
  vetraN: { x0: -130, x1: 130, z0: -42, z1: -36 },
  ticinese: { x0: -56, x1: -49, z0: -120, z1: 40.2 },
  eastSt: { x0: 52, x1: 58, z0: -120, z1: 40.2 }
};
const WALK = [
  { x0: -45, x1: 45, z0: -32, z1: 32 },
  { x0: -1.7, x1: 1.7, z0: 31, z1: 36.5 },
  { x0: -14, x1: 14, z0: 35.5, z1: 40.3 },
  { x0: -1.8, x1: 1.8, z0: 40, z1: 48.3, cross: 'molino' },
  { x0: -40, x1: 14, z0: 48, z1: 51.8 },
  { x0: -40, x1: -1.2, z0: 51.4, z1: 162 },
  { x0: -3.6, x1: 0, z0: 48, z1: 172.5 },
  { x0: -0.2, x1: 12.2, z0: 168.4, z1: 171.6, cross: 'italia' },
  { x0: 12, x1: 104, z0: 166.6, z1: 172 },
  { x0: 84, x1: 104, z0: 151.5, z1: 172 }
];
const BASIL = { x0: -40, x1: -1.2, z0: 51.4, z1: 162 };
const MONDADORI = { x0: 84, x1: 104, z0: 151.5, z1: 166.6, door: { x: 94, z: 151.6 } };
const ROUTE_WP = [
  { x: 13, z: 169.6, name: 'via Santa Sofia' }, { x: -1.6, z: 169.6, name: 'Corso Italia' }, { x: -6, z: 120, name: 'Parco delle Basiliche' },
  { x: -1.8, z: 50.2, name: 'Parco delle Basiliche' }, { x: 0, z: 38.6, name: 'via Molino delle Armi' }, { x: 0, z: 30, name: 'Parco Vetra' }
];
PM.LAYOUT = { PARK, DOG, PLAY, COURT, FOUNT, ENTR, LOOP, ROADS, WALK, BASIL, MONDADORI, ROUTE_WP };

function roundedRectPts(L, n){
  const pts = []; const r = L.r;
  const corners = [[L.x1 - r, L.z0 + r, -Math.PI / 2], [L.x1 - r, L.z1 - r, 0], [L.x0 + r, L.z1 - r, Math.PI / 2], [L.x0 + r, L.z0 + r, Math.PI]];
  for (const [cx, cz, a0] of corners) for (let i = 0; i <= n; i++){ const a = a0 + i / n * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  pts.push(pts[0]); return pts;
}
const PATHS = [
  { pts: roundedRectPts(LOOP, 8), w: 3.4 },
  { pts: [[0, 40], [0, 27], [2, 12], [5, 3], [3, -8], [-6, -20], [-12, -27], [-14, -40]], w: 3.0 },
  { pts: [[5, 3], [10, -8], [13, -16]], w: 2.6 },
  { pts: [[38, 2], [52, 2]], w: 3.0 },
  { pts: [[-36, 0], [-14, 6], [5, 3]], w: 2.4 },
  { pts: [[-36, -18], [-52, -18]], w: 2.6 },
  { pts: [[-1.5, 160], [-8, 140], [-18, 118], [-22, 96], [-12, 72], [-4, 56], [-2, 51]], w: 3.0 },
  { pts: [[-22, 96], [-38, 92]], w: 2.4 }
];
PM.PATHS = PATHS;

/* ---------- Splat map: r gravel, g dirt, b asphalt/stone, a lawn ---------- */
const SPL = { x0: -120, z0: -110, size: 330, res: 2048 };
function buildSplat(){
  const N = SPL.res, k = N / SPL.size;
  const X = x => (x - SPL.x0) * k, Z = z => (z - SPL.z0) * k;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return [c, c.getContext('2d')]; };
  const [c, g] = mk(), [cl, gl] = mk();
  const rect = (G, r, style) => { G.fillStyle = style; G.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k); };
  g.fillStyle = 'rgb(0,0,255)'; g.fillRect(0, 0, N, N); // paving everywhere
  for (const r of Object.values(ROADS)) rect(g, r, 'rgb(0,0,0)'); // asphalt roads
  gl.fillStyle = '#000'; gl.fillRect(0, 0, N, N);
  rect(gl, { x0: PARK.x0 - 1.5, x1: PARK.x1 + 1.5, z0: PARK.z0 - 1.5, z1: PARK.z1 + 1.5 }, '#fff');
  rect(gl, BASIL, '#fff');
  const lineW = (G, pts, w, style) => { G.strokeStyle = style; G.lineWidth = w * k; G.lineCap = 'round'; G.lineJoin = 'round'; G.beginPath(); pts.forEach((p, i) => i ? G.lineTo(X(p[0]), Z(p[1])) : G.moveTo(X(p[0]), Z(p[1]))); G.stroke(); };
  for (const P of PATHS){ lineW(g, P.pts, P.w, 'rgb(255,0,0)'); lineW(gl, P.pts, P.w, '#000'); }
  g.fillStyle = 'rgb(255,0,0)'; g.beginPath(); g.arc(X(5), Z(3), 6.5 * k, 0, TAU); g.fill(); gl.fillStyle = '#000'; gl.beginPath(); gl.arc(X(5), Z(3), 6.5 * k, 0, TAU); gl.fill();
  rect(g, DOG, 'rgb(0,255,0)'); rect(gl, DOG, '#000');
  rect(g, PLAY, 'rgb(200,150,0)'); rect(gl, PLAY, '#000');
  rect(g, COURT, 'rgb(0,0,255)'); rect(gl, COURT, '#000');
  const R = PM.rng(5);
  for (let i = 0; i < 26; i++){ const x = DOG.x0 + R() * (DOG.x1 - DOG.x0), z = DOG.z0 + R() * (DOG.z1 - DOG.z0); gl.fillStyle = 'rgba(255,255,255,0.45)'; gl.beginPath(); gl.arc(X(x), Z(z), (0.6 + R() * 1.4) * k, 0, TAU); gl.fill(); }
  // Piazza Mondadori: paving with two lawn beds and tree pits; Santa Sofia sidewalk tree pits
  for (const [x, z, w, h] of [[86, 154, 6, 5], [97, 154, 6, 5]]){ rect(gl, { x0: x, x1: x + w, z0: z, z1: z + h }, '#fff'); rect(g, { x0: x, x1: x + w, z0: z, z1: z + h }, 'rgb(0,0,0)'); }
  for (let x = 18; x < 84; x += 9){ rect(g, { x0: x - 0.7, x1: x + 0.7, z0: 170.6, z1: 171.9 }, 'rgb(0,255,0)'); }
  const sd = g.getImageData(0, 0, N, N), ld = gl.getImageData(0, 0, N, N).data, d = sd.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = Math.max(1, ld[i]);
  g.putImageData(sd, 0, 0);
  const [c2, g2] = mk(); g2.filter = 'blur(1.1px)'; g2.drawImage(c, 0, 0);
  const data = g2.getImageData(0, 0, N, N).data;
  const tex = new THREE.CanvasTexture(c2); tex.flipY = false; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  return { tex, data };
}

const GLSL = PM.GLSL_NOISE;

PM.buildWorld = function(scene, opt){
  opt = opt || {};
  const W = { colliders: { circles: [], boxes: [], segs: [] }, scent: [], benches: [], updaters: [], lamps: [], pigeons: [], props: {} };
  const splat = buildSplat(); W.splat = splat;
  W.surface = function(x, z){ // returns {lawn, gravel, dirt, stone}
    const u = Math.floor((x - SPL.x0) / SPL.size * SPL.res), v = Math.floor((z - SPL.z0) / SPL.size * SPL.res);
    if (u < 0 || v < 0 || u >= SPL.res || v >= SPL.res) return { lawn: 0, gravel: 0, dirt: 0, stone: 1 };
    const i = (v * SPL.res + u) * 4, d = splat.data; return { gravel: d[i] / 255, dirt: d[i + 1] / 255, stone: d[i + 2] / 255, lawn: d[i + 3] / 255 };
  };
  W.getH = () => 0;
  const U = { uTime: { value: 0 }, uSplat: { value: splat.tex }, uSplatRect: { value: new THREE.Vector4(SPL.x0, SPL.z0, SPL.size, SPL.size) }, uCam: { value: new V3() }, uPush: { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] } };
  W.U = U;

  /* ----- Ground ----- */
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  groundMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vW; uniform sampler2D uSplat; uniform vec4 uSplatRect;
${GLSL}`).replace('#include <color_fragment>', `#include <color_fragment>
{
  vec2 suv = (vW.xz - uSplatRect.xy) / uSplatRect.zw;
  vec4 sp = texture2D(uSplat, suv);
  float n1 = snoise(vec3(vW.xz * 0.08, 0.0)), n2 = snoise(vec3(vW.xz * 0.6, 3.0)), n3 = snoise(vec3(vW.xz * 7.0, 9.0));
  vec3 grass = mix(vec3(0.17, 0.28, 0.08), vec3(0.25, 0.37, 0.11), 0.5 + 0.5 * n1);
  grass = mix(grass, vec3(0.36, 0.4, 0.16), smoothstep(0.4, 0.9, n2) * 0.35);
  grass *= 0.85 + 0.15 * n3;
  vec3 gravel = vec3(0.5, 0.46, 0.39) * (0.86 + 0.14 * n3) * (0.95 + 0.05 * n2);
  float peb = smoothstep(0.55, 0.8, snoise(vec3(vW.xz * 22.0, 1.0)));
  gravel = mix(gravel, vec3(0.5, 0.46, 0.4), peb * 0.5);
  vec3 dirt = mix(vec3(0.42, 0.33, 0.24), vec3(0.5, 0.41, 0.3), 0.5 + 0.5 * n2) * (0.9 + 0.1 * n3);
  vec3 stone = vec3(0.47, 0.47, 0.48) * (0.9 + 0.08 * n3);
  float tile = step(0.94, fract(vW.x * 0.5)) + step(0.94, fract(vW.z * 0.5));
  stone *= 1.0 - 0.12 * clamp(tile, 0.0, 1.0);
  vec3 asphalt = vec3(0.2, 0.2, 0.21) * (0.85 + 0.15 * n3) * (0.96 + 0.04 * n2);
  float wa = clamp(1.0 - sp.r - sp.g - sp.b, 0.0, 1.0);
  float tot = sp.r + sp.g + sp.b + wa + 0.0001;
  vec3 col = (gravel * sp.r + dirt * sp.g + stone * sp.b + asphalt * wa) / tot;
  float lawn = sp.a;
  diffuseColor.rgb = mix(col, grass, lawn);
}`);
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  /* ----- Grass blades (instanced clumps wrapped around the camera) ----- */
  (function(){
    const blade = new THREE.BufferGeometry();
    const pos = [], hh = [];
    const R = PM.rng(77);
    for (let b = 0; b < 3; b++){
      const ox = (R() - 0.5) * 0.08, oz = (R() - 0.5) * 0.08, a = R() * TAU, w = 0.012 + R() * 0.008, lean = (R() - 0.5) * 0.3;
      const ca = Math.cos(a), sa = Math.sin(a);
      const seg = [[-w, 0], [w, 0], [-w * 0.7, 0.45], [w * 0.7, 0.45], [0, 1]];
      const base = pos.length / 3;
      for (const [sx, sy] of seg){ const lx = sx, lz = lean * sy * sy * 0.15; pos.push(ox + lx * ca - lz * sa, sy, oz + lx * sa + lz * ca); hh.push(sy); }
      blade.userData.tris = (blade.userData.tris || []).concat([base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4]);
    }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    blade.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((v, i) => i % 3 === 1 ? 1 : 0), 3));
    blade.setIndex(blade.userData.tris);
    const ig = new THREE.InstancedBufferGeometry(); ig.index = blade.index; ig.attributes.position = blade.attributes.position; ig.attributes.normal = blade.attributes.normal;
    const N = opt.lowGrass ? 32000 : 80000, T = opt.lowGrass ? 28 : 36;
    const off = new Float32Array(N * 4);
    for (let i = 0; i < N; i++){ off[i * 4] = R() * T; off[i * 4 + 1] = R() * T; off[i * 4 + 2] = R() * TAU; off[i * 4 + 3] = 0.7 + R() * 0.6; }
    ig.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    ig.instanceCount = N;
    const gm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
    gm.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U); sh.uniforms.uTile = { value: T };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec4 aOff; uniform float uTime, uTile; uniform vec3 uCam; uniform sampler2D uSplat; uniform vec4 uSplatRect; uniform vec4 uPush[4];
varying vec3 vGC;`).replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace('#include <begin_vertex>', `
vec2 wp = aOff.xy - uCam.xz; wp = mod(wp + uTile * 0.5, uTile) - uTile * 0.5; wp += uCam.xz;
vec2 suv = (wp - uSplatRect.xy) / uSplatRect.zw;
float lawn = texture2D(uSplat, suv).a;
lawn = smoothstep(0.55, 0.9, lawn);
float dist = length(wp - uCam.xz);
float fade = 1.0 - smoothstep(uTile * 0.32, uTile * 0.48, dist);
float hgt = position.y;
float sc = aOff.w * lawn * fade;
float ca = cos(aOff.z), sa = sin(aOff.z);
vec3 transformed = vec3(position.x * ca - position.z * sa, 0.0, position.x * sa + position.z * ca) * (0.6 + 0.4 * sc);
transformed.y = hgt * 0.095 * sc;
float wind = sin(uTime * 1.6 + wp.x * 0.35 + wp.y * 0.22) * 0.5 + sin(uTime * 3.1 + wp.x * 1.3) * 0.2;
transformed.x += wind * 0.035 * hgt * hgt * sc; transformed.z += wind * 0.015 * hgt * hgt * sc;
for (int i = 0; i < 4; i++){ vec2 d = wp - uPush[i].xy; float l = length(d); float f = clamp(1.0 - l / max(uPush[i].z, 0.001), 0.0, 1.0) * step(0.001, uPush[i].z); transformed.xz += (d / max(l, 0.001)) * f * hgt * 0.09; transformed.y *= 1.0 - f * 0.45; }
transformed.xz += wp;
float hv = fract(sin(dot(aOff.xy, vec2(12.9898, 78.233))) * 43758.5453);
vGC = mix(vec3(0.17, 0.27, 0.08), mix(vec3(0.3, 0.44, 0.13), vec3(0.4, 0.47, 0.17), hv * 0.6), hgt);`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGC;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vGC;');
    };
    const grass = new THREE.Mesh(ig, gm); grass.frustumCulled = false; grass.receiveShadow = true; scene.add(grass);
    W.grass = grass;
  })();

  /* ----- Textures ----- */
  function canvasTex(w, h, draw, rep){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; if (rep){ t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
  const R = PM.rng(123);
  const leafTex = (pal, kind) => canvasTex(256, 256, (g, w, h) => {
    const r = PM.rng(kind === 'pine' ? 9 : kind === 'maple' ? 31 : 17);
    if (kind === 'pine'){
      for (let i = 0; i < 160; i++){ const x = 128 + (r() - 0.5) * 210, y = 128 + (r() - 0.5) * 180; const a = r() * TAU; g.strokeStyle = pal[(r() * pal.length) | 0]; g.lineWidth = 2; for (let k = 0; k < 6; k++){ const b = a + (k - 3) * 0.12; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(b) * 26, y + Math.sin(b) * 26); g.stroke(); } }
      return;
    }
    for (let i = 0; i < 70; i++){
      const x = 128 + (r() - 0.5) * 200, y = 128 + (r() - 0.5) * 200; if (Math.hypot(x - 128, y - 128) > 115) continue;
      const s = 14 + r() * 12, a = r() * TAU;
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = pal[(r() * pal.length) | 0];
      g.beginPath();
      const lobes = kind === 'maple' ? 5 : 5;
      for (let k = 0; k <= lobes * 2; k++){ const ang = -Math.PI / 2 + k / (lobes * 2) * TAU; const rr = s * (k % 2 ? 0.48 : 1) * (kind === 'plane' ? 1 : 0.95); g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr * 0.9); }
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, s * 0.6); g.lineTo(0, -s * 0.8); g.stroke();
      g.restore();
    }
  });
  const leafPlane = leafTex(['#5c7d2e', '#6b8c35', '#4f6e28', '#7a9440', '#86a04a', '#3f5c22'], 'plane');
  const leafMaple = leafTex(['#3f6a28', '#4d7a2f', '#5c8a37', '#6f9a40', '#9a9a3a', '#b38a33'], 'maple');
  const leafPine = leafTex(['#1f3a1e', '#2a4a26', '#33552b', '#264222'], 'pine');
  const barkPlane = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#b8b39a'; g.fillRect(0, 0, w, h);
    const r = PM.rng(41);
    for (let i = 0; i < 90; i++){ g.fillStyle = ['#8f8f6e', '#d6d1b8', '#a29b78', '#7a7b5e', '#cfc7a3'][(r() * 5) | 0]; g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 30, 14 + r() * 40, r() * 3, 0, TAU); g.fill(); }
  }, true);
  const barkDark = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#4a3a2c'; g.fillRect(0, 0, w, h); const r = PM.rng(43);
    for (let i = 0; i < 120; i++){ g.strokeStyle = r() < 0.5 ? '#2e241b' : '#5f4c3a'; g.lineWidth = 1 + r() * 3; const x = r() * w; g.beginPath(); g.moveTo(x, r() * h); g.lineTo(x + (r() - 0.5) * 6, r() * h); g.stroke(); }
  }, true);

  /* ----- Trees ----- */
  const trunkGeos = { plane: [], dark: [] };
  const leafInst = { plane: [], maple: [], pine: [] };
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new V3(), tmpP = new V3();
  function branch(list, a, b, r0, r1){
    const d = new V3().subVectors(b, a), L = d.length();
    const g = new THREE.CylinderGeometry(r1, r0, L, 7, 1, true);
    g.translate(0, L / 2, 0);
    tmpQ.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
    g.applyMatrix4(tmpM.compose(a, tmpQ, tmpS.set(1, 1, 1)));
    list.push(g);
  }
  function tree(x, z, kind, scale){
    const s = scale || 1, rr = PM.rng((x * 1000 + z * 17) | 0);
    const trunkList = kind === 'plane' ? trunkGeos.plane : trunkGeos.dark;
    const leaves = leafInst[kind === 'pine' ? 'pine' : (kind === 'maple' || kind === 'elm') ? 'maple' : 'plane'];
    if (kind === 'pine'){
      const H = (9 + rr() * 4) * s, lean = new V3((rr() - 0.5) * 1.2, 0, (rr() - 0.5) * 1.2);
      const top = new V3(x, H, z).add(lean);
      branch(trunkList, new V3(x, 0, z), top, 0.32 * s, 0.14 * s);
      for (let i = 0; i < 7; i++){
        const a = rr() * TAU, l = (2 + rr() * 2.5) * s, y = H - rr() * 3 * s;
        const p0 = new V3(x, y, z).addScaledVector(lean, y / H), p1 = p0.clone().add(new V3(Math.cos(a) * l, 0.6 + rr() * 1.2, Math.sin(a) * l));
        branch(trunkList, p0, p1, 0.1 * s, 0.05 * s);
        for (let k = 0; k < 14; k++){ const c = p1.clone().add(new V3((rr() - 0.5) * 2.4 * s, (rr() - 0.2) * 0.9 * s, (rr() - 0.5) * 2.4 * s)); leaves.push([c.x, c.y, c.z, (1.3 + rr()) * s, rr() * TAU, rr()]); }
      }
      W.colliders.circles.push({ x, z, r: 0.35 * s });
      return { x, z, h: H };
    }
    const H = (kind === 'plane' ? 5.5 + rr() * 2 : 3.5 + rr() * 1.5) * s;
    const r0 = (kind === 'plane' ? 0.42 : 0.28) * s;
    const top = new V3(x + (rr() - 0.5) * 0.6, H, z + (rr() - 0.5) * 0.6);
    branch(trunkList, new V3(x, -0.05, z), top, r0, r0 * 0.6);
    const nb = kind === 'plane' ? 5 : 4;
    const crownR = (kind === 'plane' ? 6.5 : 4.2) * s;
    for (let i = 0; i < nb; i++){
      const a = i / nb * TAU + rr() * 0.6, up = 0.9 + rr() * 0.6;
      const p1 = top.clone().add(new V3(Math.cos(a) * crownR * 0.45, crownR * 0.45 * up, Math.sin(a) * crownR * 0.45));
      branch(trunkList, top, p1, r0 * 0.6, r0 * 0.32);
      for (let j = 0; j < 3; j++){
        const b = a + (rr() - 0.5) * 1.6;
        const p2 = p1.clone().add(new V3(Math.cos(b) * crownR * 0.4, crownR * (0.15 + rr() * 0.3), Math.sin(b) * crownR * 0.4));
        branch(trunkList, p1, p2, r0 * 0.3, r0 * 0.12);
        const nCards = kind === 'plane' ? 22 : 18;
        for (let k = 0; k < nCards; k++){
          const c = p2.clone().add(new V3((rr() - 0.5) * 3.2 * s, (rr() - 0.35) * 2.4 * s, (rr() - 0.5) * 3.2 * s));
          leaves.push([c.x, c.y, c.z, (1.5 + rr() * 1.1) * s, rr() * TAU, rr()]);
        }
      }
    }
    W.colliders.circles.push({ x, z, r: r0 + 0.12 });
    return { x, z, h: H };
  }
  const TREES = [];
  const addT = (x, z, k, s) => { TREES.push(tree(x, z, k, s)); W.scent.push({ x, z, r: (k === 'plane' ? 0.6 : 0.45) * (s || 1) + 0.6, kind: 'tree', label: k }); };
  // rows along the loop (plane trees), lawns (maples, elms), black pines in groups
  for (let x = -30; x <= 32; x += 9.5){ addT(x, LOOP.z0 - 3.2, 'plane', 1.0 + R() * 0.2); addT(x + 4, LOOP.z1 + 3.2, 'plane', 1.0 + R() * 0.2); }
  for (let z = -16; z <= 18; z += 10){ addT(LOOP.x0 - 3.4, z, 'plane', 1.05); addT(LOOP.x1 + 3.4, z + 4, 'plane', 1.0); }
  [[-12, 14, 'maple'], [-4, 18, 'maple'], [18, 14, 'maple'], [26, 18, 'elm'], [-16, -6, 'elm'], [-24, 2, 'maple'], [22, 4, 'maple'], [30, 8, 'elm'], [-8, -16, 'maple'], [10, 16, 'elm']].forEach(t => addT(t[0], t[1], t[2], 0.95 + R() * 0.3));
  [[-28, -6], [-30, -2], [-26, -9], [14, 22], [17, 24], [-10, 24]].forEach(t => addT(t[0], t[1], 'pine', 0.9 + R() * 0.25));
  // dog area shade trees
  addT(DOG.x0 + 3, DOG.z0 + 2.5, 'maple', 1.0); addT(DOG.x1 - 3, DOG.z1 - 3, 'elm', 1.0);
  // route: Parco delle Basiliche, Santa Sofia sidewalk trees, Piazza Mondadori
  [[-30, 60], [-20, 64], [-10, 62], [-32, 78], [-26, 88], [-10, 86], [-34, 104], [-12, 106], [-28, 120], [-8, 126], [-30, 140], [-16, 146], [-34, 156], [-8, 154]].forEach((t, i) => addT(t[0], t[1], i % 4 === 3 ? 'pine' : i % 3 ? 'plane' : 'maple', 0.95 + R() * 0.25));
  for (let x = 18; x < 84; x += 9) addT(x, 171.25, 'elm', 0.75);
  addT(89, 156.5, 'maple', 0.8); addT(100, 156.5, 'maple', 0.8);
  const mergeGeos = list => {
    let n = 0, ni = 0; list.forEach(g => { n += g.attributes.position.count; ni += g.index.count; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), ind = new Uint32Array(ni);
    let o = 0, oi = 0;
    list.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); const ix = g.index.array; for (let i = 0; i < ix.length; i++) ind[oi + i] = ix[i] + o; o += g.attributes.position.count; oi += ix.length; });
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setIndex(new THREE.BufferAttribute(ind, 1)); return m;
  };
  barkPlane.repeat.set(2, 3); barkDark.repeat.set(2, 3);
  for (const [k, tex] of [['plane', barkPlane], ['dark', barkDark]]){
    if (!trunkGeos[k].length) continue;
    const m = new THREE.Mesh(mergeGeos(trunkGeos[k]), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    m.castShadow = true; m.receiveShadow = true; scene.add(m);
  }
  const cardGeo = new THREE.PlaneGeometry(1, 1);
  function leafMesh(list, tex, tint){
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, color: tint || 0xffffff });
    const windVS = sh => {
      Object.assign(sh.uniforms, { uTime: U.uTime });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
float sw = sin(uTime * 1.3 + ip.x * 0.4 + ip.z * 0.3) * 0.06 + sin(uTime * 2.9 + ip.y) * 0.03;
transformed.x += sw * (position.y + 0.5); transformed.z += sw * 0.6 * (position.x + 0.5);
#endif`);
    };
    mat.onBeforeCompile = windVS;
    const im = new THREE.InstancedMesh(cardGeo, mat, list.length);
    const col = new THREE.Color();
    list.forEach((l, i) => {
      tmpQ.setFromEuler(new THREE.Euler((R() - 0.5) * 1.4, l[4], (R() - 0.5) * 1.4));
      im.setMatrixAt(i, tmpM.compose(tmpP.set(l[0], l[1], l[2]), tmpQ, tmpS.set(l[3], l[3], l[3])));
      col.setHSL(0.24 + (l[5] - 0.5) * 0.06, 0.45, 0.42 + l[5] * 0.22); im.setColorAt(i, col);
    });
    im.castShadow = true; im.receiveShadow = true;
    im.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.45 });
    scene.add(im); return im;
  }
  leafMesh(leafInst.plane, leafPlane); leafMesh(leafInst.maple, leafMaple); leafMesh(leafInst.pine, leafPine);

  /* ----- Hedges & bushes (instanced leafy blobs) ----- */
  (function(){
    const pts = [];
    const hedgeLine = (x0, z0, x1, z1, gaps) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 0.8); for (let i = 0; i <= n; i++){ const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (gaps.some(g => Math.hypot(g[0] - x, g[1] - z) < g[2])) continue; pts.push([x, z, 0.75 + R() * 0.3]); } };
    const gaps = [[0, 33, 3], [46, 2, 3], [-14, -33, 3], [-46, -18, 3]];
    hedgeLine(PARK.x0, PARK.z0, PARK.x1, PARK.z0, gaps); hedgeLine(PARK.x1, PARK.z0, PARK.x1, PARK.z1, gaps); hedgeLine(PARK.x1, PARK.z1, PARK.x0, PARK.z1, gaps); hedgeLine(PARK.x0, PARK.z1, PARK.x0, PARK.z0, gaps);
    for (let i = 0; i < 14; i++){ const x = -30 + R() * 64, z = -24 + R() * 48; const s = W.surface(x, z); if (s.lawn < 0.9 || (x > DOG.x0 - 2 && x < DOG.x1 + 2 && z > DOG.z0 - 2 && z < DOG.z1 + 2)) continue; for (let k = 0; k < 4; k++) pts.push([x + (R() - 0.5) * 1.6, z + (R() - 0.5) * 1.6, 0.5 + R() * 0.35]); W.scent.push({ x, z, r: 1.3, kind: 'bush' }); W.colliders.circles.push({ x, z, r: 1.0 }); }
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++){ const v = new V3().fromBufferAttribute(p, i); v.multiplyScalar(1 + PM.noise(v.x * 2.5, v.y * 2.5, v.z * 2.5) * 0.25); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals();
    const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: '#3d5f26', roughness: 0.95, flatShading: false }), pts.length);
    const col = new THREE.Color();
    pts.forEach((q, i) => { m.setMatrixAt(i, tmpM.compose(tmpP.set(q[0], q[2] * 0.75, q[1]), tmpQ.setFromEuler(new THREE.Euler(0, R() * 6, 0)), tmpS.set(q[2] * 1.05, q[2] * 0.9, q[2] * 1.05))); col.setHSL(0.26 + R() * 0.05, 0.45, 0.24 + R() * 0.08); m.setColorAt(i, col); });
    m.castShadow = true; m.receiveShadow = true; scene.add(m);
  })();

  /* ----- Park props ----- */
  const green = new THREE.MeshStandardMaterial({ color: '#2f4a3a', roughness: 0.5, metalness: 0.5 });
  const woodM = new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.8 });
  const concrete = new THREE.MeshStandardMaterial({ color: '#a7a39a', roughness: 0.95 });
  const add = (geo, mat, p, r, s, parent) => { const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); if (s) m.scale.set(s[0], s[1], s[2]); m.castShadow = true; m.receiveShadow = true; (parent || scene).add(m); return m; };
  function bench(x, z, ry){
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(1.9, 0.04, 0.09), woodM, [0, 0.44, -0.16 + i * 0.105], null, null, g);
    for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(1.9, 0.08, 0.035), woodM, [0, 0.62 + i * 0.12, -0.26], [-0.18, 0, 0], null, g);
    for (const sx of [-0.8, 0.8]){ add(new THREE.BoxGeometry(0.06, 0.44, 0.48), green, [sx, 0.22, -0.02], null, null, g); add(new THREE.BoxGeometry(0.05, 0.55, 0.05), green, [sx, 0.66, -0.27], [-0.18, 0, 0], null, g); add(new THREE.BoxGeometry(0.05, 0.05, 0.4), green, [sx, 0.62, -0.03], null, null, g); }
    const c = Math.cos(ry), s = Math.sin(ry);
    W.colliders.circles.push({ x: x + c * 0.55, z: z - s * 0.55, r: 0.42 }, { x: x - c * 0.55, z: z + s * 0.55, r: 0.42 });
    const fwd = new V3(Math.sin(ry), 0, Math.cos(ry));
    W.benches.push({ x, z, ry, seat: new V3(x + fwd.x * 0.05, 0.45, z + fwd.z * 0.05), front: new V3(x + fwd.x * 0.75, 0, z + fwd.z * 0.75) });
    W.scent.push({ x, z, r: 1.2, kind: 'bench' });
    return g;
  }
  [[-20, LOOP.z1 + 1.6, Math.PI], [-6, LOOP.z1 + 1.6, Math.PI], [14, LOOP.z1 + 1.6, Math.PI], [-24, LOOP.z0 - 1.6, 0], [-2, LOOP.z0 - 1.6, 0], [LOOP.x0 - 1.6, 8, Math.PI / 2], [LOOP.x1 + 1.6, -4, -Math.PI / 2],
   [9, 7.5, Math.PI * 1.2], [0.2, 6.8, Math.PI * 0.85], [10.6, -0.5, -Math.PI * 0.6], [DOG.x0 + 1.2, DOG.z1 - 1.2, Math.PI], [DOG.x1 - 6, DOG.z0 + 0.8, 0]].forEach(b => bench(b[0], b[1], b[2]));
  // lampposts (Milan dark green)
  function lamp(x, z){
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    add(new THREE.CylinderGeometry(0.09, 0.14, 0.5, 10), green, [0, 0.25, 0], null, null, g);
    add(new THREE.CylinderGeometry(0.055, 0.075, 3.6, 10), green, [0, 2.2, 0], null, null, g);
    add(new THREE.CylinderGeometry(0.2, 0.12, 0.35, 8), green, [0, 4.15, 0], null, null, g);
    const glass = add(new THREE.CylinderGeometry(0.17, 0.12, 0.42, 8), new THREE.MeshStandardMaterial({ color: '#fff3cf', emissive: '#ffd27a', emissiveIntensity: 0, roughness: 0.3 }), [0, 3.8, 0], null, null, g);
    add(new THREE.ConeGeometry(0.25, 0.25, 8), green, [0, 4.45, 0], null, null, g);
    W.lamps.push(glass); W.colliders.circles.push({ x, z, r: 0.18 }); W.scent.push({ x, z, r: 0.7, kind: 'lamp' });
  }
  const loopPts = roundedRectPts(LOOP, 8);
  for (let i = 0; i < loopPts.length - 1; i += 5){ const p = loopPts[i]; const n = loopPts[i + 1]; const dx = n[0] - p[0], dz = n[1] - p[1], l = Math.hypot(dx, dz) || 1; lamp(p[0] - dz / l * 2.2, p[1] + dx / l * 2.2); }
  // bins
  for (const [x, z] of [[-2, 30.5], [3, 9.5], [39.5, -1], [DOG.x0 + 2.5, DOG.z1 - 0.8], [-37.5, -16], [12, -6]]){
    add(new THREE.CylinderGeometry(0.24, 0.22, 0.75, 12), new THREE.MeshStandardMaterial({ color: '#59605a', roughness: 0.6, metalness: 0.4 }), [x, 0.5, z]);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 6), green, [x, 0.3, z - 0.26]);
    W.colliders.circles.push({ x, z, r: 0.3 }); W.scent.push({ x, z, r: 0.8, kind: 'bin' });
  }

  /* ----- Fountain (like Potty's fontanella) ----- */
  (function(){
    const g = new THREE.Group(); g.position.set(FOUNT.x, 0, FOUNT.z); scene.add(g);
    const iron = new THREE.MeshStandardMaterial({ color: '#4f6b5c', roughness: 0.55, metalness: 0.35 });
    const ring = new THREE.CylinderGeometry(0.92, 0.9, 0.34, 40, 1, true);
    add(ring, new THREE.MeshStandardMaterial({ color: '#56695b', roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide }), [0, 0.17, 0], null, null, g);
    add(new THREE.TorusGeometry(0.85, 0.075, 8, 40), iron, [0, 0.34, 0], [Math.PI / 2, 0, 0], null, g);
    for (let i = 0; i < 28; i++){ const a = i / 28 * TAU; add(new THREE.BoxGeometry(0.05, 0.24, 0.05), iron, [Math.cos(a) * 0.93, 0.15, Math.sin(a) * 0.93], [0, -a, 0], null, g); }
    add(new THREE.CircleGeometry(0.78, 32), new THREE.MeshStandardMaterial({ color: '#3d4a40' }), [0, 0.04, 0], [-Math.PI / 2, 0, 0], null, g);
    const water = add(new THREE.CircleGeometry(0.78, 40), new THREE.MeshPhysicalMaterial({ color: '#6aa8b8', transparent: true, opacity: 0.75, roughness: 0.05, metalness: 0.1, clearcoat: 1 }), [0, 0.24, 0], [-Math.PI / 2, 0, 0], null, g);
    water.castShadow = false;
    const col = new THREE.Group(); col.position.set(0, 0, -0.95); g.add(col);
    add(new THREE.BoxGeometry(0.7, 0.55, 0.6), new THREE.MeshStandardMaterial({ color: '#56653f', roughness: 0.95 }), [0, 0.27, 0], null, null, col);
    add(new THREE.BoxGeometry(0.56, 0.16, 0.5), iron, [0, 0.62, 0], null, null, col);
    add(new THREE.BoxGeometry(0.46, 1.3, 0.42), iron, [0, 1.35, 0], null, null, col);
    add(new THREE.BoxGeometry(0.56, 0.12, 0.52), iron, [0, 2.06, 0], null, null, col);
    add(new THREE.SphereGeometry(0.16, 14, 10), iron, [0, 2.24, 0], null, null, col);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.35, 8), iron, [0, 1.05, 0.33], [Math.PI / 2.3, 0, 0], null, col);
    const stream = add(new THREE.CylinderGeometry(0.018, 0.024, 0.85, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#cdeef7', transparent: true, opacity: 0.6, roughness: 0.05 }), [0, 0.62, 0.48], null, null, col);
    stream.castShadow = false;
    W.colliders.circles.push({ x: FOUNT.x, z: FOUNT.z - 0.95, r: 0.5 });
    W.fountain = { x: FOUNT.x, z: FOUNT.z, rIn: 0.78, rOut: 0.92, waterY: 0.24, water, stream };
    W.updaters.push(t => { stream.material.opacity = 0.5 + Math.sin(t * 20) * 0.1; });
  })();

  /* ----- Railings & dog-area fence ----- */
  const railTex = canvasTex(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#1f2a24';
    g.fillRect(0, 6, w, 8); g.fillRect(0, h - 22, w, 8);
    for (let x = 4; x < w; x += 16) g.fillRect(x, 6, 5, h - 12);
  }, true);
  const meshTex = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#2d4a35'; g.lineWidth = 3;
    for (let i = -w; i < w * 2; i += 16){ g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
    g.lineWidth = 8; g.strokeRect(0, 0, w, h);
  }, true);
  function fenceSeg(x0, z0, x1, z1, tex, hgt, perM){
    const L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.05) return;
    const t = tex.clone(); t.needsUpdate = true; t.repeat.set(L * perM, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L, hgt), new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 }));
    m.position.set((x0 + x1) / 2, hgt / 2, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); m.castShadow = true;
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.5 });
    scene.add(m);
    for (let i = 0; i <= Math.floor(L / 2.5); i++){ const f = Math.min(1, i * 2.5 / L); add(new THREE.CylinderGeometry(0.03, 0.03, hgt + 0.08, 6), green, [x0 + (x1 - x0) * f, (hgt + 0.08) / 2, z0 + (z1 - z0) * f]); }
    W.colliders.segs.push({ x0, z0, x1, z1 });
  }
  // park railing with entrances
  const ents = [[-1.8, 1.8, 'S'], [0.2, 3.8, 'E'], [-16, -12, 'N'], [-20, -16, 'W']];
  fenceSeg(PARK.x0 - 1.4, PARK.z1 + 1.4, -1.8, PARK.z1 + 1.4, railTex, 1.1, 0.5); fenceSeg(1.8, PARK.z1 + 1.4, PARK.x1 + 1.4, PARK.z1 + 1.4, railTex, 1.1, 0.5);
  fenceSeg(PARK.x1 + 1.4, PARK.z1 + 1.4, PARK.x1 + 1.4, 3.8, railTex, 1.1, 0.5); fenceSeg(PARK.x1 + 1.4, 0.2, PARK.x1 + 1.4, PARK.z0 - 1.4, railTex, 1.1, 0.5);
  fenceSeg(PARK.x1 + 1.4, PARK.z0 - 1.4, -12, PARK.z0 - 1.4, railTex, 1.1, 0.5); fenceSeg(-16, PARK.z0 - 1.4, PARK.x0 - 1.4, PARK.z0 - 1.4, railTex, 1.1, 0.5);
  fenceSeg(PARK.x0 - 1.4, PARK.z0 - 1.4, PARK.x0 - 1.4, -20, railTex, 1.1, 0.5); fenceSeg(PARK.x0 - 1.4, -16, PARK.x0 - 1.4, PARK.z1 + 1.4, railTex, 1.1, 0.5);
  // dog area fence with a gate on the west side
  const G = DOG.gate;
  fenceSeg(DOG.x0, DOG.z0, DOG.x1, DOG.z0, meshTex, 1.2, 1.2); fenceSeg(DOG.x1, DOG.z0, DOG.x1, DOG.z1, meshTex, 1.2, 1.2); fenceSeg(DOG.x1, DOG.z1, DOG.x0, DOG.z1, meshTex, 1.2, 1.2);
  fenceSeg(DOG.x0, DOG.z1, DOG.x0, G.z + G.w / 2, meshTex, 1.2, 1.2); fenceSeg(DOG.x0, G.z - G.w / 2, DOG.x0, DOG.z0, meshTex, 1.2, 1.2);
  // gate frame
  add(new THREE.BoxGeometry(0.08, 1.5, 0.08), green, [G.x, 0.75, G.z + G.w / 2]); add(new THREE.BoxGeometry(0.08, 1.5, 0.08), green, [G.x, 0.75, G.z - G.w / 2]);
  add(new THREE.BoxGeometry(0.08, 0.08, G.w), green, [G.x, 1.5, G.z]);
  const sign = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2f4a3a'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = '#2f4a3a'; g.font = '700 46px "Nunito Sans", Arial, sans-serif'; g.textAlign = 'center'; g.fillText('AREA CANI', w / 2, 62); g.font = '600 22px "Nunito Sans", Arial, sans-serif'; g.fillText('Parco Vetra', w / 2, 98); });
  add(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.6 }), [G.x - 0.06, 1.85, G.z], [0, -Math.PI / 2, 0]);
  add(new THREE.BoxGeometry(0.05, 0.6, 0.05), green, [G.x - 0.04, 1.55, G.z]);
  // dog area: shallow paddling pool (frenchie-safe) and a rope toy spot
  (function(){
    const px = DOG.x1 - 4.5, pz = DOG.z1 - 3.2;
    add(new THREE.CylinderGeometry(0.85, 0.85, 0.2, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#4ea3e0', roughness: 0.45, side: THREE.DoubleSide }), [px, 0.1, pz]);
    add(new THREE.TorusGeometry(0.85, 0.05, 8, 32), new THREE.MeshStandardMaterial({ color: '#7cc3f0', roughness: 0.4 }), [px, 0.2, pz], [Math.PI / 2, 0, 0]);
    add(new THREE.CircleGeometry(0.84, 32), new THREE.MeshStandardMaterial({ color: '#3f8fcc' }), [px, 0.01, pz], [-Math.PI / 2, 0, 0]);
    const w = add(new THREE.CircleGeometry(0.82, 32), new THREE.MeshPhysicalMaterial({ color: '#8fd0ea', transparent: true, opacity: 0.7, roughness: 0.05, clearcoat: 1 }), [px, 0.13, pz], [-Math.PI / 2, 0, 0]);
    w.castShadow = false;
    W.pool = { x: px, z: pz, rIn: 0.8, rOut: 0.9, waterY: 0.13 };
    W.ropeSpot = { x: DOG.x1 - 6, z: DOG.z0 + 4 };
    W.marta = { x: DOG.x0 + 6, z: (DOG.z0 + DOG.z1) / 2 + 1 };
  })();
  // water bowl inside the dog area
  add(new THREE.CylinderGeometry(0.2, 0.16, 0.08, 20), new THREE.MeshStandardMaterial({ color: '#b9bec4', metalness: 0.7, roughness: 0.25 }), [DOG.x0 + 2.2, 0.04, DOG.z1 - 2.2]);
  add(new THREE.CircleGeometry(0.17, 20), new THREE.MeshPhysicalMaterial({ color: '#8cc3d3', roughness: 0.05, transparent: true, opacity: 0.8 }), [DOG.x0 + 2.2, 0.075, DOG.z1 - 2.2], [-Math.PI / 2, 0, 0]);
  W.bowl = { x: DOG.x0 + 2.2, z: DOG.z1 - 2.2 };

  // playground (decor) and basketball court
  (function(){
    const P = PLAY;
    fenceSeg(P.x0, P.z0, P.x1, P.z0, railTex, 0.9, 0.5); fenceSeg(P.x1, P.z0, P.x1, P.z1, railTex, 0.9, 0.5); fenceSeg(P.x1, P.z1, P.x0, P.z1, railTex, 0.9, 0.5); fenceSeg(P.x0, P.z1, P.x0, P.z0, railTex, 0.9, 0.5);
    const red = new THREE.MeshStandardMaterial({ color: '#d64b3a', roughness: 0.5 }), yel = new THREE.MeshStandardMaterial({ color: '#f0b928', roughness: 0.5 });
    const sx = -29, sz = 14;
    add(new THREE.BoxGeometry(1.2, 1.5, 1.2), red, [sx, 0.75, sz]); add(new THREE.BoxGeometry(1.4, 0.1, 1.4), yel, [sx, 1.55, sz]);
    add(new THREE.BoxGeometry(0.6, 0.06, 2.6), yel, [sx + 1.6, 0.8, sz], [0, 0, 0.55]).rotation.set(0, Math.PI / 2, -0.55);
    for (const x of [-25, -22.6]) add(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), green, [x, 1.2, 18]);
    add(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8), green, [-23.8, 2.4, 18], [0, 0, Math.PI / 2]);
    for (const x of [-24.4, -23.2]){ add(new THREE.BoxGeometry(0.45, 0.05, 0.2), red, [x, 0.5, 18]); }
    W.colliders.boxes.push({ x0: P.x0, x1: P.x1, z0: P.z0, z1: P.z1 });
    const C2 = COURT;
    fenceSeg(C2.x0, C2.z0, C2.x1, C2.z0, meshTex, 2.6, 1.0); fenceSeg(C2.x0, C2.z1, C2.x1, C2.z1, meshTex, 2.6, 1.0); fenceSeg(C2.x0, C2.z0, C2.x0, C2.z1, meshTex, 2.6, 1.0); fenceSeg(C2.x1, C2.z0, C2.x1, C2.z1, meshTex, 2.6, 1.0);
    for (const x of [C2.x0 + 1, C2.x1 - 1]){ add(new THREE.CylinderGeometry(0.06, 0.06, 3.0, 8), green, [x, 1.5, (C2.z0 + C2.z1) / 2]); add(new THREE.BoxGeometry(0.05, 0.9, 1.6), new THREE.MeshStandardMaterial({ color: '#f4f4f4' }), [x + Math.sign((C2.x0 + C2.x1) / 2 - x) * 0.2, 3.0, (C2.z0 + C2.z1) / 2]); add(new THREE.TorusGeometry(0.23, 0.015, 6, 16), new THREE.MeshStandardMaterial({ color: '#e0562a' }), [x + Math.sign((C2.x0 + C2.x1) / 2 - x) * 0.45, 2.75, (C2.z0 + C2.z1) / 2], [Math.PI / 2, 0, 0]); }
    W.colliders.boxes.push({ x0: C2.x0, x1: C2.x1, z0: C2.z0, z1: C2.z1 });
  })();
  // kiosk (mobile summer kiosk)
  (function(){
    const g = new THREE.Group(); g.position.set(-6, 0, 9.5); g.rotation.y = 0.3; scene.add(g);
    add(new THREE.BoxGeometry(2.4, 1.1, 1.3), new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.7 }), [0, 0.75, 0], null, null, g);
    add(new THREE.BoxGeometry(2.5, 0.08, 1.4), woodM, [0, 1.32, 0], null, null, g);
    add(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), green, [0, 1.9, 0], null, null, g);
    add(new THREE.ConeGeometry(1.6, 0.6, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#2c7a6a', roughness: 0.8, side: THREE.DoubleSide }), [0, 3.0, 0], null, null, g);
    for (const x of [-0.8, 0.8]) add(new THREE.TorusGeometry(0.3, 0.05, 8, 16), new THREE.MeshStandardMaterial({ color: '#333' }), [x, 0.3, 0.68], null, null, g);
    W.colliders.circles.push({ x: -6, z: 9.5, r: 1.4 }); W.scent.push({ x: -6, z: 9.5, r: 1.8, kind: 'kiosk' });
  })();

  /* ----- City: palazzi, San Lorenzo, Sant'Eustorgio, Torre Velasca, tram ----- */
  const facade = (base, shutter, seed) => canvasTex(256, 512, (g, w, h) => {
    const r = PM.rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++){ g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; g.fillRect(r() * w, r() * h, 3, 3); }
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, h - 128, w, 128); // ground floor darker
    for (let fl = 0; fl < 4; fl++) for (let c = 0; c < 2; c++){
      const x = 40 + c * 128, y = 22 + fl * 128, ww = 50, hh = 80;
      if (fl === 3){ g.fillStyle = '#3a3330'; g.fillRect(x - 6, y + 10, ww + 12, hh + 24); g.fillStyle = 'rgba(255,240,200,0.15)'; g.fillRect(x, y + 16, ww, hh); continue; }
      g.fillStyle = '#efe8da'; g.fillRect(x - 6, y - 6, ww + 12, hh + 12);
      g.fillStyle = '#2a2d30'; g.fillRect(x, y, ww, hh);
      g.fillStyle = shutter; g.fillRect(x - 26, y, 22, hh); g.fillRect(x + ww + 4, y, 22, hh);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < hh; k += 6){ g.fillRect(x - 26, y + k, 22, 1.5); g.fillRect(x + ww + 4, y + k, 22, 1.5); }
      if (fl === 1 || (fl === 0 && c === 0)){ g.fillStyle = '#2a2622'; g.fillRect(x - 30, y + hh + 2, ww + 60, 5); for (let k = x - 28; k < x + ww + 30; k += 7) g.fillRect(k, y + hh - 22, 2, 24); g.fillRect(x - 30, y + hh - 24, ww + 60, 3); }
    }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, w, 6);
  }, true);
  const styles = [['#d9a85b', '#3e5a3a'], ['#c97b52', '#5b4632'], ['#e5d4b0', '#3e5a3a'], ['#b8b0a2', '#6b4b2f'], ['#e2b98a', '#45603c'], ['#d68d64', '#3b4f3a']];
  const facades = styles.map((s, i) => facade(s[0], s[1], 300 + i));
  const roofTile = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#9a4b33'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 10){ g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, w, 2); for (let x = (y / 10 % 2) * 8; x < w; x += 16) g.fillRect(x, y, 2, 10); } }, true);
  function palazzo(x, z, w, d, h, ry, si){
    const t = facades[si % facades.length].clone(); t.needsUpdate = true; t.repeat.set(w / 6.4, h / 13.5);
    const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    const top = new THREE.MeshStandardMaterial({ color: '#8d5a45', roughness: 0.9 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mat, mat, top, top, mat, mat]);
    m.position.set(x, h / 2, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; scene.add(m);
    const rt = roofTile.clone(); rt.needsUpdate = true; rt.repeat.set(w / 3, d / 3);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, Math.hypot(w, d) / 2 * 1.02, 2.6, 4, 1), new THREE.MeshStandardMaterial({ map: rt, roughness: 0.9 }));
    roof.position.set(x, h + 1.3, z); roof.rotation.y = ry + Math.PI / 4; roof.scale.set(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414); roof.castShadow = true; scene.add(roof);
  }
  const RR = PM.rng(999);
  for (let x = -70; x <= 70; x += 14 + RR() * 4){ if (x < -34 || x > 22) palazzo(x, -47 - RR() * 2, 13, 12, 15 + RR() * 9, 0, (RR() * 9) | 0); }
  for (let z = -36; z <= 30; z += 14 + RR() * 4){ palazzo(-63, z, 12, 13, 16 + RR() * 8, Math.PI / 2, (RR() * 9) | 0); palazzo(65, z, 12, 13, 15 + RR() * 9, -Math.PI / 2, (RR() * 9) | 0); }
  // along via Molino delle Armi (north side, east of the gate) and around the Basiliche park
  for (let x = 20; x <= 110; x += 15) palazzo(x, 58, 14, 12, 15 + RR() * 8, Math.PI, (RR() * 9) | 0);
  for (let z = 68; z <= 160; z += 15) palazzo(22, z, 12, 14, 14 + RR() * 9, -Math.PI / 2, (RR() * 9) | 0); // Corso Italia, east side
  for (let z = 60; z <= 165; z += 16) palazzo(-50, z, 12, 15, 15 + RR() * 8, Math.PI / 2, (RR() * 9) | 0);
  for (let x = 34; x <= 80; x += 14) palazzo(x, 160, 13, 11, 16 + RR() * 8, Math.PI, (RR() * 9) | 0); // via Santa Sofia, north side
  for (let x = 18; x <= 130; x += 14) palazzo(x, 188, 13, 12, 17 + RR() * 7, 0, (RR() * 9) | 0); // via Santa Sofia, south side
  for (let x = -14; x <= -4; x += 10) palazzo(x, 186, 12, 12, 18, 0, (RR() * 9) | 0);
  palazzo(94, 144, 22, 14, 22, Math.PI, 2); // Piazza Mondadori 2
  palazzo(112, 160, 12, 22, 20, -Math.PI / 2, 4);
  // San Lorenzo Maggiore (north, the iconic apse and dome over the trees)
  (function(){
    const g = new THREE.Group(); g.position.set(-8, 0, -82); scene.add(g);
    const stone = new THREE.MeshStandardMaterial({ color: '#b9a789', roughness: 0.95 });
    const stone2 = new THREE.MeshStandardMaterial({ color: '#a8977b', roughness: 0.95 });
    const lead = new THREE.MeshStandardMaterial({ color: '#7d878c', roughness: 0.6, metalness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.9 });
    const oct = (r, h, y, m) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), m); c.position.y = y; c.rotation.y = Math.PI / 8; c.castShadow = true; g.add(c); return c; };
    oct(22, 16, 8, stone2); // ambulatory
    for (let i = 0; i < 4; i++){ const a = i * Math.PI / 2; const ex = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 14, 16, 1, false, 0, Math.PI), stone2); ex.position.set(Math.sin(a) * 19, 7, Math.cos(a) * 19); ex.rotation.y = a - Math.PI / 2; g.add(ex); }
    oct(16, 16, 22, stone); oct(14.5, 6, 33, stone); // drum
    for (let i = 0; i < 8; i++){ const a = i / 8 * TAU + Math.PI / 8; const w = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.5, 0.5), dark); w.position.set(Math.sin(a) * 15.9, 24, Math.cos(a) * 15.9); w.rotation.y = a; g.add(w); }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(14.2, 8, 10, 0, TAU, 0, Math.PI / 2), lead); dome.position.y = 36; dome.rotation.y = Math.PI / 8; dome.scale.y = 0.95; dome.castShadow = true; g.add(dome);
    oct(2.2, 4, 51, stone); const lc = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3, 8), lead); lc.position.y = 54.5; g.add(lc);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 0.25), dark); cross.position.y = 57; g.add(cross);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){
      const t = new THREE.Mesh(new THREE.BoxGeometry(6.5, 34, 6.5), stone2); t.position.set(sx * 21, 17, sz * 21); t.castShadow = true; g.add(t);
      const r = new THREE.Mesh(new THREE.ConeGeometry(5, 5, 4), lead); r.position.set(sx * 21, 36.5, sz * 21); r.rotation.y = Math.PI / 4; g.add(r);
      for (let k = 0; k < 3; k++){ const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.3), dark); w.position.set(sx * 21, 24 + k * 3.2, sz * 21 + 3.3); g.add(w); }
    }
  })();
  // Sant'Eustorgio bell tower (south, far)
  (function(){
    const brick = new THREE.MeshStandardMaterial({ color: '#a2553c', roughness: 0.95 });
    const g = new THREE.Group(); g.position.set(-62, 0, 128); scene.add(g);
    const t = new THREE.Mesh(new THREE.BoxGeometry(9, 62, 9), brick); t.position.y = 31; g.add(t);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 8, 8), brick); b.position.y = 66; g.add(b);
    const s = new THREE.Mesh(new THREE.ConeGeometry(4.5, 18, 8), brick); s.position.y = 79; g.add(s);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(1.2), new THREE.MeshStandardMaterial({ color: '#d9b35a', metalness: 0.8, roughness: 0.3 })); star.position.y = 90; g.add(star);
  })();
  // Torre Velasca (north-east skyline)
  (function(){
    const m = new THREE.MeshStandardMaterial({ color: '#b48d72', roughness: 0.9 });
    const g = new THREE.Group(); g.position.set(220, 0, -460); scene.add(g);
    const a = new THREE.Mesh(new THREE.BoxGeometry(26, 72, 26), m); a.position.y = 36; g.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(36, 28, 36), m); b.position.y = 86; g.add(b);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const s = new THREE.Mesh(new THREE.BoxGeometry(1.6, 16, 1.6), m); s.position.set(sx * 15, 66, sz * 15); s.rotation.set(sz * -0.4, 0, sx * 0.4); g.add(s); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 30), new THREE.MeshStandardMaterial({ color: '#6d5b52' })); roof.position.y = 103; g.add(roof);
  })();
  // tram on via Molino delle Armi (east street), yellow-orange "Ventotto"
  (function(){
    const g = new THREE.Group(); scene.add(g);
    const body = new THREE.MeshStandardMaterial({ color: '#f0a92a', roughness: 0.5 });
    const cream = new THREE.MeshStandardMaterial({ color: '#efe7cf', roughness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: '#2b3338', roughness: 0.2, metalness: 0.4 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.3, 13.5), body); b.position.y = 1.65; b.castShadow = true; g.add(b);
    const w = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.95, 12.6), glass); w.position.y = 2.2; g.add(w);
    const r = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 13.2), cream); r.position.y = 2.95; g.add(r);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 1.6), new THREE.MeshStandardMaterial({ color: '#222' })); p.position.set(0, 3.8, 0); p.rotation.x = 0.7; g.add(p);
    const rail = new THREE.MeshStandardMaterial({ color: '#555b60', metalness: 0.7, roughness: 0.4 });
    for (const x of [-0.72, 0.72]){ const rl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 300), rail); rl.position.set(6 + x, 0.012, 190); scene.add(rl); }
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 300, 4), new THREE.MeshBasicMaterial({ color: '#222' })); wire.rotation.x = Math.PI / 2; wire.position.set(6, 5.6, 190); scene.add(wire);
    W.tramRef = g;
    W.tram = g;
  })();


  /* ----- The walk: roads, crossings with traffic lights, traffic, street furniture ----- */
  W.bins = [];
  W.lights = { molino: { state: 'red', t: 4, ped: 9, car: 12 }, italia: { state: 'red', t: 7, ped: 9, car: 12 } };
  (function(){
    const white = new THREE.MeshStandardMaterial({ color: '#e9e7df', roughness: 0.8 });
    const yellow = new THREE.MeshStandardMaterial({ color: '#e8c33a', roughness: 0.8 });
    const flat = (w, d, x, z, m, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); p.rotation.x = -Math.PI / 2; if (ry) p.rotation.z = ry; p.position.set(x, 0.012, z); p.receiveShadow = true; scene.add(p); };
    // zebra crossings
    for (let i = 0; i < 7; i++) flat(3.2, 0.5, 0, 40.8 + i * 1.08, white);
    for (let i = 0; i < 10; i++) flat(0.5, 3.0, 0.6 + i * 1.12, 170, white);
    // lane dashes
    for (let x = -120; x < 120; x += 6) if (Math.abs(x) > 4) flat(3, 0.14, x, 44.1, white);
    for (let z = 52; z < 320; z += 6) if (Math.abs(z - 170) > 4) flat(0.14, 3, 6, z, white);
    for (let x = 16; x < 200; x += 6) flat(3, 0.14, x, 176, white);
    // curbs
    const curb = new THREE.MeshStandardMaterial({ color: '#8f8c86', roughness: 0.9 });
    const curbLine = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0); const m = new THREE.Mesh(new THREE.BoxGeometry(L, 0.12, 0.2), curb); m.position.set((x0 + x1) / 2, 0.06, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); m.receiveShadow = true; scene.add(m); };
    curbLine(-130, 40.2, -1.8, 40.2); curbLine(1.8, 40.2, 130, 40.2); curbLine(-130, 48, -3.6, 48); curbLine(12, 48, 130, 48);
    curbLine(0, 48, 0, 168.4); curbLine(0, 171.6, 0, 330); curbLine(12, 48, 12, 168.4); curbLine(12, 172, 200, 172); curbLine(12, 180, 200, 180);
    // traffic lights
    const pole = new THREE.MeshStandardMaterial({ color: '#2f3a33', roughness: 0.5, metalness: 0.5 });
    const lamp = (col) => new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.1, roughness: 0.3 });
    const heads = { molino: [], italia: [] };
    const light = (x, z, ry, key) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.1, 8), pole); p.position.y = 1.55; p.castShadow = true; g.add(p);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.62, 0.22), pole); box.position.set(0, 2.55, 0.12); g.add(box);
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.02), lamp('#ff3b2f')); r.position.set(0, 2.7, 0.24); g.add(r);
      const gr = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.02), lamp('#3bd16f')); gr.position.set(0, 2.42, 0.24); g.add(gr);
      const btn = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.08), new THREE.MeshStandardMaterial({ color: '#e0b42c' })); btn.position.set(0, 1.1, 0.07); g.add(btn);
      heads[key].push({ r, g: gr });
      W.colliders.circles.push({ x, z, r: 0.12 }); W.scent.push({ x, z, r: 0.6, kind: 'semaforo' });
    };
    light(-2.2, 39.8, 0, 'molino'); light(2.2, 48.5, Math.PI, 'molino');
    light(12.5, 167.9, -Math.PI / 2, 'italia'); light(-0.5, 172.1, Math.PI / 2, 'italia');
    W.updaters.push((t, dt) => {
      for (const k in W.lights){ const L = W.lights[k]; L.t -= dt; if (L.t <= 0){ L.state = L.state === 'green' ? 'red' : 'green'; L.t = L.state === 'green' ? L.ped : L.car; }
        const blink = L.state === 'green' && L.t < 2.5 ? (Math.sin(t * 14) > 0 ? 1 : 0.2) : 1;
        heads[k].forEach(h => { h.r.material.emissiveIntensity = L.state === 'red' ? 2.2 : 0.05; h.g.material.emissiveIntensity = L.state === 'green' ? 2.2 * blink : 0.05; }); }
    });
    // traffic: cars on roads, stopping when pedestrians have green
    const carCols = ['#c9cdd2', '#2b3a55', '#8a1c1c', '#f2f2ee', '#3b3b3b', '#2f6d4f', '#d8b33a', '#5a6e8c'];
    const mkCar = (col) => {
      const g = new THREE.Group();
      const body = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.5 });
      const glass = new THREE.MeshStandardMaterial({ color: '#1d2329', roughness: 0.15, metalness: 0.5 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.7, 4.0), body); b.position.y = 0.6; b.castShadow = true; g.add(b);
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.55, 2.1), glass); c.position.set(0, 1.18, -0.2); g.add(c);
      for (const [x, z] of [[-0.8, 1.3], [0.8, 1.3], [-0.8, -1.3], [0.8, -1.3]]){ const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14), new THREE.MeshStandardMaterial({ color: '#151515' })); w.rotation.z = Math.PI / 2; w.position.set(x, 0.32, z); g.add(w); }
      scene.add(g); return g;
    };
    const lanes = [
      { key: 'molino', axis: 'x', fixed: 42.1, dir: 1, a: -130, b: 130, stop: -3.2 },
      { key: 'molino', axis: 'x', fixed: 46.1, dir: -1, a: 130, b: -130, stop: 3.2 },
      { key: 'italia', axis: 'z', fixed: 3, dir: 1, a: 52, b: 330, stop: 166.8 },
      { key: 'italia', axis: 'z', fixed: 9, dir: -1, a: 330, b: 52, stop: 173.2 }
    ];
    const cars = [];
    lanes.forEach((ln, li) => { for (let i = 0; i < 3; i++){ const g = mkCar(carCols[(li * 3 + i) % carCols.length]); cars.push({ g, ln, s: ln.a + ln.dir * i * 70, v: 9 }); } });
    // bus 94 on via Molino delle Armi
    (function(){
      const g = new THREE.Group(); const body = new THREE.MeshStandardMaterial({ color: '#f39a1e', roughness: 0.45 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.7, 12), body); b.position.y = 1.65; b.castShadow = true; g.add(b);
      const w = new THREE.Mesh(new THREE.BoxGeometry(2.54, 1.0, 11.2), new THREE.MeshStandardMaterial({ color: '#22292e', roughness: 0.2, metalness: 0.4 })); w.position.y = 2.1; g.add(w);
      const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#ffb02e'; x.font = '700 44px Arial'; x.textAlign = 'center'; x.fillText('94', 64, 48);
      const t = new THREE.CanvasTexture(c); const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.42), new THREE.MeshBasicMaterial({ map: t })); sign.position.set(0, 2.75, 6.02); g.add(sign);
      scene.add(g); cars.push({ g, ln: lanes[0], s: -60, v: 7, bus: true });
    })();
    // tram 15 on Corso Italia (centre tracks)
    const tram = W.tramRef; const tramLn = { key: 'italia', axis: 'z', fixed: 6, dir: -1, a: 330, b: 52, stop: 173.6 };
    cars.push({ g: tram, ln: tramLn, s: 300, v: 6, tram: true });
    W.updaters.push((t, dt) => {
      for (const c of cars){
        const L = W.lights[c.ln.key];
        const ahead = (c.ln.stop - c.s) * c.ln.dir;
        const mustStop = L.state === 'green' && ahead > 0 && ahead < 9;
        let blocked = false; for (const o of cars){ if (o === c || o.ln !== c.ln) continue; const gap = (o.s - c.s) * c.ln.dir; if (gap > 0 && gap < (c.bus || c.tram || o.bus || o.tram ? 15 : 7)) blocked = true; }
        const target = mustStop ? Math.max(0, (ahead - 1.5) * 1.5) : (blocked ? 0 : c.v);
        c.cur = THREE.MathUtils.lerp(c.cur || c.v, Math.min(target, c.v), 1 - Math.exp(-3 * dt));
        c.s += c.ln.dir * c.cur * dt;
        if ((c.s - c.ln.b) * c.ln.dir > 0){ c.s = c.ln.a; }
        if (c.ln.axis === 'x'){ c.g.position.set(c.s, 0, c.ln.fixed); c.g.rotation.y = c.ln.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
        else { c.g.position.set(c.ln.fixed, 0, c.s); c.g.rotation.y = c.ln.dir > 0 ? 0 : Math.PI; }
      }
    });
    // parked cars along Santa Sofia and a few scooters
    for (let x = 22; x < 80; x += 7.5){ const g = mkCar(carCols[(x * 7) % carCols.length | 0]); g.position.set(x, 0, 173.4); g.rotation.y = Math.PI / 2; }
    for (const [x, z] of [[86, 168.5], [87.2, 168.5], [101, 168.6]]){
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = 0.2; scene.add(g);
      const m = new THREE.MeshStandardMaterial({ color: x > 100 ? '#c23b2c' : '#e9e4d6', roughness: 0.4, metalness: 0.3 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 1.4), m); b.position.y = 0.55; g.add(b);
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), m); st.position.set(0, 0.9, 0.55); st.rotation.x = -0.2; g.add(st);
      for (const zz of [-0.55, 0.55]){ const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 12), new THREE.MeshStandardMaterial({ color: '#111' })); w.rotation.z = Math.PI / 2; w.position.set(0, 0.22, zz); g.add(w); }
      g.traverse(o => { if (o.isMesh) o.castShadow = true; }); W.colliders.circles.push({ x, z, r: 0.5 }); W.scent.push({ x, z, r: 0.9, kind: 'scooter' });
    }
    // Piazza Mondadori 2: the front door, number plaque, bar with outdoor tables
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.0, 0.2), new THREE.MeshStandardMaterial({ color: '#4a2e1f', roughness: 0.6 })); door.position.set(94, 1.5, 151.05); scene.add(door);
    const arch = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.25, 0.3), new THREE.MeshStandardMaterial({ color: '#d8d0c0' })); arch.position.set(94, 3.12, 151.05); scene.add(arch);
    const pc = document.createElement('canvas'); pc.width = 128; pc.height = 128; const pg = pc.getContext('2d'); pg.fillStyle = '#1f3c7a'; pg.fillRect(0, 0, 128, 128); pg.strokeStyle = '#fff'; pg.lineWidth = 6; pg.strokeRect(6, 6, 116, 116); pg.fillStyle = '#fff'; pg.font = '700 80px Georgia, serif'; pg.textAlign = 'center'; pg.fillText('2', 64, 94);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pc) })); plaque.position.set(95.5, 2.6, 151.22); plaque.rotation.y = 0; scene.add(plaque);
    const sc = document.createElement('canvas'); sc.width = 512; sc.height = 96; const sg = sc.getContext('2d'); sg.fillStyle = '#f2efe6'; sg.fillRect(0, 0, 512, 96); sg.fillStyle = '#2b2b2b'; sg.font = '700 40px Arial, sans-serif'; sg.textAlign = 'center'; sg.fillText('P.ZA ARNOLDO MONDADORI', 256, 62);
    const street = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc) })); street.position.set(88, 3.6, 151.22); scene.add(street);
    for (const [x, z] of [[100.5, 162], [102.5, 160]]){
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 16), new THREE.MeshStandardMaterial({ color: '#d9d6cf', metalness: 0.4, roughness: 0.4 })); t.position.set(x, 0.74, z); t.castShadow = true; scene.add(t);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.74, 8), new THREE.MeshStandardMaterial({ color: '#333' })); l.position.set(x, 0.37, z); scene.add(l);
      W.colliders.circles.push({ x, z, r: 0.45 }); W.scent.push({ x, z, r: 0.9, kind: 'bar' });
    }
    const awn = new THREE.Mesh(new THREE.BoxGeometry(6, 0.08, 1.6), new THREE.MeshStandardMaterial({ color: '#2f6d4f', roughness: 0.8 })); awn.position.set(101, 3.0, 158.3); awn.rotation.y = -Math.PI / 2; awn.position.set(105.2, 3, 161); scene.add(awn);
    // lamps and bins along the walk + Basiliche benches
    const binM = new THREE.MeshStandardMaterial({ color: '#59605a', roughness: 0.6, metalness: 0.4 });
    for (const [x, z] of [[-1.8, 30.5], [-4.2, 52.5], [-2.2, 100], [-2.2, 150], [14, 168], [40, 168], [70, 168], [92, 165.5], [-12, 38.5], [8, 38.5]]){
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.75, 12), binM); b.position.set(x, 0.5, z); b.castShadow = true; scene.add(b);
      W.colliders.circles.push({ x, z, r: 0.3 }); W.scent.push({ x, z, r: 0.8, kind: 'bin' }); W.bins.push({ x, z });
    }
    [[-6, 80, Math.PI / 2], [-30, 112, -Math.PI / 2], [-5, 136, Math.PI / 2]].forEach(b => bench(b[0], b[1], b[2]));
    for (const [x, z] of [[-3.2, 70], [-3.2, 110], [-3.2, 150], [30, 167.2], [60, 167.2], [-12, 36], [12, 36]]) lamp(x, z);
  })();
  W.walkable = function(x, z){
    for (const r of WALK){ if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1){ if (!r.cross || W.lights[r.cross].state === 'green') return true; } }
    return false;
  };
  W.atCrossing = function(x, z){ for (const r of WALK){ if (r.cross && x >= r.x0 - 1.4 && x <= r.x1 + 1.4 && z >= r.z0 - 1.4 && z <= r.z1 + 1.4) return r.cross; } return null; };
  W.inRoad = function(x, z){ for (const r of WALK){ if (r.cross && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.cross; } return null; };

  /* ----- Sky, sun, clouds ----- */
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { top: { value: C('#4f8fd0') }, bottom: { value: C('#d7e6ee') }, sunDir: { value: new V3(0, 1, 0) }, sunCol: { value: C('#fff1d6') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vP; void main(){ vec3 d = normalize(vP - cameraPosition); float h = d.y; float t = smoothstep(-0.02, 0.5, h); vec3 c = mix(bottom, top, t); float s = max(dot(d, sunDir), 0.0); c += sunCol * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.25); gl_FragColor = vec4(c, 1.0);\n#include <encodings_fragment>\n}',
    side: THREE.BackSide, depthWrite: false, fog: false
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12), skyMat); sky.renderOrder = -1; scene.add(sky);
  const cloudTex = canvasTex(256, 128, (g, w, h) => { const r = PM.rng(3); for (let i = 0; i < 40; i++){ const x = 40 + r() * 176, y = 50 + r() * 40, rad = 18 + r() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); } });
  for (let i = 0; i < 14; i++){ const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 })); const a = R() * TAU, d = 380 + R() * 300; sp.position.set(Math.cos(a) * d, 120 + R() * 90, Math.sin(a) * d); sp.scale.set(260 + R() * 160, 90 + R() * 40, 1); scene.add(sp); }
  scene.fog = new THREE.Fog(C('#d7e6ee'), 70, 520);
  const hemi = new THREE.HemisphereLight(C('#dcebff'), C('#6f6650'), 0.7); scene.add(hemi);
  const sun = new THREE.DirectionalLight(C('#fff1d6'), 2.2); sun.castShadow = true;
  sun.shadow.mapSize.set(opt.lowShadow ? 1024 : 2048, opt.lowShadow ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 120 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  W.sun = sun; W.hemi = hemi; W.sky = sky; W.skyMat = skyMat;
  const skyTop = ['#4f8fd0', '#4a86c9', '#6a7fb8', '#3a3f74'].map(C), skyBot = ['#d7e6ee', '#e8dfc8', '#f5b98a', '#ef8f6f'].map(C), sunC = ['#fff1d6', '#ffe2b0', '#ffb070', '#ff8a52'].map(C);
  const sample = (arr, t, out) => { const f = Math.max(0, Math.min(1, t)) * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(f)); return out.copy(arr[i]).lerp(arr[i + 1], f - i); };
  W.setTime = function(t, focus){
    const az = THREE.MathUtils.lerp(-0.4, 1.35, t), el = THREE.MathUtils.lerp(0.75, 0.1, t * t);
    const dir = new V3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el) * 0.7 + 0.3).normalize();
    sun.position.copy(focus).addScaledVector(dir, 60); sun.target.position.copy(focus);
    sample(sunC, t, sun.color); sun.intensity = THREE.MathUtils.lerp(2.3, 1.2, Math.max(0, t - 0.55) / 0.45);
    sample(skyTop, t, skyMat.uniforms.top.value); sample(skyBot, t, skyMat.uniforms.bottom.value);
    skyMat.uniforms.sunDir.value.copy(dir); skyMat.uniforms.sunCol.value.copy(sun.color);
    scene.fog.color.copy(skyMat.uniforms.bottom.value);
    hemi.intensity = THREE.MathUtils.lerp(0.75, 0.45, Math.max(0, t - 0.6) / 0.4);
    const lampOn = Math.max(0, (t - 0.82) / 0.18);
    W.lamps.forEach(l => l.material.emissiveIntensity = lampOn * 2.2);
  };
  W.update = function(t, dt, cam){ U.uTime.value = t; U.uCam.value.copy(cam); sky.position.copy(cam); for (const f of W.updaters) f(t, dt); };
  W.TREES = TREES;
  return W;
};

/* ---------- Collision helper ---------- */
PM.collide = function(W, pos, r, opts){
  opts = opts || {};
  const C = W.colliders;
  for (const c of C.circles){ const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 1e-5){ pos.x = c.x + dx / d * m; pos.z = c.z + dz / d * m; } }
  for (const s of C.segs){
    if (s.tunnel && opts.tunnelOk) continue;
    const ex = s.x1 - s.x0, ez = s.z1 - s.z0, l2 = ex * ex + ez * ez;
    let t = ((pos.x - s.x0) * ex + (pos.z - s.z0) * ez) / l2; t = Math.max(0, Math.min(1, t));
    const px = s.x0 + ex * t, pz = s.z0 + ez * t, dx = pos.x - px, dz = pos.z - pz, d = Math.hypot(dx, dz), m = r + 0.06;
    if (d < m){ if (d < 1e-5){ pos.x += -ez / Math.sqrt(l2) * m; pos.z += ex / Math.sqrt(l2) * m; } else { pos.x = px + dx / d * m; pos.z = pz + dz / d * m; } }
  }
  for (const b of C.boxes){
    if (pos.x > b.x0 - r && pos.x < b.x1 + r && pos.z > b.z0 - r && pos.z < b.z1 + r){
      const dl = pos.x - (b.x0 - r), dr = (b.x1 + r) - pos.x, dt = pos.z - (b.z0 - r), db = (b.z1 + r) - pos.z, m = Math.min(dl, dr, dt, db);
      if (m === dl) pos.x = b.x0 - r; else if (m === dr) pos.x = b.x1 + r; else if (m === dt) pos.z = b.z0 - r; else pos.z = b.z1 + r;
    }
  }
  if (opts.park !== false && !opts.free){ const P = PM.LAYOUT.PARK; if (opts.parkOnly){ pos.x = Math.max(P.x0 + 1.0, Math.min(P.x1 - 1.0, pos.x)); pos.z = Math.max(P.z0 + 1.0, Math.min(P.z1 - 1.0, pos.z)); } }
};
PM.keepWalkable = function(W, prev, pos){
  if (W.walkable(pos.x, pos.z)) return;
  if (W.walkable(pos.x, prev.z)){ pos.z = prev.z; return; }
  if (W.walkable(prev.x, pos.z)){ pos.x = prev.x; return; }
  if (W.walkable(prev.x, prev.z)){ pos.x = prev.x; pos.z = prev.z; return; }
};
PM.inDogArea = (x, z) => { const D = PM.LAYOUT.DOG; return x > D.x0 && x < D.x1 && z > D.z0 && z < D.z1; };
})();
