/* Organic shape toolkit: signed distance fields, surface-nets mesher, skin weights, CPU noise. */
(function(){
'use strict';
const PM = window.PM = window.PM || {};

function smin(a, b, k){ if (k <= 0) return a < b ? a : b; const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }

function invRot(rx, ry, rz){
  const e = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)).elements;
  return [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]];
}

function prim(op, x, y, z){
  if (op.t === 2){
    const pax = x - op.ax, pay = y - op.ay, paz = z - op.az;
    const yy = pax * op.bax + pay * op.bay + paz * op.baz;
    const zz = yy - op.l2;
    const qx = pax * op.l2 - op.bax * yy, qy = pay * op.l2 - op.bay * yy, qz = paz * op.l2 - op.baz * yy;
    const x2 = qx * qx + qy * qy + qz * qz, y2 = yy * yy * op.l2, z2 = zz * zz * op.l2;
    const k = Math.sign(op.rr) * op.rr * op.rr * x2;
    if (Math.sign(zz) * op.a2 * z2 > k) return Math.sqrt(x2 + z2) * op.il2 - op.r2;
    if (Math.sign(yy) * op.a2 * y2 < k) return Math.sqrt(x2 + y2) * op.il2 - op.r1;
    return (Math.sqrt(x2 * op.a2 * op.il2) + yy * op.rr) * op.il2 - op.r1;
  }
  if (op.t === 5) return op.f(x, y, z);
  let px = x - op.cx, py = y - op.cy, pz = z - op.cz;
  if (op.R){ const R = op.R; const lx = R[0] * px + R[1] * py + R[2] * pz, ly = R[3] * px + R[4] * py + R[5] * pz, lz = R[6] * px + R[7] * py + R[8] * pz; px = lx; py = ly; pz = lz; }
  if (op.t === 0){
    const a = px / op.rx, b = py / op.ry, c = pz / op.rz;
    const k0 = Math.sqrt(a * a + b * b + c * c);
    const a2 = a / op.rx, b2 = b / op.ry, c2 = c / op.rz;
    const k1 = Math.sqrt(a2 * a2 + b2 * b2 + c2 * c2);
    return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(op.rx, op.ry, op.rz);
  }
  if (op.t === 1) return Math.sqrt(px * px + py * py + pz * pz) - op.r;
  if (op.t === 3){
    const qx = Math.abs(px) - op.hx, qy = Math.abs(py) - op.hy, qz = Math.abs(pz) - op.hz;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - op.rad;
  }
  if (op.t === 5) return op.f(x, y, z);
  if (op.t === 4){ // torus in xz plane (local), radius R, tube r
    const q = Math.sqrt(px * px + pz * pz) - op.R2; return Math.sqrt(q * q + py * py) - op.r;
  }
  return 1e9;
}

class Shape {
  constructor(){ this.ops = []; this.lo = [1e9, 1e9, 1e9]; this.hi = [-1e9, -1e9, -1e9]; }
  _push(op, bc, br, o){
    o = o || {};
    op.k = o.k == null ? 0.012 : o.k; op.sub = !!o.sub; op.disp = o.disp || null; op.dispAmp = o.dispAmp || 0;
    op.bx = bc[0]; op.by = bc[1]; op.bz = bc[2]; op.br = br + op.dispAmp;
    if (o.rot) op.R = invRot(o.rot[0], o.rot[1], o.rot[2]);
    if (!op.sub && !o.noBounds) for (let i = 0; i < 3; i++){ this.lo[i] = Math.min(this.lo[i], bc[i] - op.br - op.k); this.hi[i] = Math.max(this.hi[i], bc[i] + op.br + op.k); }
    this.ops.push(op); return this;
  }
  ell(c, r, o){ return this._push({ t: 0, cx: c[0], cy: c[1], cz: c[2], rx: r[0], ry: r[1], rz: r[2] }, c, Math.max(r[0], r[1], r[2]), o); }
  sph(c, r, o){ return this._push({ t: 1, cx: c[0], cy: c[1], cz: c[2], r }, c, r, o); }
  cone(a, b, r1, r2, o){
    const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
    const l2 = Math.max(1e-10, bax * bax + bay * bay + baz * baz), rr = r1 - r2;
    const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    return this._push({ t: 2, ax: a[0], ay: a[1], az: a[2], bax, bay, baz, l2, rr, a2: l2 - rr * rr, il2: 1 / l2, r1, r2 }, c, Math.sqrt(l2) / 2 + Math.max(r1, r2), o);
  }
  box(c, h, rad, o){ return this._push({ t: 3, cx: c[0], cy: c[1], cz: c[2], hx: h[0], hy: h[1], hz: h[2], rad: rad || 0 }, c, Math.hypot(h[0], h[1], h[2]) + (rad || 0), o); }
  custom(f, c, r, o){ return this._push({ t: 5, f, cx: c[0], cy: c[1], cz: c[2] }, c, r, o); }
  torus(c, R, r, o){ return this._push({ t: 4, cx: c[0], cy: c[1], cz: c[2], R2: R, r }, c, R + r, o); }
  eval(x, y, z){
    let d = 1e9; const ops = this.ops;
    for (let i = 0; i < ops.length; i++){
      const op = ops[i];
      const dx = x - op.bx, dy = y - op.by, dz = z - op.bz;
      const lb = Math.sqrt(dx * dx + dy * dy + dz * dz) - op.br;
      if (!op.sub){ if (lb > d + op.k) continue; }
      else if (lb > -d + op.k) continue;
      let p = prim(op, x, y, z);
      if (op.disp) p += op.disp(x, y, z);
      d = op.sub ? -smin(-d, p, op.k) : smin(d, p, op.k);
    }
    return d;
  }
}
PM.Shape = Shape;

