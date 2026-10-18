/* People: SDF-sculpted clothed bodies with a skeleton, IK legs/arms and procedural motion. Face +z, feet on y=0. */
(function(){
'use strict';
const PM = window.PM = window.PM || {};
const V3 = THREE.Vector3, TAU = Math.PI * 2;
const ss = (a, b, x) => PM.smoothstep(a, b, x);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

PM.PEOPLE = {
  marta: { name: 'Marta', h: 1.65, sex: 'f', belly: 0, skin: '#c99271', lips: '#a8625a', hair: '#24160f', hairStyle: 'pony', top: '#f3f2ed', pants: '#3b6c35', print: true, pantsStyle: 'wide', shoes: '#f1efe8', iris: '#3f2514', brows: '#2a1a12' },
  giulia: { name: 'Giulia', h: 1.68, sex: 'f', belly: 0, skin: '#e7bfa2', lips: '#c07a72', hair: '#7a4a28', hairStyle: 'long', top: '#d79d3e', pants: '#2c3955', print: false, pantsStyle: 'slim', shoes: '#ece9e2', iris: '#4f6b3a', brows: '#5a3820' },
  franco: { name: 'Franco', h: 1.73, sex: 'm', belly: 0.06, skin: '#e0b397', lips: '#b07068', hair: '#c9c5bf', hairStyle: 'short', top: '#7c8fa6', pants: '#4a4f45', print: false, pantsStyle: 'slim', shoes: '#4a3a2e', iris: '#4d5b66', brows: '#a8a39c', cap: '#5a5f52' }
};

function parts(P){
  const k = P.h / 1.65, m = P.sex === 'm';
  const S = (x, y, z) => [x * k * (m ? 1.06 : 1), y * k, z * k];
  const L = {};
  L.hips = S(0, 0.93, 0); L.spine = S(0, 1.06, 0); L.chest = S(0, 1.22, 0); L.neck = S(0, 1.425, -0.012); L.head = S(0, 1.52, 0.0);
  for (const [sd, sx] of [['L', 1], ['R', -1]]){
    L['ua' + sd] = S(sx * (m ? 0.18 : 0.172), 1.385, -0.012); L['fa' + sd] = S(sx * 0.212, 1.115, -0.022); L['ha' + sd] = S(sx * 0.252, 0.88, 0.0); L['he' + sd] = S(sx * 0.262, 0.795, 0.012);
    L['th' + sd] = S(sx * 0.09, 0.9, 0.0); L['sh' + sd] = S(sx * 0.092, 0.48, 0.012); L['ft' + sd] = S(sx * 0.092, 0.078, -0.016); L['to' + sd] = S(sx * 0.092, 0.022, 0.118);
  }
  return { k, S, L, m };
}

/* Region-tagged body parts; returns { all, regions:{skin,top,pants,shoes} } */
function bodyShapes(P, Q){
  const { S, m } = Q;
  const reg = { skin: new PM.Shape(), top: new PM.Shape(), pants: new PM.Shape(), shoes: new PM.Shape() };
  const all = new PM.Shape();
  const put = (r, fn) => { fn(all); fn(reg[r]); };
  const wide = P.pantsStyle === 'wide';
  const fold = (x, y, z) => wide ? 0.0035 * Math.sin(Math.atan2(z, x - Math.sign(x) * 0.1) * 9 + y * 6) * ss(0.85, 0.6, y) : 0;
  // trousers
  put('pants', s => s.ell(S(0, 0.94, -0.01), [0.168, 0.12, 0.118], { k: 0.04 }));
  put('pants', s => { for (const sx of [-1, 1]) s.ell(S(sx * 0.07, 0.89, -0.065), [0.082, 0.09, 0.07], { k: 0.04 }); });
  for (const sx of [-1, 1]){
    if (wide) put('pants', s => s.cone(S(sx * 0.093, 0.9, 0.0), S(sx * 0.107, 0.11, 0.0), 0.094, 0.082, { k: 0.04, disp: fold, dispAmp: 0.004 }));
    else { put('pants', s => s.cone(S(sx * 0.09, 0.9, 0.0), S(sx * 0.092, 0.5, 0.01), 0.088, 0.058, { k: 0.04 })); put('pants', s => s.cone(S(sx * 0.092, 0.5, 0.01), S(sx * 0.092, 0.1, -0.008), 0.056, 0.045, { k: 0.03 })); }
    put('skin', s => s.cone(S(sx * 0.092, 0.15, -0.002), S(sx * 0.092, 0.07, -0.012), 0.036, 0.032, { k: 0.015 }));
    put('shoes', s => s.ell(S(sx * 0.092, 0.046, 0.04), [0.046, 0.043, 0.118], { k: 0.02 }));
    put('shoes', s => s.box(S(sx * 0.092, 0.014, 0.042), [0.044, 0.012, 0.118], 0.01, { k: 0.01 }));
  }
  // torso (top)
  put('top', s => s.ell(S(0, 1.07, 0), [0.135 + P.belly, 0.11, 0.095 + P.belly], { k: 0.05 }));
  put('top', s => s.ell(S(0, 1.22, 0), [m ? 0.165 : 0.152, 0.158, 0.103], { k: 0.05 }));
  if (!m) put('top', s => { for (const sx of [-1, 1]) s.ell(S(sx * 0.056, 1.235, 0.05), [0.056, 0.052, 0.045], { k: 0.05 }); });
  if (P.belly) put('top', s => s.ell(S(0, 1.08, 0.05), [0.13, 0.1, 0.09], { k: 0.06 }));
  put('top', s => s.ell(S(0, 1.37, -0.02), [m ? 0.17 : 0.155, 0.055, 0.08], { k: 0.04 }));
  put('top', s => s.ell(S(0, 1.02, 0.0), [0.15 + P.belly * 0.7, 0.045, 0.108 + P.belly * 0.6], { k: 0.03 })); // hem over the waistband
  for (const sx of [-1, 1]){
    put('top', s => s.ell(S(sx * (m ? 0.168 : 0.158), 1.37, -0.012), [0.052, 0.046, 0.055], { k: 0.04 }));
    put('top', s => s.cone(S(sx * 0.172, 1.36, -0.012), S(sx * 0.2, 1.22, -0.016), 0.056, 0.052, { k: 0.03 })); // sleeve
    put('skin', s => s.cone(S(sx * 0.18, 1.33, -0.012), S(sx * 0.212, 1.115, -0.022), 0.041, 0.033, { k: 0.025 }));
    put('skin', s => s.cone(S(sx * 0.212, 1.115, -0.022), S(sx * 0.252, 0.89, 0.0), 0.033, 0.024, { k: 0.02 }));
    put('skin', s => s.ell(S(sx * 0.222, 1.05, -0.018), [0.036, 0.07, 0.034], { k: 0.03, rot: [0, 0, sx * 0.17] }));
    put('skin', s => s.ell(S(sx * 0.258, 0.834, 0.006), [0.017, 0.05, 0.034], { k: 0.02, rot: [0, 0, sx * 0.17] }));
    put('skin', s => s.cone(S(sx * 0.247, 0.866, 0.024), S(sx * 0.243, 0.826, 0.044), 0.011, 0.009, { k: 0.012 }));
  }
  put('skin', s => s.cone(S(0, 1.37, -0.015), S(0, 1.53, 0.0), m ? 0.058 : 0.05, m ? 0.05 : 0.044, { k: 0.03 }));
  return { all, reg };
}

const EYE = { x: 0.0305, y: 1.582, z: 0.0655, r: 0.0122 };
/* Head as a loft: half-width, front and back profiles (metres) sampled from chin to crown, after standard female head proportions. */
const HEAD_PROF = [
  // y,     halfW,  front,  back
  [1.462, 0.010, 0.050, 0.030],
  [1.470, 0.016, 0.062, 0.018],
  [1.480, 0.024, 0.068, 0.000],
  [1.495, 0.033, 0.068, -0.025],
  [1.510, 0.040, 0.073, -0.045],
  [1.525, 0.046, 0.079, -0.062],
  [1.540, 0.051, 0.081, -0.078],
  [1.555, 0.056, 0.079, -0.090],
  [1.570, 0.061, 0.074, -0.098],
  [1.585, 0.065, 0.072, -0.103],
  [1.600, 0.068, 0.081, -0.106],
  [1.615, 0.070, 0.085, -0.107],
  [1.635, 0.071, 0.084, -0.104],
  [1.655, 0.068, 0.077, -0.095],
  [1.672, 0.060, 0.062, -0.080],
  [1.685, 0.046, 0.042, -0.058],
  [1.694, 0.026, 0.018, -0.030],
  [1.698, 0.008, 0.004, -0.008]
];
function profAt(y){
  const T = HEAD_PROF; if (y <= T[0][0]) return T[0]; if (y >= T[T.length - 1][0]) return T[T.length - 1];
  let i = 0; while (T[i + 1][0] < y) i++;
  const p0 = T[Math.max(0, i - 1)], p1 = T[i], p2 = T[i + 1], p3 = T[Math.min(T.length - 1, i + 2)];
  const t = (y - p1[0]) / (p2[0] - p1[0]), t2 = t * t, t3 = t2 * t;
  const cr = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
  return [y, cr(1), cr(2), cr(3)];
}
function headLoft(k, wm){
  const y0 = HEAD_PROF[0][0] * k, y1 = HEAD_PROF[HEAD_PROF.length - 1][0] * k;
  return (x, y, z) => {
    const yy = Math.max(y0, Math.min(y1, y)) / k;
    const p = profAt(yy);
    const a = p[1] * k * wm, zf = p[2] * k, zb = p[3] * k;
    const zc = (zf + zb) / 2, d = (zf - zb) / 2;
    const u = Math.abs(x) / Math.max(a, 1e-4), v = Math.abs(z - zc) / Math.max(d, 1e-4);
    const n = 2.35;
    const r = Math.pow(Math.pow(u, n) + Math.pow(v, n), 1 / n);
    let dist = (r - 1) * Math.min(a, d) * 0.85;
    if (y > y1) dist = Math.max(dist, y - y1);
    if (y < y0) dist = Math.max(dist, (y0 - y) - 0.0);
    return dist;
  };
}
function headShapes(P, Q){
  const { S, m, k } = Q;
  const skin = new PM.Shape(), lips = new PM.Shape(), all = new PM.Shape();
  const put = (r, fn) => { fn(all); fn(r === 'lips' ? lips : skin); };
  const H = (x, y, z) => S(x, y, z);
  const wm = m ? 1.07 : 1;
  const loft = headLoft(k, wm);
  put('skin', s => s.custom(loft, H(0, 1.58, -0.01), 0.14, { k: 0.01 }));
  for (const sx of [-1, 1]){
    put('skin', s => s.ell(H(sx * 0.04 * wm, 1.566, 0.052), [0.018, 0.014, 0.02], { k: 0.04 })); // cheek fullness
    put('skin', s => s.ell(H(sx * 0.067 * wm, 1.577, -0.012), [0.0075, 0.022, 0.014], { k: 0.012, rot: [0, 0, sx * 0.1] })); // ear
    put('skin', s => s.ell(H(sx * EYE.x, EYE.y, 0.082), [0.0175, 0.0115, 0.013], { sub: true, k: 0.012 })); // eye socket
    put('skin', s => s.ell(H(sx * EYE.x, EYE.y + 0.0042, EYE.z), [0.0142, 0.0068, 0.0134], { k: 0.0035 })); // upper lid
    put('skin', s => s.ell(H(sx * EYE.x, EYE.y - 0.0056, EYE.z), [0.0136, 0.0046, 0.013], { k: 0.0035 })); // lower lid
    put('skin', s => s.ell(H(sx * 0.0096, 1.5515, 0.0905), [0.006, 0.0055, 0.0058], { k: 0.006 })); // nostril wings
  }
  put('skin', s => s.cone(H(0, 1.597, 0.08), H(0, 1.56, 0.0955), m ? 0.0078 : 0.0062, 0.008, { k: 0.012 })); // nose bridge
  put('skin', s => s.ell(H(0, 1.5555, 0.0965), [0.0094, 0.0082, 0.0086], { k: 0.008 })); // nose tip
  for (const sx of [-1, 1]){
    put('skin', s => s.sph(H(sx * EYE.x, EYE.y, EYE.z), EYE.r + 0.0004, { sub: true, k: 0.0015 })); // eyeball seat
    put('skin', s => s.ell(H(sx * EYE.x, EYE.y - 0.0004, EYE.z + 0.0125), [0.0134, 0.0041, 0.011], { sub: true, k: 0.0022, rot: [0, 0, -sx * 0.08] })); // almond opening
  }
  put('lips', s => s.ell(H(0, 1.5288, 0.0812), [0.0162, 0.0029, 0.0055], { k: 0.006 }));
  put('lips', s => s.ell(H(0, 1.5207, 0.0795), [0.0142, 0.0035, 0.0056], { k: 0.006 }));
  all.cone(H(-0.017, 1.5256, 0.0835), H(0.017, 1.5256, 0.0835), 0.001, 0.001, { sub: true, k: 0.0022 });
  put('skin', s => s.cone(H(0, 1.445, -0.012), H(0, 1.515, -0.01), m ? 0.052 : 0.046, m ? 0.052 : 0.047, { k: 0.03 })); // upper neck overlap
  return { all, skin, lips };
}

function hairShape(P, Q){
  const { S } = Q; const s = new PM.Shape();
  const n = (x, y, z) => 0.0015 * PM.noise(x * 60, y * 25, z * 60) + 0.0007 * PM.noise(x * 200, y * 80, z * 200);
  if (P.hairStyle === 'short'){
    s.ell(S(0, 1.612, -0.016), [0.081, 0.094, 0.1], { k: 0.02, disp: n, dispAmp: 0.004 });
    s.ell(S(0, 1.585, 0.12), [0.1, 0.055, 0.075], { sub: true, k: 0.02 });
    s.ell(S(0, 1.5, 0.03), [0.12, 0.065, 0.12], { sub: true, k: 0.02 });
    return s;
  }
  const loft = headLoft(Q.k, Q.m ? 1.07 : 1);
  s.custom((x, y, z) => loft(x / 1.075, (y - 1.585 * Q.k) / 1.06 + 1.585 * Q.k, (z + 0.012) / 1.07) - 0.0035 + n(x, y, z), S(0, 1.6, -0.01), 0.15, { k: 0.01 });
  s.ell(S(0, 1.525, 0.16), [0.14, 0.17, 0.122], { sub: true, k: 0.016 }); // hairline
  for (const sx of [-1, 1]) s.ell(S(sx * 0.074, 1.562, -0.004), [0.026, 0.034, 0.036], { sub: true, k: 0.014 }); // ears free
  s.ell(S(0, 1.485, 0.03), [0.13, 0.06, 0.12], { sub: true, k: 0.02 });
  if (P.hairStyle === 'long'){
    s.ell(S(0, 1.48, -0.06), [0.09, 0.17, 0.055], { k: 0.04, disp: n, dispAmp: 0.004 });
    for (const sx of [-1, 1]) s.cone(S(sx * 0.072, 1.6, 0.02), S(sx * 0.08, 1.4, -0.02), 0.022, 0.018, { k: 0.03 });
  }
  if (P.hairStyle === 'pony'){ s.ell(S(0, 1.66, -0.095), [0.03, 0.026, 0.022], { k: 0.02 }); }
  return s;
}
function ponyShape(Q){
  const { S } = Q; const s = new PM.Shape();
  const pts = [[0, 1.66, -0.112], [0, 1.62, -0.135], [0.004, 1.55, -0.14], [0.008, 1.47, -0.128], [0.012, 1.4, -0.118]];
  const rad = [0.02, 0.026, 0.027, 0.02, 0.008];
  const n = (x, y, z) => 0.0022 * PM.noise(x * 120, y * 18, z * 120);
  for (let i = 0; i < pts.length - 1; i++) s.cone(S(...pts[i]), S(...pts[i + 1]), rad[i], rad[i + 1], { k: 0.02, disp: n, dispAmp: 0.003 });
  return { s, root: S(...pts[0]) };
}


/* ---------- Stylised head ---------- */
function stylisedHead(P, Q, headBone, hd){
  const { S, k, m } = Q;
  const skinM = new THREE.MeshStandardMaterial({ color: P.skin, roughness: 0.62 });
  const darkM = new THREE.MeshStandardMaterial({ color: '#24150e', roughness: 0.35 });
  const browM = new THREE.MeshStandardMaterial({ color: P.brows, roughness: 0.8 });
  const whiteM = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const lipM = new THREE.MeshStandardMaterial({ color: '#8f3b37', roughness: 0.5 });
  const blushM = new THREE.MeshBasicMaterial({ color: '#f08a86', transparent: true, opacity: 0.35, depthWrite: false });
  const hs = new PM.Shape();
  hs.ell(S(0, 1.618, 0.004), [0.084, 0.098, 0.088], { k: 0.03 });
  hs.ell(S(0, 1.556, 0.024), [m ? 0.064 : 0.058, 0.056, 0.064], { k: 0.05 });
  hs.cone(S(0, 1.445, -0.012), S(0, 1.54, -0.004), m ? 0.05 : 0.045, m ? 0.05 : 0.046, { k: 0.03 });
  for (const sx of [-1, 1]) hs.ell(S(sx * 0.083, 1.6, -0.006), [0.009, 0.019, 0.014], { k: 0.012 });
  const g = PM.meshShape(hs, 0.003);
  const front = (x, y) => { let z = 0.2 * k; for (let i = 0; i < 80; i++){ const d = hs.eval(x, y, z); if (d < 0.0005) break; z -= Math.max(0.0006, d * 0.9); } return z; };
  const normalAt = (x, y, z) => { const e = 0.001; return new V3(hs.eval(x + e, y, z) - hs.eval(x - e, y, z), hs.eval(x, y + e, z) - hs.eval(x, y - e, z), hs.eval(x, y, z + e) - hs.eval(x, y, z - e)).normalize(); };
  PM.localize(g, hd);
  const headMesh = new THREE.Mesh(g, skinM); headMesh.castShadow = true; headMesh.receiveShadow = true; headBone.add(headMesh);
  const place = (mesh, x, y, out, rotZ) => {
    const z = front(x, y), n = normalAt(x, y, z);
    mesh.position.set(x - hd[0], y - hd[1], z - hd[2]).addScaledVector(n, out || 0);
    mesh.quaternion.setFromUnitVectors(new V3(0, 0, 1), n); if (rotZ) mesh.rotateZ(rotZ);
    headBone.add(mesh); return mesh;
  };
  const eyes = [];
  for (const sx of [-1, 1]){
    const eg = new THREE.SphereGeometry(1, 20, 14);
    const eye = new THREE.Mesh(eg, darkM); eye.scale.set(0.0105 * k, 0.0145 * k, 0.0055 * k);
    place(eye, sx * 0.033 * k, 1.606 * k, -0.0005); eyes.push(eye);
    const hi = new THREE.Mesh(new THREE.SphereGeometry(0.0032 * k, 8, 6), whiteM); hi.position.set(0.32, 0.4, 0.9); eye.add(hi); hi.scale.set(1 / (0.0105 * k) * 0.0032 * k / 0.0032, 1 / (0.0145 * k) * 0.0032 * k / 0.0032, 1 / (0.0055 * k) * 0.0032 * k / 0.0032);
    const hi2 = new THREE.Mesh(new THREE.SphereGeometry(0.0015 * k, 6, 5), whiteM); hi2.position.set(-0.35, -0.42, 0.9); eye.add(hi2); hi2.scale.copy(hi.scale);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0024 * k, 0.019 * k, 3, 6), browM); brow.rotation.z = Math.PI / 2;
    const bw = new THREE.Group(); bw.add(brow); place(bw, sx * 0.034 * k, 1.634 * k, 0.0012, -sx * 0.12);
    const bl = new THREE.Mesh(new THREE.CircleGeometry(0.013 * k, 20), blushM); place(bl, sx * 0.05 * k, 1.574 * k, 0.0015);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skinM); nose.scale.set(0.0085 * k, 0.0068 * k, 0.0075 * k); place(nose, 0, 1.58 * k, 0.001);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.0145 * k, 0.0022 * k, 6, 18, 2.1), lipM); smile.rotation.z = Math.PI + (Math.PI - 2.1) / 2;
  const sg = new THREE.Group(); sg.add(smile); smile.position.y = 0.006 * k; place(sg, 0, 1.551 * k, 0.0008);
  // hair
  const hsh = new PM.Shape();
  const nz = (x, y, z) => 0.0016 * PM.noise(x * 60, y * 25, z * 60);
  hsh.ell(S(0, 1.624, -0.004), [0.0885, 0.1035, 0.0925], { k: 0.02, disp: nz, dispAmp: 0.002 });
  hsh.ell(S(0, 1.565, 0.135), [0.112, 0.105, 0.095], { sub: true, k: 0.022 }); // face opening
  for (const sx of [-1, 1]) hsh.ell(S(sx * 0.09, 1.585, 0.0), [0.03, 0.034, 0.04], { sub: true, k: 0.012 }); // ears
  hsh.ell(S(0, 1.52, 0.02), [0.13, 0.06, 0.12], { sub: true, k: 0.02 });
  if (P.hairStyle === 'long'){ hsh.ell(S(0, 1.5, -0.065), [0.088, 0.17, 0.05], { k: 0.04, disp: nz, dispAmp: 0.002 }); }
  if (P.hairStyle === 'pony') hsh.ell(S(0, 1.665, -0.09), [0.03, 0.026, 0.024], { k: 0.02 });
  const hg2 = PM.meshShape(hsh, 0.0032); PM.localize(hg2, hd);
  const hairMat = PM.hairMaterial(P.hair);
  const hair = new THREE.Mesh(hg2, hairMat); hair.castShadow = true; headBone.add(hair);
  let pony = null;
  if (P.hairStyle === 'pony'){
    const ps = new PM.Shape();
    const pts = [[0, 1.668, -0.1], [0, 1.63, -0.125], [0.004, 1.56, -0.132], [0.008, 1.48, -0.122], [0.012, 1.41, -0.112]];
    const rad = [0.021, 0.027, 0.028, 0.021, 0.009];
    for (let i = 0; i < pts.length - 1; i++) ps.cone(S(...pts[i]), S(...pts[i + 1]), rad[i], rad[i + 1], { k: 0.02, disp: (x, y, z) => 0.002 * PM.noise(x * 120, y * 18, z * 120), dispAmp: 0.003 });
    const root = S(...pts[0]);
    const pg = PM.meshShape(ps, 0.0034); PM.localize(pg, root);
    pony = new THREE.Bone(); pony.position.set(root[0] - hd[0], root[1] - hd[1], root[2] - hd[2]); headBone.add(pony);
    const pm = new THREE.Mesh(pg, hairMat); pm.castShadow = true; pony.add(pm);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.02 * k, 0.005, 6, 18), new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.5 }));
    tie.position.set(0, -0.004, -0.004); tie.rotation.x = 1.2; pony.add(tie);
    pony.userData.ang = new V3(); pony.userData.vel = new V3(); pony.userData.prev = new V3(); pony.userData.prevV = new V3();
  }
  if (P.cap){
    const cs = new PM.Shape(); cs.ell(S(0, 1.67, 0.0), [0.096, 0.064, 0.1], { k: 0.01 }); cs.box(S(0, 1.61, 0), [0.2, 0.06, 0.2], 0, { sub: true, k: 0.004 });
    cs.ell(S(0, 1.672, 0.09), [0.085, 0.008, 0.06], { k: 0.01 });
    const cg = PM.meshShape(cs, 0.004); PM.localize(cg, hd);
    const cap = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: P.cap, roughness: 0.9 })); cap.castShadow = true; headBone.add(cap);
  }
  return { headMesh, eyes, hair, pony };
}

