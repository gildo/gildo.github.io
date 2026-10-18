/* Dogs: SDF-sculpted bodies, skeleton, IK legs and procedural behaviours. Dogs face +z, root on the ground. */
(function(){
'use strict';
const PM = window.PM = window.PM || {};
const V3 = THREE.Vector3, TAU = Math.PI * 2;
const ss = (a, b, x) => PM.smoothstep(a, b, x);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const N = (x, y, z, f) => PM.noise(x * f + 11.3, y * f + 3.7, z * f + 7.1);

PM.BREEDS = {
  potty: { name: 'Potty', H: 0.3, L: 0.27, chestW: 0.128, chestH: 0.125, rumpW: 0.088, rumpH: 0.09, waist: 0.76, legR: 0.034, neckR: 0.088, compact: true,
    head: 'flat', hs: 1.08, muzzleLen: 0.0, ear: 'bat', earLen: 0.108, tail: 'stub', fluff: 0, eyeR: 0.0148, iris: '#22100a', mask: 'potty',
    fur: { pattern: 0, a: '#0a0605', b: '#2c1c11', white: '#efe8dd', grey: '#b3aba2', black: '#141010', pink: '#d88f95', sheen: '#9a8a7a' }, collar: '#c8323a', speed: 1 },
  olivia: { name: 'Olivia', H: 0.28, L: 0.27, compact: true, chestW: 0.11, chestH: 0.115, rumpW: 0.095, rumpH: 0.095, waist: 0.9, legR: 0.03, neckR: 0.078,
    head: 'flat', hs: 0.95, muzzleLen: -0.004, ear: 'rose', earLen: 0.05, tail: 'curl', fluff: 0, eyeR: 0.019, iris: '#2b180c', mask: 'pug',
    fur: { pattern: 1, a: '#b98a55', b: '#d9b07a', white: '#e6cfa6', grey: '#a0907a', black: '#1a1513', pink: '#c98884', sheen: '#e3c9a2' }, collar: '#d94f6a', speed: 0.9 },
  biscotto: { name: 'Biscotto', H: 0.56, L: 0.62, chestW: 0.15, chestH: 0.18, rumpW: 0.125, rumpH: 0.13, waist: 0.82, legR: 0.045, neckR: 0.09,
    head: 'long', hs: 1.25, muzzleLen: 0.1, ear: 'flop', earLen: 0.12, tail: 'long', tailLen: 0.38, fluff: 0.005, eyeR: 0.016, iris: '#3a2210', mask: 'golden',
    fur: { pattern: 1, a: '#b8803f', b: '#e1b067', white: '#f0d7a8', grey: '#cbb08a', black: '#1b1512', pink: '#c78a84', sheen: '#f2d6a0' }, collar: '#2f7d4f', speed: 1.25 },
  pepe: { name: 'Pepe', H: 0.22, L: 0.5, chestW: 0.085, chestH: 0.1, rumpW: 0.072, rumpH: 0.078, waist: 0.82, legR: 0.03, neckR: 0.055,
    head: 'long', hs: 0.85, muzzleLen: 0.085, ear: 'flop', earLen: 0.1, tail: 'thin', tailLen: 0.22, fluff: 0, eyeR: 0.013, iris: '#2b170a', mask: 'blacktan',
    fur: { pattern: 1, a: '#100c0a', b: '#2a1f19', white: '#a8652e', grey: '#5a4a40', black: '#0d0a08', pink: '#b57a74', sheen: '#7a6a62' }, collar: '#c23b2c', speed: 0.85, shortLegs: true },
  luna: { name: 'Luna', H: 0.5, L: 0.52, chestW: 0.12, chestH: 0.15, rumpW: 0.1, rumpH: 0.11, waist: 0.75, legR: 0.036, neckR: 0.075,
    head: 'long', hs: 1.05, muzzleLen: 0.085, ear: 'semi', earLen: 0.085, tail: 'long', tailLen: 0.36, fluff: 0.004, eyeR: 0.015, iris: '#5a3518', mask: 'collie',
    fur: { pattern: 1, a: '#0f0e0e', b: '#1d1b1b', white: '#f2f0ec', grey: '#808080', black: '#0b0a0a', pink: '#c98a86', sheen: '#9a9aa4' }, collar: '#3a6fd1', speed: 1.45 }
};

/* Landmarks */
function marks(B){
  const yc = B.H * 0.72, zc = B.L * 0.25, legLen = yc - B.chestH * 0.55;
  const fw = B.chestW * 0.6, hw = B.rumpW * 0.68;
  const S = [fw, yc + 0.005, zc + B.chestW * 0.15];
  const E = [fw * 1.06, yc - B.chestH * 0.85, S[2] - 0.012];
  const W = [fw * 1.0, Math.max(0.035, B.H * 0.15), S[2] + 0.005];
  const Pf = [fw, 0.012, S[2] + 0.035];
  const hz = -B.L * 0.4;
  const Hp = [hw, yc + 0.012, hz];
  const K = [hw * 1.05, yc * 0.52, hz + B.L * 0.12];
  const Hk = [hw, B.H * (B.shortLegs ? 0.2 : 0.25), hz - B.L * 0.11];
  const Ph = [hw, 0.012, Hk[2] + 0.03];
  const N0 = [0, yc + B.chestH * 0.55, zc + B.chestW * 0.75];
  const Hd = B.compact ? [0, B.H * 1.0 + 0.045 * B.hs, N0[2] + 0.035 * B.hs] : [0, B.H * 1.0 + 0.07 * B.hs, N0[2] + 0.06 * B.hs + (B.head === 'long' ? 0.03 : 0)];
  const hc = [0, Hd[1] + 0.022 * B.hs, Hd[2] + 0.03 * B.hs];
  return { yc, zc, legLen, fw, hw, S, E, W, Pf, Hp, K, Hk, Ph, N0, Hd, hc, hz };
}

/* Body SDF (without head) */
function bodyShape(B, M){
  const s = new PM.Shape();
  const fl = B.fluff ? { dispAmp: B.fluff, disp: (x, y, z) => B.fluff * N(x, y * 0.5, z, 16) } : {};
  const o = (k, extra) => Object.assign({ k }, fl, extra || {});
  s.ell([0, M.yc, M.zc], [B.chestW, B.chestH, B.chestW * 1.18], o(0.04));
  s.ell([0, M.yc - B.chestH * 0.35, M.zc + B.chestW * 0.55], [B.chestW * 0.85, B.chestH * 0.7, B.chestW * 0.6], o(0.04)); // brisket
  s.ell([0, M.yc + 0.005, -B.L * 0.08], [B.chestW * B.waist, B.chestH * B.waist * 0.92, B.L * 0.24], o(0.05)); // waist
  s.ell([0, M.yc + 0.008 + (B.compact ? 0.012 : 0), M.hz + B.rumpW * 0.15], [B.rumpW, B.rumpH, B.rumpW * 1.05], o(0.045)); // rump
  for (const sx of [-1, 1]){
    s.ell([sx * M.fw * 0.95, M.yc - 0.005, M.S[2] - 0.005], [B.legR * 1.5, B.chestH * 0.75, B.legR * 1.9], o(0.03)); // shoulder blade/upper arm
    s.cone([sx * M.E[0], M.E[1], M.E[2]], [sx * M.W[0], M.W[1], M.W[2]], B.legR * 1.05, B.legR * 0.78, o(0.02));
    s.cone([sx * M.fw * 0.98, M.yc - B.chestH * 0.25, M.S[2] - 0.004], [sx * M.E[0], M.E[1], M.E[2]], B.legR * 1.45, B.legR * 1.05, o(0.025));
    s.cone([sx * M.W[0], M.W[1], M.W[2]], [sx * M.Pf[0], 0.022, M.Pf[2] - 0.006], B.legR * 0.8, B.legR * 0.85, o(0.012));
    s.ell([sx * M.Pf[0], 0.022, M.Pf[2]], [B.legR * 1.05, B.legR * 0.7, B.legR * 1.3], o(0.012)); // paw
    // hind
    s.ell([sx * M.hw * 0.95, M.yc - 0.02, M.hz + 0.01], [B.rumpW * 0.55, B.rumpH * 1.05, B.rumpW * 0.85], o(0.035)); // thigh
    s.cone([sx * M.K[0], M.K[1], M.K[2]], [sx * M.Hk[0], M.Hk[1], M.Hk[2]], B.legR * 1.15, B.legR * 0.72, o(0.02));
    s.cone([sx * M.hw * 0.98, M.yc - B.rumpH * 0.5, M.hz + 0.01], [sx * M.K[0], M.K[1], M.K[2]], B.legR * 1.6, B.legR * 1.15, o(0.03));
    s.cone([sx * M.Hk[0], M.Hk[1], M.Hk[2]], [sx * M.Ph[0], 0.022, M.Ph[2] - 0.008], B.legR * 0.72, B.legR * 0.78, o(0.012));
    s.ell([sx * M.Ph[0], 0.021, M.Ph[2]], [B.legR * 0.98, B.legR * 0.66, B.legR * 1.2], o(0.012));
  }
  // neck
  s.cone(M.N0, [0, M.Hd[1] - 0.012, M.Hd[2] - 0.01], B.neckR, B.neckR * 0.88, o(0.05));
  if (B.mask === 'golden' || B.mask === 'collie') s.ell([0, M.N0[1] - 0.02, M.N0[2] + 0.02], [B.chestW * 0.95, B.chestH * 0.6, B.chestW * 0.6], o(0.05)); // ruff
  // tail base
  const tb = [0, M.yc + B.rumpH * 0.45, M.hz - B.rumpW * 0.75];
  if (B.tail === 'stub') s.ell([0, tb[1] - 0.01, tb[2] - 0.004], [0.022, 0.024, 0.02], { k: 0.015 });
  if (B.tail === 'curl') s.torus([0, tb[1] + 0.018, tb[2] + 0.015], 0.028, 0.017, { k: 0.015, rot: [0.3, 0, 0] });
  return s;
}
function tailSegs(B, M){
  const tb = [0, M.yc + B.rumpH * 0.45, M.hz - B.rumpW * 0.75];
  if (B.tail !== 'long' && B.tail !== 'thin') return null;
  const L = B.tailLen, pts = [tb];
  for (let i = 1; i <= 3; i++){ const t = i / 3; pts.push([0, tb[1] - L * 0.55 * t * t + L * 0.1 * t, tb[2] - L * 0.8 * t]); }
  return pts;
}

/* Head SDF in model coords */
function headShape(B, M){
  const s = new PM.Shape(); const c = M.hc, h = B.hs;
  const at = (x, y, z) => [c[0] + x * h, c[1] + y * h, c[2] + z * h];
  const fl = B.fluff ? { dispAmp: B.fluff * 0.5, disp: (x, y, z) => B.fluff * 0.5 * N(x, y, z, 45) } : {};
  if (B.head === 'flat'){
    const ml = B.muzzleLen;
    s.ell(at(0, -0.002, -0.012), [0.1 * h, 0.066 * h, 0.084 * h], { k: 0.02 }); // cranium
    s.ell(at(0, 0.02, 0.04), [0.084 * h, 0.052 * h, 0.048 * h], { k: 0.03 }); // broad forehead
    for (const sx of [-1, 1]){
      s.ell(at(sx * 0.058, -0.016, 0.022), [0.05 * h, 0.046 * h, 0.05 * h], { k: 0.03 }); // cheeks
      s.ell(at(sx * 0.038, 0.026, 0.076), [0.03 * h, 0.014 * h, 0.02 * h], { k: 0.015 }); // brows
      s.ell(at(sx * 0.021, -0.056, 0.082 + ml), [0.027 * h, 0.029 * h, 0.022 * h], { k: 0.013 }); // flews
    }
    s.ell(at(0, -0.03, 0.072 + ml), [0.043 * h, 0.033 * h, 0.034 * h], { k: 0.02 }); // muzzle
    s.cone(at(0, 0.002, 0.072), at(0, -0.014, 0.094 + ml), 0.02 * h, 0.017 * h, { k: 0.015 }); // short nose bridge
    s.cone(at(-0.032, -0.003, 0.088 + ml), at(0.032, -0.003, 0.088 + ml), 0.0072 * h, 0.0072 * h, { k: 0.008 }); // nose rope wrinkle
    s.ell(at(0, -0.062, 0.015), [0.055 * h, 0.035 * h, 0.055 * h], { k: 0.03 }); // throat
    s.cone(at(0, 0.034, 0.093), at(0, 0.004, 0.098), 0.009 * h, 0.006 * h, { sub: true, k: 0.016 }); // deep stop
    s.cone(at(-0.028, 0.058, 0.082), at(0.028, 0.058, 0.082), 0.0026 * h, 0.0026 * h, { sub: true, k: 0.006 }); // forehead wrinkle
    for (const sx of [-1, 1]) s.sph(at(sx * 0.047, 0.006, 0.082), B.eyeR * 1.05, { sub: true, k: 0.008 });
  } else {
    const ml = B.muzzleLen;
    s.ell(at(0, 0.012, -0.005), [0.074 * h, 0.07 * h, 0.085 * h], Object.assign({ k: 0.02 }, fl));
    s.cone(at(0, -0.008, 0.05), at(0, -0.022, 0.06 + ml / h), 0.045 * h, 0.03 * h, { k: 0.035 }); // muzzle
    for (const sx of [-1, 1]){
      s.ell(at(sx * 0.045, -0.02, 0.03), [0.035 * h, 0.04 * h, 0.045 * h], { k: 0.03 });
      s.ell(at(sx * 0.02, -0.044, 0.05 + ml * 0.55 / h), [0.022 * h, 0.022 * h, (ml * 0.5 + 0.02) ], { k: 0.012 }); // flews
      s.ell(at(sx * 0.03, 0.035, 0.05), [0.028 * h, 0.014 * h, 0.022 * h], { k: 0.015 }); // brow
    }
    s.ell(at(0, -0.05, 0.0), [0.05 * h, 0.04 * h, 0.06 * h], { k: 0.03 }); // throat
    s.cone(at(0, 0.03, 0.065), at(0, 0.008, 0.08), 0.004 * h, 0.004 * h, { sub: true, k: 0.01 }); // stop
    for (const sx of [-1, 1]) s.sph(at(sx * 0.038, 0.017, 0.058), B.eyeR * 1.02, { sub: true, k: 0.007 });
  }
  return s;
}
function nosePos(B, M){ const c = M.hc, h = B.hs; return B.head === 'flat' ? [0, c[1] - 0.016 * h, c[2] + (0.108 + B.muzzleLen) * h] : [0, c[1] - 0.012 * h, c[2] + 0.06 * h + B.muzzleLen + 0.032]; }
function eyePos(B, M, sx){ const c = M.hc, h = B.hs; return B.head === 'flat' ? [sx * 0.047 * h, c[1] + 0.006 * h, c[2] + 0.078 * h] : [sx * 0.038 * h, c[1] + 0.017 * h, c[2] + 0.055 * h]; }

/* Coat masks: out = [white, grey, black, pink] */
function maskFn(B, M){
  const c = M.hc, h = B.hs;
  return function(x, y, z, out){
    out[0] = out[1] = out[2] = out[3] = 0;
    const n = N(x, y, z, 22) * 0.025, n2 = N(x, y, z, 60) * 0.008;
    const hx = (x - c[0]) / h, hy = (y - c[1]) / h, hz = (z - c[2]) / h; // head coords
    const inHead = y > M.N0[1] + 0.02 && z > M.Hd[2] - 0.08 * h;
    if (B.mask === 'potty'){
      let w = 0;
      w = Math.max(w, ss(-0.01, 0.015, z - (M.zc - 0.03) + n * 1.3)); // neck, shoulders, chest and front legs: white
      w = Math.max(w, ss(-0.01, 0.015, M.yc - B.chestH * 0.5 - y + n)); // belly
      w = Math.max(w, ss(0.0, 0.02, 0.085 - y + n)); // feet
      w = Math.max(w, ss(0.012, -0.006, Math.abs(z - (M.hz + B.rumpW * 0.55) - (y - M.yc) * 0.5) - 0.017 - n) * ss(M.yc - 0.04, M.yc + 0.02, y)); // white stripe across the back
      w = Math.max(w, ss(0.006, -0.004, Math.abs(x) - 0.006 - n * 0.3) * ss(M.zc - 0.06, M.zc - 0.02, z)); // thin line onto the saddle
      if (!inHead && z > M.N0[2] - 0.03 && y > M.Hd[1] - 0.03) w = Math.min(w, ss(0.02, -0.01, y - (M.Hd[1] - 0.02) + n)); // dark nape continues from the head
      if (inHead){
        w = 0;
        const front = ss(0.03, 0.06, hz);
        const bw = 0.0045 + 0.006 * ss(0.03, -0.0, hy) + 0.018 * ss(0.0, -0.02, hy);
        w = Math.max(w, ss(0.003, -0.002, Math.abs(hx) - bw + n2 * 0.4) * front * ss(0.085, 0.07, hy)); // thin blaze
        const mz = ss(0.066, 0.086, hz) * ss(-0.004, -0.024, hy + n2);
        w = Math.max(w, mz * ss(0.05, 0.03, Math.abs(hx) - 0.0 + n2)); // white muzzle
        w = Math.max(w, ss(0.0, 0.02, Math.abs(hx) < 0.04 ? 1 : 0) * ss(-0.05, -0.075, hy + n2) * ss(0.0, 0.05, hz)); // chin
        w = Math.max(w, ss(-0.06, -0.085, hy + n2)); // throat
        out[1] = 0.25 * mz;
        const dn = Math.hypot(hx, hy + 0.016, hz - 0.108);
        out[2] = ss(0.032, 0.02, dn) * 0.9 + ss(0.006, 0.0, Math.abs(hy + 0.086) - 0.004) * ss(0.075, 0.1, hz) * 0.7;
        const flew = ss(0.0, 0.01, Math.abs(hx) - 0.01) * ss(-0.045, -0.06, hy) * ss(0.07, 0.09, hz);
        out[3] = clamp(flew * (0.55 + 0.45 * N(x, y, z, 90)) + ss(0.012, 0.004, Math.hypot(hx - 0.018, hy + 0.066, hz - 0.1)), 0, 0.9); // pink flews
      }
      out[0] = clamp(w, 0, 1);
    } else if (B.mask === 'pug'){
      if (inHead){
        const front = ss(0.04, 0.08, hz);
        out[2] = front * ss(0.02, -0.02, hy) * 0.95 + ss(0.035, 0.02, Math.hypot(Math.abs(hx) - 0.05, hy - 0.012, hz - 0.07)) * 0.9;
        out[2] = Math.min(1, out[2] + ss(-0.01, 0.02, hy - 0.06) * front * 0.3);
      }
      out[0] = 0.4 * ss(0.0, 0.03, M.yc - B.chestH * 0.4 - y + n);
    } else if (B.mask === 'golden'){
      out[0] = 0.7 * ss(-0.02, 0.03, M.yc - B.chestH * 0.6 - y + n) + (inHead ? 0.3 * ss(0.03, 0.09, hz) : 0);
      out[1] = inHead ? 0.2 : 0;
    } else if (B.mask === 'blacktan'){
      let t = 0;
      t = Math.max(t, ss(0.0, 0.02, 0.07 - y + n)); // legs
      t = Math.max(t, ss(-0.01, 0.01, M.yc - B.chestH * 0.6 - y + n) * ss(M.zc - 0.05, M.zc + 0.05, z)); // chest
      if (inHead){
        t = Math.max(t, ss(0.07, 0.11, hz) * ss(0.0, -0.03, hy)); // muzzle
        for (const sx of [-1, 1]) t = Math.max(t, ss(0.014, 0.006, Math.hypot(hx - sx * 0.04, hy - 0.045, hz - 0.055))); // eyebrow dots
      }
      out[0] = clamp(t, 0, 1);
    } else if (B.mask === 'collie'){
      let w = 0;
      w = Math.max(w, ss(-0.01, 0.02, M.N0[1] + 0.05 - y + n) * ss(M.zc - 0.02, M.zc + 0.06, z) * (inHead ? 0 : 1)); // chest
      w = Math.max(w, ss(-0.01, 0.02, Math.abs(z - (M.N0[2] - 0.01)) < 0.07 ? 1 : 0) * ss(M.yc, M.yc + 0.08, y) * (inHead ? 0 : 1)); // collar
      w = Math.max(w, ss(0.0, 0.03, 0.15 - y + n)); // socks
      w = Math.max(w, ss(-0.01, 0.01, M.yc - B.chestH * 0.5 - y + n)); // belly
      if (inHead){ const bw = 0.008 + 0.03 * ss(0.03, -0.03, hy); w = Math.max(w, ss(0.005, -0.005, Math.abs(hx) - bw + n2) * ss(0.02, 0.06, hz)); w = Math.max(w, ss(0.0, 0.03, -hy - 0.01) * ss(0.05, 0.1, hz)); }
      if (z < M.hz - B.rumpW - B.tailLen * 0.7) w = 1; // tail tip
      out[0] = clamp(w, 0, 1);
    }
  };
}

function earShape(B, M, sx){
  const c = M.hc, h = B.hs, s = new PM.Shape();
  let base, rot;
  if (B.ear === 'bat'){
    base = [c[0] + sx * 0.05 * h, c[1] + 0.062 * h, c[2] - 0.012 * h]; rot = [-0.04, -sx * 0.16, -sx * 0.2];
    const L = B.earLen, W = L * 0.4;
    const e = new THREE.Euler(rot[0], rot[1], rot[2]); const up = new V3(0, 1, 0).applyEuler(e), fw = new V3(0, 0, 1).applyEuler(e);
    const P = (u, f) => [base[0] + up.x * u + fw.x * f, base[1] + up.y * u + fw.y * f, base[2] + up.z * u + fw.z * f];
    s.ell(P(L * 0.45, 0), [W, L * 0.55, 0.011], { k: 0.01, rot });
    s.ell(P(L * 0.08, -0.004), [W * 0.85, L * 0.25, 0.022], { k: 0.015, rot });
    s.ell(P(L * 0.5, 0.012), [W * 0.72, L * 0.47, 0.012], { sub: true, k: 0.006, rot });
    return { s, base, rot, up, fw };
  }
  if (B.ear === 'rose'){
    base = [c[0] + sx * 0.06 * h, c[1] + 0.05 * h, c[2] - 0.0]; rot = [0.3, 0, -sx * 1.25];
    const e = new THREE.Euler(rot[0], rot[1], rot[2]); const up = new V3(0, 1, 0).applyEuler(e), fw = new V3(0, 0, 1).applyEuler(e);
    const P = (u, f) => [base[0] + up.x * u + fw.x * f, base[1] + up.y * u + fw.y * f, base[2] + up.z * u + fw.z * f];
    s.ell(P(B.earLen * 0.45, 0), [B.earLen * 0.55, B.earLen * 0.5, 0.008], { k: 0.01, rot });
    return { s, base, rot, up, fw };
  }
  if (B.ear === 'semi'){
    base = [c[0] + sx * 0.045 * h, c[1] + 0.06 * h, c[2] - 0.025 * h]; rot = [-0.25, 0, -sx * 0.3];
    const e = new THREE.Euler(rot[0], rot[1], rot[2]); const up = new V3(0, 1, 0).applyEuler(e), fw = new V3(0, 0, 1).applyEuler(e);
    const P = (u, f) => [base[0] + up.x * u + fw.x * f, base[1] + up.y * u + fw.y * f, base[2] + up.z * u + fw.z * f];
    s.ell(P(B.earLen * 0.4, 0), [B.earLen * 0.38, B.earLen * 0.45, 0.01], { k: 0.01, rot });
    s.ell(P(B.earLen * 0.86, 0.025), [B.earLen * 0.22, B.earLen * 0.12, 0.008], { k: 0.015, rot: [rot[0] + 1.2, rot[1], rot[2]] }); // tipped
    return { s, base, rot, up, fw };
  }
  // flop
  base = [c[0] + sx * 0.06 * h, c[1] + 0.045 * h, c[2] - 0.01 * h]; rot = [0.1, 0, -sx * 2.75];
  const e = new THREE.Euler(rot[0], rot[1], rot[2]); const up = new V3(0, 1, 0).applyEuler(e), fw = new V3(0, 0, 1).applyEuler(e);
  const P = (u, f) => [base[0] + up.x * u + fw.x * f, base[1] + up.y * u + fw.y * f, base[2] + up.z * u + fw.z * f];
  const fl = B.fluff ? { dispAmp: B.fluff * 0.6, disp: (x, y, z) => B.fluff * 0.6 * N(x, y, z, 50) } : {};
  s.ell(P(B.earLen * 0.5, 0), [B.earLen * 0.38, B.earLen * 0.55, 0.012], Object.assign({ k: 0.012, rot }, fl));
  return { s, base, rot, up, fw };
}

function mkBone(name, pos, parent, par){ const b = new THREE.Bone(); b.name = name; b.userData.rest = pos.slice(); b.position.set(pos[0] - par[0], pos[1] - par[1], pos[2] - par[2]); if (parent) parent.add(b); return b; }

PM.buildDog = function(key, q){
  q = q || 1; // detail divisor: 1 = finest; larger = fewer vertices
  const B = PM.BREEDS[key], M = marks(B);
  const fur = PM.furMaterial(B.fur);
  const root = new THREE.Group(); root.name = key;
  const bones = []; const by = {};
  const add = (name, pos, parentName) => { const p = parentName ? by[parentName] : null; const b = mkBone(name, pos, p, p ? p.userData.rest : [0, 0, 0]); bones.push(b); by[name] = b; return b; };
  add('hips', [0, M.yc, -B.L * 0.15], null);
  add('spine', [0, M.yc, M.zc - 0.02], 'hips');
  add('neck', M.N0, 'spine');
  add('head', M.Hd, 'neck');
  for (const [sd, sx] of [['L', 1], ['R', -1]]){
    const m = a => [a[0] * sx, a[1], a[2]];
    add('f1' + sd, m(M.S), 'spine'); add('f2' + sd, m(M.E), 'f1' + sd); add('f3' + sd, m(M.W), 'f2' + sd); add('f4' + sd, m([M.Pf[0], 0.014, M.Pf[2] + 0.02]), 'f3' + sd);
    add('h1' + sd, m(M.Hp), 'hips'); add('h2' + sd, m(M.K), 'h1' + sd); add('h3' + sd, m(M.Hk), 'h2' + sd); add('h4' + sd, m([M.Ph[0], 0.014, M.Ph[2] + 0.018]), 'h3' + sd);
  }
  const tp = tailSegs(B, M);
  const tb = [0, M.yc + B.rumpH * 0.45, M.hz - B.rumpW * 0.75];
  add('tail0', tb, 'hips');
  if (tp){ add('tail1', tp[1], 'tail0'); add('tail2', tp[2], 'tail1'); add('tail3', tp[3], 'tail2'); }
  root.add(by.hips);

  // ---- body mesh
  const shape = bodyShape(B, M);
  if (tp){ for (let i = 0; i < 3; i++){ const r0 = (B.tail === 'thin' ? 0.018 : 0.03) * (1 - i * 0.25), r1 = r0 * 0.75; shape.cone(tp[i], tp[i + 1], r0, r1, B.fluff ? { k: 0.02, dispAmp: B.fluff * 1.5, disp: (x, y, z) => B.fluff * 1.5 * N(x, y, z, 30) } : { k: 0.02 }); } }
  const cell = (B.H > 0.4 ? 0.0075 : 0.0055) * q;
  const geo = PM.meshShape(shape, cell);
  const mf = maskFn(B, M);
  PM.vertexAttr(geo, 'aMask', 4, (x, y, z, o) => mf(x, y, z, o));
  PM.localize(geo, [0, 0, 0]);
  const R = n => by[n].userData.rest;
  const idx = n => bones.indexOf(by[n]);
  const segs = [
    { bone: idx('hips'), a: [0, M.yc, -B.L * 0.05], b: [0, M.yc, M.hz - 0.02], r: B.rumpW },
    { bone: idx('spine'), a: [0, M.yc, -B.L * 0.02], b: [0, M.yc, M.zc + 0.06], r: B.chestW },
    { bone: idx('neck'), a: M.N0, b: [0, M.Hd[1] - 0.02, M.Hd[2] - 0.01], r: B.neckR * 0.8 },
    { bone: idx('head'), a: [0, M.Hd[1], M.Hd[2]], b: M.hc, r: 0.04 }
  ];
  for (const [sd, sx] of [['L', 1], ['R', -1]]){
    const g = (x) => ss(-0.012, 0.018, x * sx);
    const gate = (x, y, z) => g(x);
    segs.push({ bone: idx('f1' + sd), a: R('f1' + sd), b: R('f2' + sd), r: B.legR * 1.2, gate: (x, y, z) => g(x) * ss(M.yc + 0.02, M.yc - 0.03, y) });
    segs.push({ bone: idx('f2' + sd), a: R('f2' + sd), b: R('f3' + sd), r: B.legR * 0.85, gate });
    segs.push({ bone: idx('f3' + sd), a: R('f3' + sd), b: R('f4' + sd), r: B.legR * 0.8, gate });
    segs.push({ bone: idx('h1' + sd), a: R('h1' + sd), b: R('h2' + sd), r: B.legR * 1.3, gate: (x, y, z) => g(x) * ss(M.yc + 0.03, M.yc - 0.03, y) });
    segs.push({ bone: idx('h2' + sd), a: R('h2' + sd), b: R('h3' + sd), r: B.legR * 0.85, gate });
    segs.push({ bone: idx('h3' + sd), a: R('h3' + sd), b: R('h4' + sd), r: B.legR * 0.75, gate });
  }
  segs.push({ bone: idx('tail0'), a: tb, b: tp ? tp[1] : [0, tb[1] - 0.02, tb[2] - 0.03], r: 0.022, gate: (x, y, z) => ss(tb[2] + 0.01, tb[2] - 0.01, z) });
  if (tp){ segs.push({ bone: idx('tail1'), a: tp[1], b: tp[2], r: 0.02 }); segs.push({ bone: idx('tail2'), a: tp[2], b: tp[3], r: 0.02 }); segs.push({ bone: idx('tail3'), a: tp[3], b: tp[3], r: 0.02 }); }
  PM.skinWeights(geo, segs);
  const body = new THREE.SkinnedMesh(geo, fur);
  body.castShadow = true; body.receiveShadow = true;
  geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.9; geo.boundingSphere.center.y = B.H * 0.5; // generous: bones move the mesh away from the bind pose
  root.add(body);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  body.bind(skeleton);

  // ---- head (rigid)
  const head = by.head, hd = M.Hd;
  const rigid = (geo2, mat, parent, origin) => { PM.localize(geo2, origin); const m = new THREE.Mesh(geo2, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const hs = headShape(B, M);
  const hg = PM.meshShape(hs, 0.0033 * Math.max(1, B.hs * 0.9) * Math.sqrt(q));
  PM.vertexAttr(hg, 'aMask', 4, (x, y, z, o) => mf(x, y, z, o));
  rigid(hg, fur, head, hd);
  // nose
  const np = nosePos(B, M), ns = new PM.Shape(), h = B.hs;
  ns.ell(np, [0.024 * h, 0.016 * h, 0.0095 * h], { k: 0.007, rot: [-0.2, 0, 0] });
  for (const sx of [-1, 1]) ns.ell([np[0] + sx * 0.011 * h, np[1] - 0.003 * h, np[2] + 0.008 * h], [0.0065 * h, 0.0022 * h, 0.006 * h], { sub: true, k: 0.002, rot: [0, 0, sx * 0.5] });
  ns.cone([np[0], np[1] - 0.004 * h, np[2] + 0.012 * h], [np[0], np[1] - 0.016 * h, np[2] + 0.006 * h], 0.0012, 0.0012, { sub: true, k: 0.003 });
  const ng = PM.meshShape(ns, 0.0016);
  rigid(ng, new THREE.MeshPhysicalMaterial({ color: '#171313', roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.5 }), head, hd);
  // eyes + lids
  const eyeMat = PM.eyeMaterial(B.iris, false);
  const lids = [];
  for (const sx of [-1, 1]){
    const ep = eyePos(B, M, sx);
    const eye = new THREE.Mesh(PM.eyeGeometry(B.eyeR), eyeMat);
    eye.position.set(ep[0] - hd[0], ep[1] - hd[1], ep[2] - hd[2]);
    eye.rotation.y = sx * (B.head === 'flat' ? 0.2 : 0.22); eye.rotation.x = -0.05;
    head.add(eye);
    const lidP = new THREE.Object3D(); lidP.position.copy(eye.position); lidP.rotation.y = eye.rotation.y; head.add(lidP);
    const lg = new THREE.SphereGeometry(B.eyeR * 1.1, 20, 10, 0, TAU, 0, Math.PI * 0.5);
    const lc = new Float32Array(lg.attributes.position.count * 4);
    const lo = new Float32Array(lg.attributes.position.count * 3);
    for (let i = 0; i < lg.attributes.position.count; i++){ lo[i * 3] = ep[0]; lo[i * 3 + 1] = ep[1] + 0.012; lo[i * 3 + 2] = ep[2]; const o = [0, 0, 0, 0]; mf(ep[0], ep[1] + 0.014, ep[2], o); lc.set(o, i * 4); }
    lg.setAttribute('aMask', new THREE.BufferAttribute(lc, 4)); lg.setAttribute('aObj', new THREE.BufferAttribute(lo, 3));
    const lid = new THREE.Mesh(lg, fur); lidP.add(lid); lidP.rotation.x = -1.2; lidP.visible = false; lids.push(lidP);
  }
  // jaw + tongue + mouth
  const jawPivot = [0, M.hc[1] - 0.045 * h, M.hc[2] + 0.02 * h];
  const jaw = new THREE.Bone(); jaw.position.set(jawPivot[0] - hd[0], jawPivot[1] - hd[1], jawPivot[2] - hd[2]); head.add(jaw);
  const js = new PM.Shape();
  const jl = B.head === 'flat' ? 0.06 + B.muzzleLen : 0.05 + B.muzzleLen / h;
  js.cone([0, jawPivot[1] - 0.02 * h, jawPivot[2] + 0.0], [0, jawPivot[1] - 0.038 * h, jawPivot[2] + jl * h + (B.head === 'flat' ? 0.006 : 0)], 0.032 * h, 0.022 * h, { k: 0.02 });
  js.ell([0, jawPivot[1] - 0.035 * h, jawPivot[2] + (jl - 0.01) * h], [0.03 * h, 0.012 * h, 0.022 * h], { k: 0.012 });
  const jg = PM.meshShape(js, 0.003);
  PM.vertexAttr(jg, 'aMask', 4, (x, y, z, o) => { mf(x, y, z, o); if (B.mask === 'potty'){ o[0] = 1; o[1] = 0.2; o[3] = 0.25; } });
  const jawMesh = rigid(jg, fur, jaw, jawPivot);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.03 * h, 14, 10), new THREE.MeshStandardMaterial({ color: '#3a1517', roughness: 0.6 }));
  mouth.scale.set(1.15, 0.45, 1.5); mouth.position.set(0, jawPivot[1] - hd[1] - 0.008 * h, jawPivot[2] - hd[2] + jl * 0.6 * h); head.add(mouth);
  const tongueBone = new THREE.Object3D(); tongueBone.position.set(0, -0.026 * h, 0.012 * h); jaw.add(tongueBone);
  const ts = new PM.Shape();
  ts.ell([0, 0, jl * 0.55 * h], [0.022 * h, 0.006 * h, jl * 0.6 * h], { k: 0.005 });
  ts.cone([0, 0.004 * h, 0.01 * h], [0, 0.006 * h, jl * 1.0 * h], 0.002, 0.002, { sub: true, k: 0.004 });
  const tg = PM.meshShape(ts, 0.0018);
  PM.localize(tg, [0, 0, 0]);
  const tongue = new THREE.Mesh(tg, PM.glossy('#e07a8a', 0.4)); tongue.castShadow = true; tongueBone.add(tongue);
  // ears
  const ears = [];
  for (const sx of [-1, 1]){
    const E = earShape(B, M, sx);
    const eb = new THREE.Bone(); eb.position.set(E.base[0] - hd[0], E.base[1] - hd[1], E.base[2] - hd[2]); head.add(eb);
    const eg = PM.meshShape(E.s, 0.0024);
    const inv = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(E.rot[0], E.rot[1], E.rot[2])).invert();
    const tv = new V3();
    PM.vertexAttr(eg, 'aMask', 4, (x, y, z, o, nx, ny, nz) => {
      mf(E.base[0], E.base[1] + 0.02, E.base[2], o);
      if (B.mask === 'potty' || B.mask === 'pug'){ o[0] = 0; o[1] = 0; }
      if (B.mask === 'pug') o[2] = 0.95;
      tv.set(nx, ny, nz).applyMatrix4(inv);
      const inner = ss(0.2, 0.7, tv.z);
      tv.set(x - E.base[0], y - E.base[1], z - E.base[2]).applyMatrix4(inv);
      const rim = ss(B.earLen * 0.3, B.earLen * 0.15, Math.abs(tv.x) - (B.ear === 'bat' ? 0.0 : 0.0));
      if (B.ear === 'bat'){ const ii = inner * rim; o[3] = ii * 0.4 * ss(0.06, 0.015, tv.y); o[0] = ii * 0.18 * ss(0.01, 0.05, tv.y); o[2] = ii * 0.2; }
    });
    rigid(eg, fur, eb, E.base);
    ears.push({ bone: eb, sx, ang: new V3(), vel: new V3(), rest: eb.rotation.clone() });
  }
  // collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(B.neckR * 0.98, 0.008 + B.H * 0.012, 8, 28), PM.glossy(B.collar, 0.55));
  const nk = by.neck; collar.position.set(0, (M.Hd[1] - M.N0[1]) * 0.35, (M.Hd[2] - M.N0[2]) * 0.35);
  collar.quaternion.setFromUnitVectors(new V3(0, 0, 1), new V3(0, M.Hd[1] - M.N0[1], M.Hd[2] - M.N0[2]).normalize()); collar.castShadow = true;
  nk.add(collar);
  const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.002, 12), PM.glossy('#d4b25a', 0.25));
  tag.rotation.x = Math.PI / 2; tag.position.set(0, -B.neckR * 1.05, 0.012); collar.add(tag); tag.rotation.set(0, 0, 0);
  // harness anchor (leash attach point) on the back
  const leashAnchor = new THREE.Object3D(); leashAnchor.position.set(0, B.chestH + 0.012, 0.02); by.spine.add(leashAnchor);
  let harness = null;
  if (key === 'potty'){
    const hm = PM.glossy('#151515', 0.6);
    harness = new THREE.Group(); by.spine.add(harness);
    const ring = (r, t, y, z, rx) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 30), hm); m.position.set(0, y, z); m.rotation.x = rx; m.scale.set(1, 1.05, 1); m.castShadow = true; harness.add(m); return m; };
    ring(B.chestW * 1.02, 0.007, 0.0, -0.02, 0).scale.set(1.0, B.chestH / B.chestW * 1.04, 1); // girth band
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.008, 0.06), hm); plate.position.set(0, B.chestH * 1.03, 0.0); harness.add(plate);
    const d = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0022, 6, 14), PM.glossy('#c9c9c9', 0.2)); d.position.set(0, B.chestH * 1.05 + 0.008, 0.01); harness.add(d);
  }
  const dog = {
    key, B, M, root, bones: by, body, head, jaw, tongue, tongueBone, lids, ears, collar, leashAnchor, harness, mouthMesh: mouth,
    len: { f1: dist(R('f1L'), R('f2L')), f2: dist(R('f2L'), R('f3L')), h1: dist(R('h1L'), R('h2L')), h2: dist(R('h2L'), R('h3L')) },
    st: newState(B)
  };
  return dog;
};
function dist(a, b){ return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function newState(B){
  return { pos: new V3(), heading: 0, vel: new V3(), speed: 0, turn: 0, phase: 0, gait: 0, pose: 'stand', poseW: { sit: 0, lie: 0, sploot: 0, roll: 0, bow: 0, sniff: 0, drink: 0, sleep: 0, paw: 0, carried: 0, squat: 0 }, tug: 0, zoom: 0, hunch: 0, jump: 0, jumpT: 0,
    look: null, lookYaw: 0, lookPitch: 0, tilt: 0, happy: 0.5, pant: 0.3, bark: 0, blinkT: 2, blink: 0, shake: 0, shakeT: 0, wiggle: 0, t: Math.random() * 10,
    prevHead: new V3(), prevHeadVel: new V3(), tailPhase: 0, mouth: 0, lap: 0, sniffT: 0, paddle: 0, groundY: 0 };
}

/* ---------- Animation ---------- */
const _tmp2 = new V3();
const _w = new V3(), _w2 = new V3(), _pole = new V3(), _fwd = new V3(), _tmp = new V3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const UPV = new V3(0, 1, 0);
const GAITS = [
  { name: 'walk', duty: 0.62, off: { fL: 0.25, fR: 0.75, hL: 0.0, hR: 0.5 }, stride: 1.0, lift: 0.5 },
  { name: 'trot', duty: 0.45, off: { fL: 0.0, fR: 0.5, hL: 0.5, hR: 0.0 }, stride: 1.6, lift: 0.7 },
  { name: 'gallop', duty: 0.34, off: { fL: 0.55, fR: 0.65, hL: 0.0, hR: 0.1 }, stride: 2.6, lift: 0.8 }
];
PM.animateDog = function(dog, dt, getH){
  const s = dog.st, B = dog.B, M = dog.M, by = dog.bones, root = dog.root;
  s.t += dt;
  const legLen = M.yc;
  const spdN = s.speed / legLen; // body-lengths-ish per second
  // gait selection with hysteresis
  if (s.gait === 0 && spdN > 3.6) s.gait = 1; else if (s.gait === 1 && spdN < 3.0) s.gait = 0;
  if (s.gait === 1 && spdN > 9.0) s.gait = 2; else if (s.gait === 2 && spdN < 7.5) s.gait = 1;
  const G = GAITS[s.gait];
  const stride = Math.min(legLen * G.stride, Math.max(0.0001, s.speed * 0.42 * (s.gait === 2 ? 0.75 : 1)));
  const moving = s.speed > 0.03 ? 1 : 0;
  const freq = s.speed > 0.03 ? s.speed / stride : 0;
  s.phase = (s.phase + freq * dt) % 1;
  // pose weights
  const PW = s.poseW;
  for (const k in PW){ const target = s.pose === k ? 1 : 0; PW[k] = damp(PW[k], target, k === 'roll' ? 6 : 7, dt); }
  const still = 1 - Math.min(1, s.speed / 0.3);
  // root transform
  const gy = getH ? getH(s.pos.x, s.pos.z) : 0; s.groundY = gy;
  s.jumpT = Math.max(0, s.jumpT - dt);
  const jumpY = s.jumpT > 0 ? Math.sin((1 - s.jumpT / s.jumpDur) * Math.PI) * s.jumpH : 0;
  if (!s.carried){ root.position.set(s.pos.x, gy + jumpY, s.pos.z); root.rotation.set(0, s.heading, 0); }
  // body
  const hips = by.hips, spine = by.spine, hr = hips.userData.rest;
  let bodyY = 0, hipPitch = 0, spinePitch = 0, roll = 0, hipYaw = 0, hipZ = 0;
  const bob = moving * (s.gait === 2 ? Math.sin(s.phase * TAU) * 0.025 : Math.abs(Math.sin(s.phase * TAU * 2)) * 0.006) * Math.min(1, s.speed);
  bodyY += bob;
  if (s.gait === 2) { hipPitch += Math.sin(s.phase * TAU + 1) * 0.12 * moving; spinePitch += Math.sin(s.phase * TAU + 2.2) * 0.14 * moving; }
  // sit
  const sitDrop = M.yc * 0.42;
  const sitW = Math.max(PW.sit, PW.paw);
  bodyY += -sitDrop * 0.62 * PW.squat; hipPitch += -0.32 * PW.squat; spinePitch += 0.16 * PW.squat * s.hunch; hipPitch -= 0.12 * PW.squat * s.hunch;
  bodyY += -sitDrop * sitW; hipPitch += -0.62 * sitW; hipZ += 0.04 * sitW;
  bodyY += -0.03 * s.tug - 0.02 * s.zoom; hipPitch += -0.12 * s.tug + 0.06 * s.zoom; hipZ += -0.04 * s.tug;
  // lie / sleep / sploot
  const lieW = Math.max(PW.lie, PW.sleep, PW.sploot);
  bodyY += -(M.yc - B.chestH * 0.98) * lieW;
  hipPitch += 0.04 * lieW;
  // roll over (belly up)
  roll += Math.PI * 0.92 * PW.roll; bodyY += (B.chestW * 1.05 - M.yc) * PW.roll;
  // play bow
  spinePitch += 0.45 * PW.bow; bodyY += 0.02 * PW.bow; hipPitch += -0.12 * PW.bow;
  hipYaw += Math.sin(s.t * 13) * 0.12 * (PW.bow + s.wiggle);
  // sleep: lying on side
  roll += 1.25 * PW.sleep;
  // shake
  if (s.shakeT > 0){ s.shakeT -= dt; const k = s.shakeT / 0.8; roll += Math.sin(s.t * 42) * 0.35 * k; }
  hips.position.set(hr[0], hr[1] + bodyY, hr[2] + hipZ);
  hips.rotation.set(hipPitch, hipYaw, roll * (PW.roll > 0.01 ? 1 : 1));
  spine.rotation.set(spinePitch - hipPitch * 0.35 * sitW, -hipYaw * 0.6, 0);
  if (PW.roll > 0.01){ spine.rotation.z = Math.sin(s.t * 5) * 0.08 * PW.roll; }
  // head look / sniff / drink
  const headB = by.head, neck = by.neck;
  let yaw = 0, pitch = 0;
  if (s.look){
    headB.getWorldPosition(_w); _tmp.copy(s.look).sub(_w);
    const lyaw = Math.atan2(_tmp.x, _tmp.z) - s.heading; let a = ((lyaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
    yaw = clamp(a, -1.1, 1.1); pitch = clamp(-Math.atan2(_tmp.y, Math.hypot(_tmp.x, _tmp.z)), -0.6, 0.6);
  }
  s.lookYaw = damp(s.lookYaw, yaw * (1 - PW.roll), 6, dt); s.lookPitch = damp(s.lookPitch, pitch, 6, dt);
  const sniffW = Math.max(PW.sniff, PW.drink);
  const neckPitch = s.lookPitch * 0.4 + 0.75 * sniffW + 0.25 * PW.bow - 0.35 * sitW + 0.35 * lieW - 0.1 * PW.sleep - 0.25 * s.tug;
  neck.rotation.set(neckPitch, s.lookYaw * 0.45, 0);
  const sniffBob = sniffW * Math.sin(s.t * (PW.drink > 0.5 ? 9 : 16)) * 0.035;
  const barkUp = s.bark > 0 ? -Math.sin((1 - s.bark / 0.3) * Math.PI) * 0.3 : 0;
  s.tilt = damp(s.tilt, s.tiltTarget || 0, 5, dt);
  headB.rotation.set(s.lookPitch * 0.6 + 0.35 * sniffW + sniffBob + barkUp - 0.15 * lieW, s.lookYaw * 0.55 + Math.sin(s.t * 19) * 0.32 * s.tug, s.tilt + (PW.sleep * 0.3) + Math.sin(s.t * 23) * 0.12 * s.tug);
  // legs
  root.updateMatrixWorld(true);
  _fwd.set(Math.sin(s.heading), 0, Math.cos(s.heading));
  const homeF = { x: M.fw, z: M.Pf[2] }, homeH = { x: M.hw, z: M.Ph[2] };
  for (const sd of ['L', 'R']){
    const sx = sd === 'L' ? 1 : -1;
    for (const fr of ['f', 'h']){
      const off = G.off[fr + sd];
      const ph = (s.phase + off) % 1;
      let dz = 0, lift = 0;
      if (moving){
        if (ph < G.duty){ const u = ph / G.duty; dz = stride * (0.5 - u); }
        else { const u = (ph - G.duty) / (1 - G.duty); const e = u * u * (3 - 2 * u); dz = stride * (-0.5 + e); lift = Math.sin(u * Math.PI) * legLen * 0.25 * G.lift * Math.min(1, s.speed / 0.4); }
      }
      // local foot target in root space
      let lx, ly, lz, frame = 'ground';
      if (fr === 'f'){
        lx = sx * homeF.x; ly = lift; lz = homeF.z + dz;
        // pose adjustments
        lz += 0.11 * B.H / 0.3 * Math.max(PW.lie, PW.sploot, PW.bow) + 0.03 * sitW;
        if (sd === 'R'){ lz += 0.09 * PW.paw; ly += 0.13 * PW.paw * B.H / 0.3; }
        lx += sx * 0.01 * lieW;
      } else {
        lx = sx * homeH.x; ly = lift; lz = homeH.z + dz;
        lz += (0.11 * sitW + 0.06 * PW.lie + 0.07 * PW.squat) * B.L / 0.36 - 0.2 * B.L / 0.36 * PW.sploot;
        lx += sx * (0.035 * PW.lie + 0.02 * sitW + 0.02 * PW.sploot + 0.03 * PW.squat);
      }
      // roll / sleep: paws relative to body, folded
      const bodyFrame = Math.max(PW.roll, PW.sleep, PW.carried);
      _w.set(lx, ly, lz);
      root.localToWorld(_w);
      _w.y = (getH ? getH(_w.x, _w.z) : 0) + ly + jumpY * (1 - 0.6);
      if (s.jumpT > 0) _w.y += jumpY * 0.3;
      if (bodyFrame > 0.01){
        const j = by[(fr === 'f' ? 'f1' : 'h1') + sd];
        j.getWorldPosition(_w2);
        // folded paw near the joint, in body-up direction
        const up = _tmp.set(0, 1, 0).applyQuaternion(hips.getWorldQuaternion(_q));
        const paddle = Math.sin(s.t * 6 + (fr === 'f' ? 0 : 1.5) + sx) * 0.02 * PW.roll;
        hips.getWorldQuaternion(_q); const bf = _tmp2.set(0, 0, 1).applyQuaternion(_q);
        _w2.addScaledVector(up, -legLen * (0.45 + 0.4 * PW.carried)).addScaledVector(bf, ((fr === 'f' ? 0.05 : -0.02) + paddle) * (1 - PW.carried));
        _w.lerp(_w2, bodyFrame);
      }
      const isF = fr === 'f';
      const u = by[(isF ? 'f1' : 'h1') + sd], l = by[(isF ? 'f2' : 'h2') + sd], e = by[(isF ? 'f3' : 'h3') + sd], pw = by[(isF ? 'f4' : 'h4') + sd];
      // target for the end joint = foot target + rest offset (end - paw) in root orientation
      const eo = e.userData.rest, po = pw.userData.rest;
      _tmp.set(eo[0] - po[0], eo[1] - po[1], eo[2] - po[2]);
      if (!isF){ const fold = Math.max(sitW, lieW, PW.squat * 0.7); _tmp.z += 0.05 * fold * (B.L / 0.36); _tmp.y -= (eo[1] - po[1]) * 0.75 * fold; }
      _tmp.applyAxisAngle(UPV, s.heading);
      const tgt = _w2.copy(_w).add(_tmp);
      _pole.copy(_fwd).multiplyScalar(isF ? -1 : 1).add(_tmp.set(0, 0, 0));
      if (bodyFrame > 0.01) _pole.applyAxisAngle(_fwd, roll * sx * 0);
      PM.ik2(u, l, e.position, tgt, _pole, isF ? dog.len.f1 : dog.len.h1, isF ? dog.len.f2 : dog.len.h2);
      // paw: point toward the foot target
      e.getWorldPosition(_w2);
      _tmp.copy(_w).sub(_w2);
      if (_tmp.lengthSq() < 1e-6) _tmp.set(0, -1, 0);
      if (bodyFrame > 0.5) _tmp.copy(_fwd).multiplyScalar(isF ? 1 : -1).addScaledVector(new V3(0, 1, 0).applyQuaternion(hips.getWorldQuaternion(_q)), -0.6);
      PM.aimBone(e, pw.position, _tmp);
    }
  }
  // tail
  s.tailPhase += dt * (6 + s.happy * 10);
  const wagA = (0.15 + s.happy * 0.55) * (1 - PW.sleep * 0.8);
  const t0 = by.tail0;
  if (B.tail === 'stub' || B.tail === 'curl') t0.rotation.set(-0.6 * PW.squat, Math.sin(s.tailPhase) * wagA * 0.5 * (1 - PW.squat), 0);
  else {
    const lift = 0.25 * s.happy - 0.35 * (PW.lie + PW.sleep) + 0.3 * moving * (s.gait > 0 ? 1 : 0);
    t0.rotation.set(-lift, Math.sin(s.tailPhase) * wagA, 0);
    if (by.tail1){ by.tail1.rotation.set(-lift * 0.3, Math.sin(s.tailPhase - 0.7) * wagA * 0.7, 0); by.tail2.rotation.set(0, Math.sin(s.tailPhase - 1.4) * wagA * 0.6, 0); }
  }
  // jaw / tongue / bark / panting
  s.bark = Math.max(0, s.bark - dt);
  s.lap = PW.drink > 0.5 ? (Math.sin(s.t * 9) * 0.5 + 0.5) : 0;
  const pantOpen = s.pant * (0.18 + 0.06 * Math.sin(s.t * (8 + s.pant * 6))) * (1 - PW.sleep);
  const barkOpen = s.bark > 0 ? Math.sin((1 - s.bark / 0.3) * Math.PI) * 0.5 : 0;
  s.mouth = damp(s.mouth, Math.max(pantOpen, barkOpen, s.lap * 0.25, s.holding ? 0.3 : 0, s.tug * 0.3), 18, dt);
  dog.jaw.rotation.x = s.mouth;
  const tongueOut = Math.max(s.pant * 0.9, s.lap, dog.key === 'potty' ? 0.35 : 0) * (1 - PW.sleep * 0.6) * (s.holding ? 0 : 1);
  const side = dog.key === 'potty' ? (1 - Math.min(1, s.pant * 1.2)) * (1 - s.lap) : 0; // Potty's tongue peeks out of the side of her mouth
  dog.tongueBone.scale.set(1, 1, 1 + tongueOut * 0.7 + side * 0.2);
  dog.tongueBone.rotation.set(tongueOut * 0.35 + s.lap * 0.4 + side * 0.35, side * 0.55, -side * 0.35);
  dog.tongueBone.position.set(side * 0.02 * B.hs, -0.026 * B.hs - side * 0.004, 0.012 * B.hs + tongueOut * 0.012);
  // blink
  s.blinkT -= dt; if (s.blinkT < 0){ s.blink = 0.14; s.blinkT = 2 + Math.random() * 3.5; }
  s.blink = Math.max(0, s.blink - dt);
  const lidClose = Math.max(s.blink > 0 ? 1 : 0, PW.sleep, s.eyesClosed || 0);
  dog.lids.forEach(l => { l.rotation.x = damp(l.rotation.x, lidClose ? 1.5 : -1.2, 30, dt); l.visible = l.rotation.x > -0.9; });
  // ears: spring driven by head acceleration
  headB.getWorldPosition(_w);
  const hv = _tmp.copy(_w).sub(s.prevHead).divideScalar(Math.max(dt, 1e-3));
  const acc = _w2.copy(hv).sub(s.prevHeadVel).divideScalar(Math.max(dt, 1e-3));
  s.prevHead.copy(_w); s.prevHeadVel.copy(hv);
  headB.getWorldQuaternion(_q); acc.applyQuaternion(_q.invert());
  const stiff = B.ear === 'bat' ? 160 : B.ear === 'semi' ? 90 : B.ear === 'rose' ? 120 : 45;
  const gain = B.ear === 'bat' ? 0.004 : 0.012;
  for (const e of dog.ears){
    const a = e.ang, v = e.vel;
    const fx = clamp(-acc.z * gain, -2, 2) + clamp(acc.y * gain * 0.5, -2, 2), fz = clamp(acc.x * gain, -2, 2) * e.sx;
    const tx = (s.earsBack || 0) * 0.6 + (B.ear === 'flop' ? PW.roll * -1.2 : 0), tz = (s.shakeT > 0 ? Math.sin(s.t * 42 + e.sx) * 0.6 : 0);
    v.x += (-(a.x - tx) * stiff - v.x * 9 + fx * stiff) * dt; v.z += (-(a.z - tz) * stiff - v.z * 9 + fz * stiff) * dt;
    a.x += v.x * dt; a.z += v.z * dt;
    a.x = clamp(a.x, -0.9, 0.9); a.z = clamp(a.z, -0.9, 0.9);
    e.bone.rotation.set(a.x + Math.sin(s.t * 1.7 + e.sx) * 0.02, 0, a.z * e.sx);
  }
};
PM.dogBark = function(dog){ dog.st.bark = 0.3; };
PM.dogShake = function(dog){ dog.st.shakeT = 0.8; };
PM.dogJump = function(dog, h, dur){ dog.st.jumpH = h; dog.st.jumpDur = dur; dog.st.jumpT = dur; };
PM.mouthWorld = function(dog, out){ const h = dog.B.hs; const np = nosePos(dog.B, dog.M); out.set(0, np[1] - dog.M.Hd[1] - 0.05 * h, np[2] - dog.M.Hd[2] - 0.0); dog.bones.head.localToWorld(out); return out; };
})();