const CORN = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
const EDGES = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];

/* Surface nets with block culling, Newton projection and gradient normals. Returns a BufferGeometry. */
PM.meshShape = function(shape, cell, opts){
  opts = opts || {};
  const f = opts.fn || ((x, y, z) => shape.eval(x, y, z));
  const pad = cell * 3;
  const lo = (opts.lo || shape.lo).map(v => v - pad), hi = (opts.hi || shape.hi).map(v => v + pad);
  const nx = Math.ceil((hi[0] - lo[0]) / cell) + 1, ny = Math.ceil((hi[1] - lo[1]) / cell) + 1, nz = Math.ceil((hi[2] - lo[2]) / cell) + 1;
  const N = nx * ny * nz, F = new Float32Array(N), st = new Uint8Array(N);
  const B = 4;
  for (let k0 = 0; k0 < nz - 1; k0 += B) for (let j0 = 0; j0 < ny - 1; j0 += B) for (let i0 = 0; i0 < nx - 1; i0 += B){
    const i1 = Math.min(i0 + B, nx - 1), j1 = Math.min(j0 + B, ny - 1), k1 = Math.min(k0 + B, nz - 1);
    const d = f(lo[0] + (i0 + i1) * 0.5 * cell, lo[1] + (j0 + j1) * 0.5 * cell, lo[2] + (k0 + k1) * 0.5 * cell);
    const half = 0.5 * cell * Math.sqrt((i1 - i0) ** 2 + (j1 - j0) ** 2 + (k1 - k0) ** 2);
    const far = Math.abs(d) > half * 1.35 + cell * 0.6;
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){
      const n = i + nx * (j + ny * k);
      if (far){ if (st[n] === 0){ F[n] = d; st[n] = 1; } }
      else if (st[n] !== 2){ F[n] = f(lo[0] + i * cell, lo[1] + j * cell, lo[2] + k * cell); st[n] = 2; }
    }
  }
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cellV = new Int32Array(cx * cy * cz).fill(-1);
  const pos = []; const v = new Float32Array(8);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++){
    let mask = 0;
    for (let c = 0; c < 8; c++){ const o = CORN[c]; const val = F[(i + o[0]) + nx * ((j + o[1]) + ny * (k + o[2]))]; v[c] = val; if (val < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (let e = 0; e < 12; e++){
      const a = EDGES[e][0], b = EDGES[e][1];
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]); const oa = CORN[a], ob = CORN[b];
      sx += oa[0] + t * (ob[0] - oa[0]); sy += oa[1] + t * (ob[1] - oa[1]); sz += oa[2] + t * (ob[2] - oa[2]); n++;
    }
    cellV[i + cx * (j + cy * k)] = pos.length / 3;
    pos.push(lo[0] + (i + sx / n) * cell, lo[1] + (j + sy / n) * cell, lo[2] + (k + sz / n) * cell);
  }
  const C = (i, j, k) => cellV[i + cx * (j + cy * k)];
  const ind = [];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){
    const s0 = F[i + nx * (j + ny * k)] < 0;
    if (i < nx - 1 && j > 0 && k > 0 && j < cy && k < cz){
      if (s0 !== (F[(i + 1) + nx * (j + ny * k)] < 0)) ind.push(C(i, j - 1, k - 1), C(i, j, k - 1), C(i, j, k), C(i, j - 1, k));
    }
    if (j < ny - 1 && i > 0 && k > 0 && i < cx && k < cz){
      if (s0 !== (F[i + nx * ((j + 1) + ny * k)] < 0)) ind.push(C(i - 1, j, k - 1), C(i, j, k - 1), C(i, j, k), C(i - 1, j, k));
    }
    if (k < nz - 1 && i > 0 && j > 0 && i < cx && j < cy){
      if (s0 !== (F[i + nx * (j + ny * (k + 1))] < 0)) ind.push(C(i - 1, j - 1, k), C(i, j - 1, k), C(i, j, k), C(i - 1, j, k));
    }
  }
  const nv = pos.length / 3, P = new Float32Array(pos), Nr = new Float32Array(nv * 3);
  const grad = (x, y, z, e, out) => { out[0] = f(x + e, y, z) - f(x - e, y, z); out[1] = f(x, y + e, z) - f(x, y - e, z); out[2] = f(x, y, z + e) - f(x, y, z - e); };
  const g = [0, 0, 0];
  for (let a = 0; a < nv; a++){
    let x = P[a * 3], y = P[a * 3 + 1], z = P[a * 3 + 2];
    for (let it = 0; it < 2; it++){
      const d = f(x, y, z); grad(x, y, z, cell * 0.5, g);
      const gl = Math.sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]);
      if (gl < 1e-9) break;
      let step = d / (gl / (cell)); step = Math.max(-cell * 0.8, Math.min(cell * 0.8, step));
      x -= g[0] / gl * step; y -= g[1] / gl * step; z -= g[2] / gl * step;
    }
    P[a * 3] = x; P[a * 3 + 1] = y; P[a * 3 + 2] = z;
    grad(x, y, z, cell * 0.35, g);
    const gl = Math.sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) || 1;
    Nr[a * 3] = g[0] / gl; Nr[a * 3 + 1] = g[1] / gl; Nr[a * 3 + 2] = g[2] / gl;
  }
  const tris = new Uint32Array(ind.length / 4 * 6);
  let t = 0;
  for (let q = 0; q < ind.length; q += 4){
    const a = ind[q], b = ind[q + 1], c = ind[q + 2], d = ind[q + 3];
    // orientation from gradient normals
    const ax = P[a*3], ay = P[a*3+1], az = P[a*3+2];
    const e1x = P[b*3] - ax, e1y = P[b*3+1] - ay, e1z = P[b*3+2] - az;
    const e2x = P[c*3] - ax, e2y = P[c*3+1] - ay, e2z = P[c*3+2] - az;
    const fx = e1y * e2z - e1z * e2y, fy = e1z * e2x - e1x * e2z, fz = e1x * e2y - e1y * e2x;
    const nx2 = Nr[a*3] + Nr[b*3] + Nr[c*3] + Nr[d*3], ny2 = Nr[a*3+1] + Nr[b*3+1] + Nr[c*3+1] + Nr[d*3+1], nz2 = Nr[a*3+2] + Nr[b*3+2] + Nr[c*3+2] + Nr[d*3+2];
    if (fx * nx2 + fy * ny2 + fz * nz2 >= 0){ tris[t++] = a; tris[t++] = b; tris[t++] = c; tris[t++] = a; tris[t++] = c; tris[t++] = d; }
    else { tris[t++] = a; tris[t++] = c; tris[t++] = b; tris[t++] = a; tris[t++] = d; tris[t++] = c; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(Nr, 3));
  geo.setIndex(new THREE.BufferAttribute(tris, 1));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
};