function mkBone(name, pos, parent){ const b = new THREE.Bone(); b.name = name; b.userData.rest = pos.slice(); const pp = parent ? parent.userData.rest : [0, 0, 0]; b.position.set(pos[0] - pp[0], pos[1] - pp[1], pos[2] - pp[2]); if (parent) parent.add(b); return b; }
const C = c => new THREE.Color(c);

PM.buildHuman = function(key, q){
  q = q || 1;
  const P = PM.PEOPLE[key], Q = parts(P), L = Q.L;
  const root = new THREE.Group(); root.name = key;
  const bones = [], by = {};
  const add = (n, par) => { const b = mkBone(n, L[n], par ? by[par] : null); bones.push(b); by[n] = b; return b; };
  add('hips'); add('spine', 'hips'); add('chest', 'spine'); add('neck', 'chest'); add('head', 'neck');
  for (const sd of ['L', 'R']){ add('ua' + sd, 'chest'); add('fa' + sd, 'ua' + sd); add('ha' + sd, 'fa' + sd); add('he' + sd, 'ha' + sd); add('th' + sd, 'hips'); add('sh' + sd, 'th' + sd); add('ft' + sd, 'sh' + sd); add('to' + sd, 'ft' + sd); }
  root.add(by.hips);
  const mat = PM.humanMaterial();
  // body
  const BS = bodyShapes(P, Q);
  const geo = PM.meshShape(BS.all, 0.0072 * q);
  const cols = { skin: C(P.skin), top: C(P.top), pants: C(P.pants), shoes: C(P.shoes) };
  const regs = ['skin', 'top', 'pants', 'shoes'];
  const regOf = (x, y, z) => { let best = 'skin', bd = 1e9; for (const r of regs){ const d = BS.reg[r].eval(x, y, z); if (d < bd){ bd = d; best = r; } } return best; };
  const regCache = [];
  PM.vertexAttr(geo, 'color', 3, (x, y, z, o) => {
    const r = regOf(x, y, z); regCache.push(r);
    let c = cols[r]; if (r === 'shoes' && y < 0.024 * Q.k) c = C('#d9d6cf');
    if (r === 'shoes' && key === 'franco' && y < 0.024) c = C('#2a2420');
    o[0] = c.r; o[1] = c.g; o[2] = c.b;
  });
  let ri = 0;
  PM.vertexAttr(geo, 'aMat', 4, (x, y, z, o) => {
    const r = regCache[ri++];
    o[0] = r === 'skin' ? 0.5 : r === 'shoes' ? 0.6 : r === 'top' ? 0.92 : 0.85;
    o[1] = r === 'pants' && P.print ? 1 : 0; o[2] = r === 'top' || r === 'pants' ? 1 : 0; o[3] = r === 'skin' ? 1 : 0;
  });
  PM.localize(geo, [0, 0, 0]);
  const R = n => by[n].userData.rest, idx = n => bones.indexOf(by[n]);
  const k = Q.k;
  const notArm = (x, y, z, v) => (regCache[v] === 'skin' && Math.abs(x) > 0.135 * k && y < 1.33 * k && y > 0.7 * k) ? 0 : 1;
  const segs = [
    { bone: idx('hips'), a: R('hips'), b: [0, 0.86 * k, 0], r: 0.13, gate: notArm },
    { bone: idx('spine'), a: [0, 0.98 * k, 0], b: [0, 1.12 * k, 0], r: 0.12, gate: notArm },
    { bone: idx('chest'), a: [0, 1.16 * k, 0], b: [0, 1.38 * k, 0], r: 0.14, gate: (x, y, z, v) => notArm(x, y, z, v) || y > 1.25 * k ? 1 : 0 },
    { bone: idx('neck'), a: R('neck'), b: R('head'), r: 0.045 },
    { bone: idx('head'), a: R('head'), b: [0, 1.6 * k, 0], r: 0.05 }
  ];
  for (const [sd, sx] of [['L', 1], ['R', -1]]){
    const side = (x) => ss(-0.01, 0.02, x * sx);
    const armGate = (x, y, z, v) => (regCache[v] === 'pants' || regCache[v] === 'shoes') ? 0 : ss(0.125 * k, 0.15 * k, x * sx) * (regCache[v] === 'top' ? ss(1.3 * k, 1.24 * k, y) * ss(0.13 * k, 0.165 * k, x * sx) + ss(1.24 * k, 1.3 * k, y) * 0.0 : 1);
    segs.push({ bone: idx('ua' + sd), a: R('ua' + sd), b: R('fa' + sd), r: 0.045, gate: (x, y, z, v) => (regCache[v] === 'pants' || regCache[v] === 'shoes') ? 0 : regCache[v] === 'top' ? ss(1.17 * k, 1.25 * k, y) * ss(0.14 * k, 0.17 * k, x * sx) : ss(0.12 * k, 0.15 * k, x * sx) });
    segs.push({ bone: idx('fa' + sd), a: R('fa' + sd), b: R('ha' + sd), r: 0.035, gate: armGate });
    segs.push({ bone: idx('ha' + sd), a: R('ha' + sd), b: R('he' + sd), r: 0.03, gate: armGate });
    segs.push({ bone: idx('th' + sd), a: R('th' + sd), b: R('sh' + sd), r: 0.08, gate: (x, y, z, v) => side(x) * ss(0.98 * k, 0.86 * k, y) * notArm(x, y, z, v) });
    segs.push({ bone: idx('sh' + sd), a: R('sh' + sd), b: R('ft' + sd), r: 0.06, gate: (x, y, z, v) => side(x) * notArm(x, y, z, v) });
    segs.push({ bone: idx('ft' + sd), a: R('ft' + sd), b: R('to' + sd), r: 0.045, gate: (x, y, z) => side(x) * ss(0.13 * k, 0.09 * k, y) });
  }
  PM.skinWeights(geo, segs);
  const body = new THREE.SkinnedMesh(geo, mat); body.castShadow = true; body.receiveShadow = true;
  geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.6; geo.boundingSphere.center.y = 0.9 * k;
  root.add(body); root.updateMatrixWorld(true);
  body.bind(new THREE.Skeleton(bones));
  // head: friendly stylised look (the first version's spirit), on the realistic body
  const hd = R('head');
  const st = stylisedHead(P, Q, by.head, hd);
  const headMesh = st.headMesh, eyes = st.eyes, lids = [], hair = st.hair, pony = st.pony;
  if (key === 'marta'){
    const br = new THREE.Mesh(new THREE.TorusGeometry(0.03 * k, 0.0022, 6, 20), new THREE.MeshStandardMaterial({ color: '#b3242a', roughness: 0.7 }));
    br.rotation.x = Math.PI / 2; br.position.set(0, -0.2 * k, 0.004); by.faL.add(br);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.028 * k, 0.005, 6, 20), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.6 }));
    tie.rotation.x = Math.PI / 2; tie.position.set(0, -0.205 * k, 0.004); by.faR.add(tie);
  }
  const handL = new THREE.Object3D(); handL.position.set(0, -0.045 * k, 0.01); by.haL.add(handL);
  const handR = new THREE.Object3D(); handR.position.set(0, -0.045 * k, 0.015); by.haR.add(handR);
  const H = {
    key, P, Q, root, bones: by, body, headMesh, regCache, eyes, lids, hair, pony, handL, handR, isHuman: true,
    len: { ua: dist(R('uaL'), R('faL')), fa: dist(R('faL'), R('haL')), th: dist(R('thL'), R('shL')), sh: dist(R('shL'), R('ftL')) },
    st: { pos: new V3(), heading: 0, speed: 0, phase: 0, pose: 'stand', poseW: { crouch: 0, kneel: 0, sit: 0 }, look: null, lookYaw: 0, lookPitch: 0,
      armL: null, armR: null, throwT: 0, blinkT: 1.5, blink: 0, t: Math.random() * 9, wave: 0, cheer: 0, seatY: 0.45, lean: 0, talk: 0, smileTilt: 0 }
  };
  return H;
};
function dist(a, b){ return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

const _w = new V3(), _w2 = new V3(), _t = new V3(), _pole = new V3(), _f = new V3(), _r = new V3(), _q = new THREE.Quaternion();
const UP = new V3(0, 1, 0);
PM.animateHuman = function(H, dt, getH){
  const s = H.st, by = H.bones, k = H.Q.k, L = H.Q.L;
  s.t += dt;
  const PW = s.poseW; for (const n in PW) PW[n] = damp(PW[n], s.pose === n ? 1 : 0, 6, dt);
  const stride = clamp(s.speed * 0.55, 0.0001, 0.78 * k);
  const moving = s.speed > 0.05 ? Math.min(1, s.speed / 0.6) : 0;
  if (s.speed > 0.05) s.phase = (s.phase + (s.speed / stride) * dt * 0.5) % 1;
  const gy = getH ? getH(s.pos.x, s.pos.z) : 0;
  H.root.position.set(s.pos.x, gy, s.pos.z); H.root.rotation.set(0, s.heading, 0);
  const hips = by.hips, hr = hips.userData.rest;
  const bob = moving * (Math.cos(s.phase * TAU * 2) * 0.012 - 0.008);
  const sway = moving * Math.sin(s.phase * TAU) * 0.012;
  const idleSway = (1 - moving) * Math.sin(s.t * 0.9) * 0.008;
  let hy = hr[1] + bob, hz = 0;
  hy = lerp(hy, 0.47 * k, PW.crouch); hy = lerp(hy, 0.52 * k, PW.kneel); hy = lerp(hy, s.seatY + 0.07 * k, PW.sit);
  hz += -0.07 * PW.crouch - 0.02 * PW.kneel - 0.06 * PW.sit;
  hips.position.set(sway + idleSway, hy, hz);
  hips.rotation.set(0.1 * PW.sit - 0.05 * PW.crouch, Math.sin(s.phase * TAU) * 0.09 * moving, Math.sin(s.phase * TAU) * 0.03 * moving + idleSway * 2);
  by.spine.rotation.set(0.04 * moving + 0.32 * PW.crouch + 0.12 * PW.kneel + s.lean * 0.5 - 0.06 * PW.sit, -Math.sin(s.phase * TAU) * 0.05 * moving, 0);
  by.chest.rotation.set(0.25 * PW.crouch + 0.1 * PW.kneel + s.lean * 0.5 + Math.sin(s.t * 1.6) * 0.012, -Math.sin(s.phase * TAU) * 0.08 * moving, -hips.rotation.z * 0.6);
  // head look
  let yaw = 0, pitch = 0;
  if (s.look){ by.head.getWorldPosition(_w); _t.copy(s.look).sub(_w); let a = Math.atan2(_t.x, _t.z) - s.heading; a = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI; yaw = clamp(a, -1.2, 1.2); pitch = clamp(-Math.atan2(_t.y, Math.hypot(_t.x, _t.z)), -0.5, 0.8); }
  s.lookYaw = damp(s.lookYaw, yaw, 5, dt); s.lookPitch = damp(s.lookPitch, pitch, 5, dt);
  const chestPitch = by.spine.rotation.x + by.chest.rotation.x;
  by.neck.rotation.set(s.lookPitch * 0.4 - chestPitch * 0.3, s.lookYaw * 0.45, 0);
  by.head.rotation.set(s.lookPitch * 0.6 - chestPitch * 0.3 + Math.sin(s.t * 6) * 0.03 * s.talk, s.lookYaw * 0.55, s.smileTilt + Math.sin(s.t * 1.1) * 0.02);
  // legs
  H.root.updateMatrixWorld(true);
  _f.set(Math.sin(s.heading), 0, Math.cos(s.heading));
  _r.set(Math.cos(s.heading), 0, -Math.sin(s.heading));
  for (const [sd, sx, off] of [['L', 1, 0], ['R', -1, 0.5]]){
    const ph = (s.phase + off) % 1, duty = 0.6;
    let dz = 0, lift = 0;
    if (moving > 0){
      if (ph < duty){ dz = stride * (0.5 - ph / duty); }
      else { const u = (ph - duty) / (1 - duty); const e = u * u * (3 - 2 * u); dz = stride * (-0.5 + e); lift = Math.sin(u * Math.PI) * 0.09 * moving; }
    }
    let lx = sx * 0.1 * k, lz = 0.0 + dz;
    // poses
    lx += sx * 0.06 * PW.crouch; lz += 0.02 * PW.crouch;
    if (sd === 'R') lz += -0.28 * k * PW.kneel; else lz += 0.12 * k * PW.kneel;
    lz += 0.3 * k * PW.sit; lx += sx * 0.04 * PW.sit;
    _w.set(lx, 0, lz); H.root.localToWorld(_w);
    _w.y = (getH ? getH(_w.x, _w.z) : 0) + lift;
    // ankle target: foot is ankle + offset; ankle sits ~0.078 above ground, slightly behind toe
    const ankle = _w2.copy(_w).addScaledVector(UP, 0.078 * k).addScaledVector(_f, -0.0);
    if (sd === 'R' && PW.kneel > 0.01){ ankle.addScaledVector(UP, 0.03 * PW.kneel); }
    _pole.copy(_f);
    PM.ik2(by['th' + sd], by['sh' + sd], by['ft' + sd].position, ankle, _pole, H.len.th, H.len.sh);
    // foot: aim toe forward and slightly down; kneeling back foot points down
    by['ft' + sd].getWorldPosition(_t);
    const toe = _w.clone().addScaledVector(_f, 0.12 * k).setY(_w.y + 0.02);
    if (moving > 0 && ph >= duty) toe.y += Math.sin(((ph - duty) / (1 - duty)) * Math.PI) * 0.03;
    if (sd === 'R' && PW.kneel > 0.5) toe.copy(_t).addScaledVector(_f, 0.04).addScaledVector(UP, -0.12);
    PM.aimBone(by['ft' + sd], by['to' + sd].position, toe.sub(_t));
  }
  // arms
  s.throwT = Math.max(0, s.throwT - dt);
  for (const [sd, sx] of [['L', 1], ['R', -1]]){
    const tgt = sd === 'L' ? s.armL : s.armR;
    const ua = by['ua' + sd], fa = by['fa' + sd], ha = by['ha' + sd];
    if (tgt){
      by.chest.updateMatrixWorld(true);
      _pole.copy(_f).multiplyScalar(-0.6).addScaledVector(_r, sx * 0.8).addScaledVector(UP, -0.3);
      PM.ik2(ua, fa, ha.position, tgt, _pole, H.len.ua, H.len.fa);
      ha.rotation.set(0.2, 0, 0);
    } else {
      const swing = Math.sin(s.phase * TAU + (sd === 'L' ? Math.PI : 0)) * 0.32 * moving;
      let ax = -swing + 0.04, az = sx * (-0.06 + 0.02 * Math.sin(s.t * 0.9)), fx = -0.12 - 0.2 * moving;
      if (sd === 'R' && s.throwT > 0){ const u = 1 - s.throwT / 0.7; if (u < 0.45){ ax = lerp(0, 2.6, u / 0.45); fx = -1.6; } else { ax = lerp(2.6, -1.6, Math.min(1, (u - 0.45) / 0.18)); fx = -0.2; } az = -0.25; }
      if (s.cheer > 0){ az = sx * 2.7; ax = 0; fx = -0.3; }
      if (sd === 'R' && s.wave > 0){ az = -2.4; ax = -0.3; fx = -0.6 + Math.sin(s.t * 12) * 0.4; }
      ax += 0.2 * PW.sit; fx -= 0.9 * PW.sit;
      ua.rotation.set(damp(ua.rotation.x, ax, s.throwT > 0 ? 30 : 10, dt), 0, damp(ua.rotation.z, az, 10, dt));
      ua.quaternion.setFromEuler(ua.rotation);
      fa.rotation.set(damp(fa.rotation.x, fx, 10, dt), 0, 0);
      ha.rotation.set(0.1, 0, 0);
    }
  }
  s.cheer = Math.max(0, s.cheer - dt); s.wave = Math.max(0, s.wave - dt);
  // ponytail swing
  if (H.pony){
    const pu = H.pony.userData; H.pony.getWorldPosition(_w);
    const v = _t.copy(_w).sub(pu.prev).divideScalar(Math.max(dt, 1e-3)); const a = _w2.copy(v).sub(pu.prevV).divideScalar(Math.max(dt, 1e-3));
    pu.prev.copy(_w); pu.prevV.copy(v);
    by.head.getWorldQuaternion(_q); a.applyQuaternion(_q.invert());
    const k2 = 70, c2 = 6, g = 0.012;
    pu.vel.x += (-pu.ang.x * k2 - pu.vel.x * c2 + clamp(a.z * g, -3, 3) * k2) * dt;
    pu.vel.z += (-pu.ang.z * k2 - pu.vel.z * c2 - clamp(a.x * g, -3, 3) * k2) * dt;
    pu.ang.x = clamp(pu.ang.x + pu.vel.x * dt, -0.6, 0.6); pu.ang.z = clamp(pu.ang.z + pu.vel.z * dt, -0.6, 0.6);
    H.pony.rotation.set(pu.ang.x - by.head.rotation.x * 0.8 - (by.spine.rotation.x + by.chest.rotation.x) * 0.6, 0, pu.ang.z);
  }
  // blink
  s.blinkT -= dt; if (s.blinkT < 0){ s.blink = 0.13; s.blinkT = 2.5 + Math.random() * 3; }
  s.blink = Math.max(0, s.blink - dt);
  const closed = s.blink > 0 || s.eyesClosed; H.eyes.forEach(e => { if (!e.userData.sy) e.userData.sy = e.scale.y; e.scale.y = closed ? e.userData.sy * 0.12 : e.userData.sy; });
};
PM.humanThrow = function(H){ H.st.throwT = 0.7; };
})();