/* Per-vertex attribute from a function of the model-space position. */
PM.vertexAttr = function(geo, name, size, fn){
  const p = geo.attributes.position.array, n = p.length / 3, out = new Float32Array(n * size), tmp = new Array(size);
  const nr = geo.attributes.normal.array;
  for (let i = 0; i < n; i++){
    fn(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], tmp, nr[i * 3], nr[i * 3 + 1], nr[i * 3 + 2]);
    for (let s = 0; s < size; s++) out[i * size + s] = tmp[s];
  }
  geo.setAttribute(name, new THREE.BufferAttribute(out, size));
};

/* Move geometry into a bone's local space, keeping model-space copy in aObj for patterns. */
PM.localize = function(geo, origin){
  const p = geo.attributes.position.array;
  geo.setAttribute('aObj', new THREE.BufferAttribute(p.slice(), 3));
  for (let i = 0; i < p.length; i += 3){ p[i] -= origin[0]; p[i + 1] -= origin[1]; p[i + 2] -= origin[2]; }
  geo.attributes.position.needsUpdate = true; geo.computeBoundingSphere(); geo.computeBoundingBox();
};

function distSeg(x, y, z, s){
  const abx = s.b[0] - s.a[0], aby = s.b[1] - s.a[1], abz = s.b[2] - s.a[2];
  const apx = x - s.a[0], apy = y - s.a[1], apz = z - s.a[2];
  const l2 = abx * abx + aby * aby + abz * abz;
  let t = l2 > 0 ? (apx * abx + apy * aby + apz * abz) / l2 : 0; t = Math.max(0, Math.min(1, t));
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
/* segs: [{bone, a, b, r, gate?(x,y,z)}] — inverse-distance weights, top 4. */
PM.skinWeights = function(geo, segs){
  const p = geo.attributes.position.array, n = p.length / 3;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const ws = new Float32Array(segs.length);
  for (let v = 0; v < n; v++){
    const x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2];
    for (let s = 0; s < segs.length; s++){
      const sg = segs[s]; let g = sg.gate ? sg.gate(x, y, z, v) : 1;
      if (g <= 0){ ws[s] = 0; continue; }
      const d = distSeg(x, y, z, sg) / sg.r;
      ws[s] = g / Math.pow(d + 0.35, 5);
    }
    let tot = 0;
    for (let slot = 0; slot < 4; slot++){
      let best = -1, bw = 0;
      for (let s = 0; s < segs.length; s++) if (ws[s] > bw){ bw = ws[s]; best = s; }
      if (best < 0){ si[v * 4 + slot] = segs[0].bone; sw[v * 4 + slot] = 0; continue; }
      si[v * 4 + slot] = segs[best].bone; sw[v * 4 + slot] = bw; tot += bw; ws[best] = 0;
    }
    if (tot <= 0){ sw[v * 4] = 1; tot = 1; }
    for (let slot = 0; slot < 4; slot++) sw[v * 4 + slot] /= tot;
  }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
};

/* CPU gradient noise (Perlin) */
const perm = new Uint8Array(512);
(function(){ const p = []; for (let i = 0; i < 256; i++) p[i] = i; let s = 1337; for (let i = 255; i > 0; i--){ s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; })();
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
function grad3(h, x, y, z){ const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); }
PM.noise = function(x, y, z){
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, Bq = perm[X + 1] + Y, BA = perm[Bq] + Z, BB = perm[Bq + 1] + Z;
  const L = (a, b, t) => a + t * (b - a);
  return L(L(L(grad3(perm[AA] & 15, x, y, z), grad3(perm[BA] & 15, x - 1, y, z), u), L(grad3(perm[AB] & 15, x, y - 1, z), grad3(perm[BB] & 15, x - 1, y - 1, z), u), v),
           L(L(grad3(perm[AA + 1] & 15, x, y, z - 1), grad3(perm[BA + 1] & 15, x - 1, y, z - 1), u), L(grad3(perm[AB + 1] & 15, x, y - 1, z - 1), grad3(perm[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
};
PM.smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
PM.rng = function(seed){ return function(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

/* Two-bone IK. upper/lower are THREE.Bones; end is the lower bone's child joint (Object3D). pole is a world-space direction for the middle joint. */
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _r = new THREE.Vector3();
function aimBone(bone, childLocalPos, worldDir){
  bone.parent.getWorldQuaternion(_qp);
  _r.copy(worldDir).applyQuaternion(_qp.invert()).normalize();
  _e.copy(childLocalPos).normalize();
  bone.quaternion.setFromUnitVectors(_e, _r);
  bone.updateMatrixWorld(true);
}
PM.aimBone = aimBone;
PM.ik2 = function(upper, lower, endLocal, target, pole, l1, l2){
  upper.getWorldPosition(_a);
  _d.copy(target).sub(_a);
  let dist = _d.length();
  const maxL = (l1 + l2) * 0.999, minL = Math.abs(l1 - l2) * 1.05 + 1e-4;
  dist = Math.max(minL, Math.min(maxL, dist));
  _d.normalize();
  const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _p.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_p.lengthSq() < 1e-8) _p.set(0, 0, 1).addScaledVector(_d, -_d.z);
  _p.normalize();
  _b.copy(_a).addScaledVector(_d, cosA * l1).addScaledVector(_p, sinA * l1); // mid joint
  _c.copy(_a).addScaledVector(_d, dist); // effective end
  _t.copy(_b).sub(_a); aimBone(upper, lower.position, _t);
  _t.copy(_c).sub(_b); aimBone(lower, endLocal, _t);
};
})();
