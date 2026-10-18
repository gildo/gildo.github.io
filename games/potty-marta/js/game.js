/* Potty & Marta — un pomeriggio al Parco Vetra. Game logic, AI, camera, HUD. */
(function(){
'use strict';
THREE.ColorManagement.legacyMode = false;
const PM = window.PM, V3 = THREE.Vector3, TAU = Math.PI * 2;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const wrapA = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const angDamp = (a, b, k, dt) => a + wrapA(b - a) * (1 - Math.exp(-k * dt));
const pick = arr => arr[(Math.random() * arr.length) | 0];
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const store = { get(k, d){ try { const v = localStorage.getItem('potty-vetra:' + k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } }, set(k, v){ try { localStorage.setItem('potty-vetra:' + k, JSON.stringify(v)); } catch(e){} } };
const L = PM.LAYOUT;

/* ---------- Renderer ---------- */
const canvas = $('c');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = isTouch ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 1500);
function resize(){ const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 64 : 52; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

/* Mesh detail divisors (bigger = fewer vertices). Characters were ~580k vertices drawn twice per frame, far too heavy for phones. */
const QD = isTouch ? { potty: 1.5, marta: 1.9, dog: 2.1, human: 2.6 } : { potty: 1, marta: 1.25, dog: 1.5, human: 1.8 };

/* ---------- Game state ---------- */
const DAY = 480, H0 = 16.5, H1 = 19.5;
const G = { mode: 'loading', t: 0, score: 0, fresco: 100, best: store.get('best', 0), stats: {}, missions: [], lastHour: 16, ending: null, trick: null, nextTrick: 25, toastQ: [], toastT: 0, hintShown: {} };
const MISSIONS = [
  { id: 'route', label: 'Da piazza Mondadori 2 al Parco Vetra', goal: 1 },
  { id: 'redlight', label: 'Seduta al semaforo rosso', goal: 1 },
  { id: 'pee', label: 'Pipì: lascia 3 messaggi', goal: 3 },
  { id: 'poop', label: 'Cacca (e Marta raccoglie)', goal: 1 },
  { id: 'sniff', label: 'Annusa 8 posti interessanti', goal: 8 },
  { id: 'greet', label: 'Annusata di rito ai 4 cani', goal: 4 },
  { id: 'fetch', label: 'Riporta la Chuckit a Marta', goal: 4 },
  { id: 'tug', label: 'Tira e molla con Biscotto', goal: 1 },
  { id: 'wrestle', label: 'Lotta per gioco con Olivia', goal: 1 },
  { id: 'tricks', label: 'Fai 3 trucchi per Marta', goal: 3 },
  { id: 'belly', label: 'Coccole a pancia in su', goal: 1 },
  { id: 'bath', label: 'Un bagno e poi zoomies', goal: 1 },
  { id: 'pigeons', label: 'Fai volare 8 piccioni', goal: 8 },
  { id: 'strike', label: 'Sciopero del guinzaglio', goal: 1 }
];
function resetMissions(){ G.missions = MISSIONS.map(m => ({ ...m, n: 0, done: false })); renderMissions(); }
function progress(id, k){
  const m = G.missions.find(x => x.id === id); if (!m || m.done) return;
  m.n = Math.min(m.goal, m.n + (k || 1));
  if (m.n >= m.goal){ m.done = true; addScore(15, 'green'); PM.sfx.mission(); toast('Missione compiuta: ' + m.label + '!'); }
  renderMissions();
}
function renderMissions(){
  const ul = $('mList'); ul.innerHTML = '';
  let d = 0;
  for (const m of G.missions){ if (m.done) d++; const li = document.createElement('li'); if (m.done) li.className = 'done'; li.innerHTML = '<span class="ck"></span><span></span><span class="n"></span>'; li.children[1].textContent = m.label; li.children[2].textContent = m.goal > 1 ? m.n + '/' + m.goal : ''; ul.appendChild(li); }
  $('mCount').textContent = d + '/' + G.missions.length;
}

/* ---------- Loading ---------- */
let W, potty, marta, giulia, franco, dogs = {}, ball, rope, leashMesh, pigeons = [];
const P = { carrying: null, action: null, leashed: true, inArea: false, sprint: false, speed: 0, barkCd: 0, zoomT: 0, wasIn: false, inWater: false, splootT: 0, lastFast: 0, greeted: {}, cuddleCd: 0, striking: 0 };
const MS = { mode: 'follow', hasBall: false, sayCd: 0, target: null, busy: 0 };
async function load(){
  const steps = [
    ['Preparo il Parco Vetra…', () => { W = PM.buildWorld(scene, { lowGrass: isTouch, lowShadow: isTouch, lowFoliage: isTouch }); }],
    ['Potty si stiracchia…', () => { potty = PM.buildDog('potty', QD.potty); scene.add(potty.root); }],
    ['Marta si lega lo chignon…', () => { marta = PM.buildHuman('marta', QD.marta); scene.add(marta.root); }],
    ['Arriva Biscotto…', () => { dogs.biscotto = PM.buildDog('biscotto', QD.dog); }],
    ['Arriva Luna…', () => { dogs.luna = PM.buildDog('luna', QD.dog); }],
    ['Pepe brontola…', () => { dogs.pepe = PM.buildDog('pepe', QD.dog); }],
    ['Olivia sbuffa…', () => { dogs.olivia = PM.buildDog('olivia', QD.dog); }],
    ['Giulia porta i suoi cani…', () => { giulia = PM.buildHuman('giulia', QD.human); scene.add(giulia.root); }],
    ['Il signor Franco si siede in panchina…', () => { franco = PM.buildHuman('franco', QD.human); scene.add(franco.root); }],
    ['Ultimi ritocchi…', () => { for (const k in dogs) scene.add(dogs[k].root); buildProps(); }]
  ];
  for (let i = 0; i < steps.length; i++){
    $('loadTxt').textContent = steps[i][0]; $('loadBar').style.width = (i / steps.length * 100) + '%';
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    steps[i][1]();
  }
  $('loadBar').style.width = '100%';
  setupNPCs(); resetGame(); G.mode = 'attract'; applyQuality(); homeJoy();
  $('loadScreen').hidden = true; $('startScreen').hidden = false; $('bestStart').innerHTML = bestText();
}

/* ---------- Props: ball, rope, leash, pigeons ---------- */
function buildProps(){
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#f26a1b'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#2a5cb4'; g.lineWidth = 26; g.beginPath(); for (let x = 0; x <= 256; x += 4){ const y = 64 + Math.sin(x / 256 * TAU * 2) * 32; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  const bt = new THREE.CanvasTexture(c); bt.encoding = THREE.sRGBEncoding;
  ball = { mesh: new THREE.Mesh(new THREE.SphereGeometry(0.032, 20, 14), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.55 })), pos: new V3(), vel: new V3(), state: 'hand', holder: null, fetchT: 0 };
  ball.mesh.castShadow = true; scene.add(ball.mesh);
  const curve = new THREE.CatmullRomCurve3([new V3(-0.16, 0, 0), new V3(-0.05, 0.015, 0.02), new V3(0.05, -0.01, -0.02), new V3(0.16, 0, 0)]);
  const rg = new THREE.Group();
  rg.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.014, 8, false), new THREE.MeshStandardMaterial({ color: '#d84a3a', roughness: 0.9 })));
  for (const x of [-0.16, 0.16]){ const k = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), new THREE.MeshStandardMaterial({ color: '#2f7fd1', roughness: 0.9 })); k.position.x = x; rg.add(k); }
  rg.traverse(o => { if (o.isMesh) o.castShadow = true; });
  rope = { mesh: rg, pos: new V3(W.ropeSpot.x, 0.03, W.ropeSpot.z), state: 'ground', holder: null };
  scene.add(rg);
  leashMesh = makeLeash('#b3242a', 0.007);
  // pigeons
  const bm = { body: new THREE.MeshStandardMaterial({ color: '#8e939c' }), dark: new THREE.MeshStandardMaterial({ color: '#5c616b' }), neck: new THREE.MeshStandardMaterial({ color: '#4d7a6d', metalness: 0.3, roughness: 0.4 }), beak: new THREE.MeshStandardMaterial({ color: '#3a3333' }) };
  for (let i = 0; i < 12; i++){
    const gr = new THREE.Group(), b = new THREE.Group(); gr.add(b);
    const m = (geo, mat, p, s) => { const x = new THREE.Mesh(geo, mat); x.position.set(...p); if (s) x.scale.set(...s); x.castShadow = true; b.add(x); return x; };
    m(new THREE.SphereGeometry(0.075, 10, 8), bm.body, [0, 0.11, 0], [0.8, 0.8, 1.25]);
    m(new THREE.SphereGeometry(0.045, 8, 6), bm.neck, [0, 0.165, 0.06]);
    const head = new THREE.Group(); head.position.set(0, 0.2, 0.085); b.add(head);
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.033, 8, 6), bm.dark); head.add(hm);
    const bk = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.03, 5), bm.beak); bk.rotation.x = Math.PI / 2; bk.position.z = 0.038; head.add(bk);
    m(new THREE.BoxGeometry(0.07, 0.015, 0.09), bm.dark, [0, 0.12, -0.12]);
    const wings = []; for (const sx of [-1, 1]){ const w = new THREE.Group(); w.position.set(sx * 0.05, 0.13, 0); b.add(w); const wm = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 5), bm.body); wm.scale.set(0.4, 0.25, 1.1); wm.position.x = sx * 0.03; w.add(wm); wings.push(w); }
    const p = randomLawn();
    pigeons.push({ g: gr, head, wings, pos: p, rot: Math.random() * TAU, state: 'walk', st: 0, target: null, vel: new V3(), peck: 0 });
    gr.position.copy(p); scene.add(gr);
  }
}
function randomLawn(near, rad){
  for (let i = 0; i < 60; i++){
    const x = near ? near.x + (Math.random() - 0.5) * rad * 2 : -34 + Math.random() * 70, z = near ? near.z + (Math.random() - 0.5) * rad * 2 : -24 + Math.random() * 50;
    if (PM.inDogArea(x, z)) continue;
    const s = W.surface(x, z); if (s.stone > 0.3) continue;
    return new V3(x, 0, z);
  }
  return new V3(0, 0, 10);
}

/* ---------- NPCs ---------- */
const NPC = {};
function setupNPCs(){
  const bench = W.benches.find(b => Math.abs(b.z - (L.LOOP.z1 + 1.6)) < 0.2 && b.x < -10) || W.benches[0];
  NPC.bench = bench;
  NPC.dogs = {
    biscotto: { dog: dogs.biscotto, home: 'area', state: 'wander', t: 0, target: null, owner: 'giulia', name: 'Biscotto', personality: 'giocherellone', pitch: 260 },
    luna: { dog: dogs.luna, home: 'area', state: 'wander', t: 0, target: null, owner: 'giulia', name: 'Luna', personality: 'velocissima', pitch: 380 },
    pepe: { dog: dogs.pepe, home: 'bench', state: 'wander', t: 0, target: null, owner: 'franco', name: 'Pepe', personality: 'brontolone', pitch: 520, leash: 2.4 },
    olivia: { dog: dogs.olivia, home: 'bench', state: 'wander', t: 0, target: null, owner: 'franco', name: 'Olivia', personality: 'coccolona', pitch: 470, leash: 2.6 }
  };
}
function placeNPCs(){
  const D = L.DOG, b = NPC.bench;
  const set = (d, x, z, h) => { d.st.pos.set(x, 0, z); d.st.heading = h || 0; d.st.speed = 0; d.st.pose = 'stand'; };
  set(dogs.biscotto, D.x1 - 6, D.z0 + 5, 1); set(dogs.luna, D.x1 - 3, (D.z0 + D.z1) / 2, -1);
  set(dogs.pepe, b.front.x + 0.6, b.front.z - 0.6, Math.PI); set(dogs.olivia, b.front.x - 0.7, b.front.z - 0.4, Math.PI);
  giulia.st.pos.set(D.x1 - 4, 0, (D.z0 + D.z1) / 2 + 2); giulia.st.heading = -Math.PI / 2;
  franco.st.pos.set(b.x, 0, b.z); franco.st.heading = b.ry; franco.st.pose = 'sit'; franco.st.seatY = 0.45;
  for (const k in NPC.dogs){ const n = NPC.dogs[k]; n.state = 'wander'; n.t = Math.random() * 3; n.target = null; n.greetCd = 0; n.grumpy = 0; }
}
function npcAnchor(n){ return n.home === 'area' ? null : new V3(NPC.bench.front.x, 0, NPC.bench.front.z - 0.5); }
function steer(d, target, maxSp, dt, r){
  const s = d.st; const dx = target.x - s.pos.x, dz = target.z - s.pos.z, dd = Math.hypot(dx, dz);
  const sp = dd > 0.08 ? Math.min(maxSp, dd * 2.2) : 0;
  s.speed = damp(s.speed, sp, 6, dt);
  if (dd > 0.05) s.heading = angDamp(s.heading, Math.atan2(dx, dz), 7, dt);
  s.pos.x += Math.sin(s.heading) * s.speed * dt; s.pos.z += Math.cos(s.heading) * s.speed * dt;
  PM.collide(W, s.pos, r || 0.2, { parkOnly: true });
  return dd;
}
function updateNPCDogs(dt){
  const D = L.DOG;
  for (const k in NPC.dogs){
    const n = NPC.dogs[k], d = n.dog, s = d.st; n.t -= dt; n.greetCd = Math.max(0, (n.greetCd || 0) - dt);
    s.look = null; s.happy = 0.5; s.pant = 0.35;
    if (P.action && P.action.npc === n){ PM.animateDog(d, dt, W.getH); continue; }
    const pd = dist2(s.pos, potty.st.pos);
    if (n.state === 'carryBall'){
      // Luna parades with the ball, drops it if Potty barks or catches up
      if (n.t < 0 || !n.target || dist2(s.pos, n.target) < 0.5){ n.target = new V3(D.x0 + 2 + Math.random() * (D.x1 - D.x0 - 4), 0, D.z0 + 2 + Math.random() * (D.z1 - D.z0 - 4)); n.t = 2; }
      steer(d, n.target, 3.2, dt); s.holding = true; s.happy = 1;
      if (pd < 0.7){ dropBall(d); n.state = 'wander'; n.t = 4; say(n, 'Va bene, tienila tu!'); }
    } else if (n.state === 'chaseBall'){
      if (ball.state !== 'free' && ball.state !== 'flying'){ n.state = 'wander'; }
      else { steer(d, ball.pos, k === 'luna' ? 4.6 : 3.5, dt); if (ball.state === 'free' && dist2(PM.mouthWorld(d, tv1), ball.pos) < 0.3){ grabBall(d); n.state = 'carryBall'; n.t = 6; toast('Luna ti ha rubato la Chuckit! Rincorrila o abbaiale.'); } }
    } else if (n.state === 'play'){
      n.t -= 0;
    } else {
      // wander / idle / approach
      const anchor = npcAnchor(n);
      if (n.t < 0){
        n.t = 3 + Math.random() * 5;
        const r = Math.random();
        if (r < 0.25){ s.pose = pick(['sit', 'lie', 'sniff']); n.target = null; }
        else { s.pose = 'stand'; n.target = anchor ? new V3(anchor.x + (Math.random() - 0.5) * n.leash * 1.6, 0, anchor.z + (Math.random() - 0.5) * n.leash * 1.4) : new V3(D.x0 + 1.5 + Math.random() * (D.x1 - D.x0 - 3), 0, D.z0 + 1.5 + Math.random() * (D.z1 - D.z0 - 3)); }
      }
      // curious about Potty
      if (pd < 5 && pd > 1.1 && !anchor && Math.random() < dt * 0.6){ n.target = potty.st.pos.clone(); s.pose = 'stand'; }
      if (n.target) { const dd = steer(d, n.target, k === 'luna' ? 2.4 : 1.3, dt); if (dd < 0.3){ n.target = null; } }
      else s.speed = damp(s.speed, 0, 6, dt);
      if (pd < 3) s.look = potty.bones.head.getWorldPosition(new V3());
      // Pepe grumbles at rushing dogs
      if (k === 'pepe' && pd < 2.6 && P.lastFast > 0 && !P.greeted.pepe && n.grumpy <= 0){ n.grumpy = 3; PM.dogBark(d); PM.sfx.otherBark(n.pitch); say(n, 'Grrr! Piano!', true); toast('Pepe non ama chi arriva di corsa: avvicinati camminando.'); }
      n.grumpy = Math.max(0, n.grumpy - dt);
      if (anchor){ const dx = s.pos.x - anchor.x, dz = s.pos.z - anchor.z, l = Math.hypot(dx, dz); if (l > n.leash){ s.pos.x = anchor.x + dx / l * n.leash; s.pos.z = anchor.z + dz / l * n.leash; } }
      else { s.pos.x = clamp(s.pos.x, D.x0 + 0.5, D.x1 - 0.5); s.pos.z = clamp(s.pos.z, D.z0 + 0.5, D.z1 - 0.5); }
      s.holding = false;
    }
    // Luna chases thrown balls sometimes
    if (k === 'luna' && n.state === 'wander' && ball.state === 'flying' && ball.lunaChase){ n.state = 'chaseBall'; s.pose = 'stand'; }
    const far = dist2(s.pos, camera.position) > 48; d.root.visible = !far;
    if (!far || (s.cullT = (s.cullT || 0) + dt) > 0.5){ s.cullT = 0; PM.animateDog(d, far ? 0.5 : dt, W.getH); }
  }
  // Franco on the bench, Giulia in the dog area
  franco.st.look = potty.st.pos.clone().setY(0.4); franco.st.pose = 'sit';
  franco.root.visible = dist2(franco.st.pos, camera.position) < 48; if (franco.root.visible) PM.animateHuman(franco, dt, W.getH);
  const gd = dist2(giulia.st.pos, potty.st.pos);
  giulia.st.look = gd < 6 ? potty.st.pos.clone().setY(0.3) : dogs.biscotto.st.pos.clone().setY(0.4);
  giulia.root.visible = dist2(giulia.st.pos, camera.position) < 48; if (giulia.root.visible) PM.animateHuman(giulia, dt, W.getH);
  // leashes for Pepe and Olivia (held by Franco)
  updateNpcLeash('pepe'); updateNpcLeash('olivia');
}
const npcLeash = {};
function updateNpcLeash(k){
  const d = dogs[k];
  if (!npcLeash[k]) npcLeash[k] = makeLeash(k === 'pepe' ? '#2b2b2b' : '#d94f6a', 0.006);
  const far = dist2(franco.st.pos, camera.position) > 55; npcLeash[k].visible = !far; if (far) return;
  (k === 'pepe' ? franco.handR : franco.handL).getWorldPosition(_ea); d.leashAnchor.getWorldPosition(_eb);
  setLeash(npcLeash[k], _ea, _eb, NPC.dogs[k].leash + 0.6);
}
/* A leash is a chain of thin instanced cylinders along a sagging curve: no per-frame geometry allocation. */
const _ea = new V3(), _eb = new V3();
const LEASH_N = 14, _lq = new THREE.Quaternion(), _lm = new THREE.Matrix4(), _ls = new V3(), _la = new V3(), _lb = new V3(), _lmid = new V3(), _lp = new V3(), _lprev = new V3(), _lup = new V3(0, 1, 0);
function makeLeash(color, r){
  const g = new THREE.CylinderGeometry(r, r, 1, 5, 1, true); g.translate(0, 0.5, 0);
  const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }), LEASH_N);
  m.frustumCulled = false; scene.add(m); return m;
}
function setLeash(im, a, b, len){
  const dd = a.distanceTo(b), sag = Math.max(0.02, (len - dd) * 0.45);
  _lmid.copy(a).lerp(b, 0.5); _lmid.y = Math.max(0.02, _lmid.y - sag);
  _lprev.copy(a);
  for (let i = 1; i <= LEASH_N; i++){
    const t = i / LEASH_N, u = 1 - t;
    _lp.set(u * u * a.x + 2 * u * t * _lmid.x + t * t * b.x, u * u * a.y + 2 * u * t * _lmid.y + t * t * b.y, u * u * a.z + 2 * u * t * _lmid.z + t * t * b.z);
    _lb.copy(_lp).sub(_lprev); const l = _lb.length() || 1e-4;
    _lq.setFromUnitVectors(_lup, _lb.multiplyScalar(1 / l)); _ls.set(1, l * 1.05, 1);
    _lm.compose(_lprev, _lq, _ls); im.setMatrixAt(i - 1, _lm); _lprev.copy(_lp);
  }
  im.instanceMatrix.needsUpdate = true;
}

/* ---------- Labels & toasts ---------- */
const labelsEl = $('labels'); const labels = [];
const tv1 = new V3(), tv2 = new V3(), tv3 = new V3();
function label(text, cls, getPos, life, rise){
  const el = document.createElement('div'); el.className = 'lbl3d ' + cls; el.textContent = text; labelsEl.appendChild(el);
  labels.push({ el, getPos, t: 0, life: life || 1.4, rise: rise == null ? 0.5 : rise });
}
function say(who, text, npc){
  const H = who.isHuman ? who : null;
  const getPos = H ? () => H.bones.head.getWorldPosition(new V3()).add(new V3(0, 0.28, 0)) : (who.dog ? () => who.dog.bones.head.getWorldPosition(new V3()).add(new V3(0, 0.25, 0)) : who);
  label(text, 'say' + ((npc || who.dog) ? ' npc' : ''), getPos, 2.2, 0.03);
}
function martaSay(text){ say(marta, text); }
function toast(msg, dur){ G.toastQ.push([msg, dur || 3]); }
function hint(key, msg){ if (G.hintShown[key]) return; G.hintShown[key] = 1; toast(msg, 3.6); }
function addScore(n, cls, pos){ G.score += n; label('+' + n, 'pop' + (cls ? ' ' + cls : ''), () => (pos || potty.st.pos).clone().setY(0.9), 1.3, 0.8); }

/* ---------- Input ---------- */
const keys = new Set(); const input = { x: 0, z: 0, sprint: false, act: false, actPressed: false };
let manualCamT = 0, camYaw = 0;
addEventListener('keydown', e => {
  if (e.repeat && (e.code === 'Space' || e.code === 'KeyE')) return;
  keys.add(e.code);
  if (G.mode === 'play'){
    if (e.code === 'Space' || e.code === 'KeyB'){ bark(); e.preventDefault(); }
    if (e.code === 'KeyE' || e.code === 'Enter'){ input.actPressed = true; }
    if (/^Digit[1-4]$/.test(e.code)) answerTrick(+e.code.slice(5) - 1);
    if (e.code === 'Escape' || e.code === 'KeyP') pause(true);
    if (e.code.startsWith('Arrow')) e.preventDefault();
  } else if (G.mode === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) pause(false);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const joyEl = $('joy'), knobEl = $('knob');
const STICK_R = 64;
let stick = null, look = null, camTilt = 0.18, camDist = 3.4, camRecenter = 0, camOff = 0.2;
const safe = { t: 0, r: 0, b: 0, l: 0 };
function readSafe(){
  const pr = document.createElement('div');
  pr.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(pr); const cs = getComputedStyle(pr);
  safe.t = parseFloat(cs.paddingTop) || 0; safe.r = parseFloat(cs.paddingRight) || 0; safe.b = parseFloat(cs.paddingBottom) || 0; safe.l = parseFloat(cs.paddingLeft) || 0; pr.remove();
}
function placeJoy(x, y){ joyEl.style.left = x + 'px'; joyEl.style.top = y + 'px'; }
function homeJoy(){ readSafe(); const r = STICK_R + 14; placeJoy(Math.max(r + 8, safe.l + r + 14), innerHeight - Math.max(r + 8, safe.b + r + 10)); knobEl.style.transform = ''; joyEl.classList.add('idle'); joyEl.classList.remove('sprint'); }
function dropTouch(){ stick = null; look = null; if (joyEl) homeJoy(); }
function updateKnob(){
  const dx = stick.x - stick.x0, dy = stick.y - stick.y0, L = Math.hypot(dx, dy) / STICK_R, c = Math.max(1, L);
  knobEl.style.transform = `translate(${dx / c}px,${dy / c}px)`; joyEl.classList.toggle('sprint', L > 1.3);
}
canvas.addEventListener('pointerdown', e => {
  PM.audio.init();
  if (G.mode !== 'play') return;
  canvas.focus({ preventScroll: true });
  const touchLike = e.pointerType !== 'mouse';
  if (touchLike && !stick && e.clientX < innerWidth * 0.5){
    const r = STICK_R + 12, x = clamp(e.clientX, safe.l + r, innerWidth * 0.5), y = clamp(e.clientY, safe.t + 70 + r, innerHeight - safe.b - r);
    stick = { id: e.pointerId, x0: x, y0: y, x: e.clientX, y: e.clientY };
    joyEl.classList.remove('idle'); placeJoy(x, y); $('joyHint').hidden = true; updateKnob();
  } else if (!look) look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
});
addEventListener('pointermove', e => {
  if (stick && e.pointerId === stick.id){ stick.x = e.clientX; stick.y = e.clientY; updateKnob(); }
  else if (look && e.pointerId === look.id){
    const dx = e.clientX - look.x, dy = e.clientY - look.y; look.x = e.clientX; look.y = e.clientY;
    camYaw -= dx * (3.4 / Math.max(320, innerWidth)); camTilt = clamp(camTilt + dy * (1.7 / Math.max(320, innerHeight)), -0.2, 0.9); manualCamT = 2.5; camRecenter = 0;
  }
}, { passive: true });
const endPtr = e => { if (stick && e.pointerId === stick.id){ stick = null; homeJoy(); } if (look && e.pointerId === look.id) look = null; };
addEventListener('pointerup', endPtr); addEventListener('pointercancel', endPtr);
addEventListener('touchcancel', dropTouch); addEventListener('blur', dropTouch);
// no pinch-zoom or context menu while playing
['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
canvas.addEventListener('contextmenu', e => e.preventDefault());
const barkBtn = $('btnBark'), actBtn = $('btnAct');
barkBtn.addEventListener('pointerdown', e => { e.preventDefault(); PM.audio.init(); barkBtn.classList.add('down'); if (G.mode === 'play') bark(); });
let actHeld = false;
actBtn.addEventListener('pointerdown', e => { e.preventDefault(); PM.audio.init(); actBtn.classList.add('down'); actHeld = true; input.actPressed = true; });
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => { barkBtn.addEventListener(ev, () => barkBtn.classList.remove('down')); actBtn.addEventListener(ev, () => { actBtn.classList.remove('down'); actHeld = false; }); });
barkBtn.addEventListener('click', e => { if (e.detail === 0 && G.mode === 'play') bark(); });
actBtn.addEventListener('click', e => { if (e.detail === 0 && G.mode === 'play') input.actPressed = true; });
function readInput(){
  let x = 0, z = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
  const m = Math.hypot(x, z); if (m > 1){ x /= m; z /= m; }
  input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (stick){ const dx = stick.x - stick.x0, dy = stick.y - stick.y0, L = Math.hypot(dx, dy) / STICK_R; if (L > 0.12){ const mag = Math.pow(clamp((L - 0.12) / 0.78, 0, 1), 1.1); x = dx / (L * STICK_R) * mag; z = -dy / (L * STICK_R) * mag; input.sprint = L > 1.3; } }
  if (stickOverride){ x = stickOverride.x; z = stickOverride.z; input.sprint = stickOverride.sprint; }
  input.x = x; input.z = z; input.act = keys.has('KeyE') || keys.has('Enter') || actHeld;
}
let stickOverride = null; // only used by the ?debug test hook

/* ---------- Ball ---------- */
function grabBall(d){ ball.state = 'held'; ball.holder = d; d.st.holding = true; }
function dropBall(d){ ball.state = 'free'; ball.holder = null; d.st.holding = false; PM.mouthWorld(d, ball.pos); ball.pos.y = Math.max(0.035, ball.pos.y); ball.vel.set((Math.random() - 0.5) * 0.6, 0.5, (Math.random() - 0.5) * 0.6); }
function throwBall(){
  const D = L.DOG; marta.handR.getWorldPosition(ball.pos);
  let tx, tz; for (let i = 0; i < 30; i++){ const a = Math.random() * TAU, r = 3.5 + Math.random() * 4.5; tx = marta.st.pos.x + Math.cos(a) * r; tz = marta.st.pos.z + Math.sin(a) * r; if (tx > D.x0 + 1 && tx < D.x1 - 1 && tz > D.z0 + 1 && tz < D.z1 - 1) break; }
  const T = 0.9; ball.vel.set((tx - ball.pos.x) / T, (0.035 - ball.pos.y + 0.5 * 9.8 * T * T) / T, (tz - ball.pos.z) / T);
  ball.state = 'flying'; ball.holder = null; ball.fetchT = 0; MS.hasBall = false;
  ball.lunaChase = Math.random() < 0.35 && NPC.dogs.luna.state === 'wander';
  marta.st.heading = Math.atan2(tx - marta.st.pos.x, tz - marta.st.pos.z);
  PM.sfx.throwIt();
}
function updateBall(dt){
  if (ball.state === 'hand'){ marta.handR.getWorldPosition(ball.pos); }
  else if (ball.state === 'held'){ PM.mouthWorld(ball.holder, ball.pos); }
  else {
    ball.fetchT += dt; ball.vel.y -= 9.8 * dt; ball.pos.addScaledVector(ball.vel, dt);
    const r = 0.032;
    if (ball.pos.y < r){ ball.pos.y = r; if (ball.vel.y < -1){ ball.vel.y *= -0.5; ball.vel.x *= 0.8; ball.vel.z *= 0.8; } else { ball.vel.y = 0; ball.vel.x = damp(ball.vel.x, 0, 1.4, dt); ball.vel.z = damp(ball.vel.z, 0, 1.4, dt); } ball.state = 'free'; }
    const D = L.DOG; if (ball.pos.x < D.x0 + 0.2 || ball.pos.x > D.x1 - 0.2){ ball.vel.x *= -0.5; ball.pos.x = clamp(ball.pos.x, D.x0 + 0.2, D.x1 - 0.2); } if (ball.pos.z < D.z0 + 0.2 || ball.pos.z > D.z1 - 0.2){ ball.vel.z *= -0.5; ball.pos.z = clamp(ball.pos.z, D.z0 + 0.2, D.z1 - 0.2); }
    ball.mesh.rotation.x += ball.vel.z * dt / r; ball.mesh.rotation.z -= ball.vel.x * dt / r;
    if (!P.carrying && !P.action && ball.pos.y < 0.2 && dist2(PM.mouthWorld(potty, tv1), ball.pos) < 0.28){ grabBall(potty); P.carrying = 'ball'; PM.sfx.pickup(); hint('ballBack', 'Presa! Riportala a Marta.'); }
  }
  ball.mesh.position.copy(ball.pos);
  // Marta takes the ball back
  if (ball.state === 'held' && ball.holder === potty && dist2(potty.st.pos, marta.st.pos) < 1.0 && !P.action){
    ball.state = 'hand'; ball.holder = null; potty.st.holding = false; P.carrying = null; MS.hasBall = true;
    const pts = 8 + Math.max(0, 8 - Math.floor(ball.fetchT));
    addScore(pts); PM.sfx.score(); progress('fetch'); G.stats.fetch = (G.stats.fetch || 0) + 1;
    martaSay(pick(['Brava Potty!', 'Che campionessa!', 'Ancora? Ok!', 'Bravissima amore!']));
    marta.st.pose = 'crouch'; MS.busy = 1.2; potty.st.happy = 1;
  }
}

/* ---------- Rope / tug of war ---------- */
function updateRope(dt){
  if (rope.state === 'held'){ PM.mouthWorld(rope.holder, rope.pos); rope.mesh.position.copy(rope.pos); rope.mesh.rotation.set(0, rope.holder.st.heading + Math.PI / 2, 0); }
  else if (rope.state === 'tug'){ const a = PM.mouthWorld(potty, tv1), b = PM.mouthWorld(dogs.biscotto, tv2); rope.mesh.position.copy(a).lerp(b, 0.5); rope.mesh.lookAt(b); rope.mesh.rotateY(Math.PI / 2); rope.mesh.scale.x = Math.max(1, a.distanceTo(b) / 0.32); }
  else { rope.mesh.position.copy(rope.pos); rope.mesh.scale.x = 1; if (!P.carrying && !P.action && dist2(PM.mouthWorld(potty, tv1), rope.pos) < 0.3){ rope.state = 'held'; rope.holder = potty; potty.st.holding = true; P.carrying = 'rope'; PM.sfx.pickup(); hint('rope', 'Hai la corda! Portala a Biscotto per giocare a tira e molla.'); } }
}

/* ---------- Actions (context button) ---------- */
function nearestScent(){
  let best = null, bd = 1e9;
  for (const s of W.scent){ if (s.done) continue; const d = Math.hypot(s.x - potty.st.pos.x, s.z - potty.st.pos.z) - s.r; if (d < 0.6 && d < bd){ bd = d; best = s; } }
  return best;
}
const SNIFFS = {
  tree: ['Qui è passato un labrador. Di recente.', 'Odore di scoiattolo… o era un piccione?', 'Pipì di Biscotto, la riconosceresti ovunque.', 'Un bassotto nervoso. Pepe, sei tu?', 'Corteccia di platano e un po\' di aperitivo dei Navigli.'],
  bush: ['Qualcuno ha perso un pezzo di focaccia!', 'Un gatto. Senza ombra di dubbio.', 'Odore di merenda dei bambini.', 'Una pallina vecchissima, sepolta qui.'],
  lamp: ['Il lampione: la bacheca del quartiere.', 'Ventitré cani diversi. Che chiacchiere.', 'Un cucciolo di barboncino, appena arrivato.'],
  bin: ['Panino al salame. Ma il cestino è alto.', 'Patatine della movida di ieri sera.', 'Gelato al pistacchio, rovesciato.'],
  bench: ['Briciole di pizza al trancio.', 'Qui si è seduta una signora con un gatto in borsa.', 'Profumo di caffè e cornetto.'],
  kiosk: ['Profumo di gelato del chiosco.', 'Ghiaccioli al limone. Sbav.'],
  semaforo: ['Il palo del semaforo: mezzo quartiere passa di qui.', 'Un bassotto aspettava il verde. Nervoso.'],
  scooter: ['Gomma, benzina e un po\' di gatto.', 'Questo motorino è stato da un panettiere.'],
  bar: ['Cornetto alla crema caduto sotto il tavolino!', 'Profumo di caffè e di aperitivo.']
};
let actionHoldT = 0;
function contextAction(){
  const pp = potty.st.pos;
  if (G.ending && G.ending.phase === 'home' && P.leashed) return { id: 'strike', label: 'Pianta le zampe', hold: true };
  if (G.trick) return null;
  if (P.peeT > 0 && (G.peeCount || 0) < 4 && !P.carrying) return { id: 'pee', label: 'Pipì' };
  if (P.poopReady && !P.carrying){ const sf = W.surface(pp.x, pp.z); if (sf.lawn > 0.5 || sf.dirt > 0.5) return { id: 'poop', label: 'Cacca' }; }
  // tug: holding rope near Biscotto
  if (P.carrying === 'rope' && dist2(pp, dogs.biscotto.st.pos) < 1.6) return { id: 'tug', label: 'Tira e molla' };
  // greet / play with dogs
  let nd = null, nk = null, ndist = 1e9;
  for (const k in NPC.dogs){ const d = dist2(pp, NPC.dogs[k].dog.st.pos); if (d < 1.5 && d < ndist){ ndist = d; nd = NPC.dogs[k]; nk = k; } }
  if (nd){
    if (!P.greeted[nk]) return { id: 'greet', label: 'Saluta ' + nd.name, npc: nd, k: nk };
    if (nk === 'olivia' && !G.missions.find(m => m.id === 'wrestle').done) return { id: 'wrestle', label: 'Lotta con Olivia', npc: nd, k: nk };
    if (nk === 'biscotto' && P.carrying !== 'rope') return { id: 'hint-rope', label: 'Gioca', npc: nd, k: nk };
    if (nk === 'luna' && ball.holder === dogs.luna) return null;
  }
  // water
  if (dist2(pp, W.bowl) < 0.8) return { id: 'drink', label: 'Bevi', at: W.bowl };
  // Marta
  const md = dist2(pp, marta.st.pos);
  if (md < 1.8 && P.inArea && !P.leashed && MS.hasBall && !P.carrying) return { id: 'throw', label: 'Lancia!' };
  const sc = nearestScent();
  if (sc) return { id: 'sniff', label: 'Annusa', hold: true, spot: sc };
  if (md < 1.3 && P.cuddleCd <= 0 && !P.carrying) return { id: 'cuddle', label: 'Coccole' };
  return null;
}
function startAction(a){
  const s = potty.st;
  if (a.id === 'pee'){ P.action = { type: 'pee', t: 0 }; P.peeT = 0; return; }
  if (a.id === 'poop'){ P.action = { type: 'poop', t: 0 }; P.poopReady = false; return; }
  if (a.id === 'greet'){
    const n = a.npc; if (a.k === 'pepe' && n.grumpy > 0){ toast('Pepe è ancora offeso. Aspetta un momento e arriva piano.'); return; }
    P.action = { type: 'greet', t: 0, npc: n, k: a.k };
    PM.sfx.snort();
  } else if (a.id === 'wrestle'){ P.action = { type: 'wrestle', t: 0, npc: a.npc }; PM.sfx.grumble(); }
  else if (a.id === 'tug'){ P.action = { type: 'tug', t: 0, npc: NPC.dogs.biscotto, power: 0.5 }; rope.state = 'tug'; dogs.biscotto.st.holding = true; toast('Tira e molla! Premi Azione più veloce che puoi.'); }
  else if (a.id === 'hint-rope'){ toast('Biscotto adora il tira e molla: cerca la corda rossa nell\'area cani.'); }
  else if (a.id === 'drink'){ P.action = { type: 'drink', t: 0 }; }
  else if (a.id === 'throw'){ throwBall(); martaSay(pick(['Vai Potty!', 'Prendila!', 'Dov\'è la pallina?'])); }
  else if (a.id === 'cuddle'){ P.action = { type: 'belly', t: 0 }; marta.st.pose = 'kneel'; MS.busy = 4; martaSay(pick(['Chi vuole i grattini?', 'Pancino!', 'Vieni qui, patatina'])); }
}
function updateAction(dt){
  const a = P.action, s = potty.st; if (!a) return;
  a.t += dt;
  if (a.t > 14){ // safety net: no action may last long enough to look like a freeze
    P.action = null; s.pose = 'stand'; s.tug = 0; s.eyesClosed = 0; marta.st.armR = null; marta.st.armL = null; marta.st.pose = 'stand'; hideRing(); if (rope.state === 'tug'){ rope.state = 'ground'; rope.pos.copy(s.pos).setY(0.03); dogs.biscotto.st.holding = false; dogs.biscotto.st.tug = 0; } return;
  }
  s.speed = damp(s.speed, 0, 8, dt);
  if (a.type === 'greet'){
    const o = a.npc.dog.st;
    // walk behind the other dog, ritual sniff, then the other dog sniffs back
    const rear = tv1.set(o.pos.x - Math.sin(o.heading) * 0.42 * (a.npc.dog.B.L / 0.3), 0, o.pos.z - Math.cos(o.heading) * 0.42 * (a.npc.dog.B.L / 0.3));
    if (a.t < 2.4){ const dd = steer(potty, rear, 1.0, dt, 0.15); if (dd < 0.15){ s.heading = angDamp(s.heading, Math.atan2(o.pos.x - s.pos.x, o.pos.z - s.pos.z), 6, dt); s.pose = 'sniff'; } o.speed = 0; o.pose = 'stand'; o.happy = 1; }
    if (a.t > 1.4 && a.t < 1.5) PM.sfx.sniff();
    if (a.t > 2.4){ s.pose = 'stand'; o.look = potty.bones.hips.getWorldPosition(new V3()); }
    if (a.t > 3.4){
      P.greeted[a.k] = true; P.action = null; o.pose = 'stand';
      const lines = { biscotto: 'Biscotto scodinzola a elica!', luna: 'Luna ti gira intorno: vuole radunarti.', pepe: 'Pepe approva. Per oggi.', olivia: 'Olivia sbuffa felice: due nasi schiacciati si capiscono.' };
      toast(lines[a.k]); addScore(5, null, s.pos); progress('greet'); PM.sfx.snort();
      if (a.k === 'olivia') hint('wrestle', 'Olivia vuole giocare alla lotta: premi Azione vicino a lei.');
    }
  } else if (a.type === 'wrestle'){
    const o = a.npc.dog.st;
    if (a.t < 1.2){ s.pose = 'bow'; o.pose = 'bow'; s.heading = angDamp(s.heading, Math.atan2(o.pos.x - s.pos.x, o.pos.z - s.pos.z), 8, dt); o.heading = angDamp(o.heading, Math.atan2(s.pos.x - o.pos.x, s.pos.z - o.pos.z), 8, dt); }
    else if (a.t < 4.5){ const ph = Math.floor((a.t - 1.2) / 0.8) % 2; s.pose = ph ? 'roll' : 'stand'; o.pose = ph ? 'bow' : 'roll'; s.happy = 1; o.happy = 1; if (Math.random() < dt * 3) PM.sfx.grumble(); if (Math.random() < dt * 4) spawnHearts(s.pos, 1); }
    else { s.pose = 'stand'; o.pose = 'stand'; P.action = null; addScore(10); progress('wrestle'); toast('Lotta da bulldog: nessun vincitore, tanta bava.'); }
  } else if (a.type === 'tug'){
    const o = a.npc.dog.st;
    a.power = clamp(a.power - dt * 0.33 + (input.actPressed ? 0.075 : 0), 0, 1);
    const dirx = o.pos.x - s.pos.x, dirz = o.pos.z - s.pos.z, l = Math.hypot(dirx, dirz) || 1;
    s.heading = Math.atan2(dirx, dirz); o.heading = Math.atan2(-dirx, -dirz);
    const shift = Math.sin(a.t * 9) * 0.02 + (a.power - 0.5) * 0.01;
    s.pos.x -= dirx / l * shift; s.pos.z -= dirz / l * shift; o.pos.x -= dirx / l * shift; o.pos.z -= dirz / l * shift;
    if (l > 0.7){ o.pos.x -= dirx / l * dt * 0.8; o.pos.z -= dirz / l * dt * 0.8; } if (l < 0.5){ o.pos.x += dirx / l * dt * 0.5; o.pos.z += dirz / l * dt * 0.5; }
    s.tug = 1; o.tug = 1; s.pose = 'stand'; o.pose = 'stand';
    if (Math.random() < dt * 2.5) PM.sfx.grumble();
    showRing(a.power, potty.st.pos);
    if (a.t > 6){
      s.tug = 0; o.tug = 0; P.action = null; hideRing();
      const win = a.power > 0.5;
      rope.state = 'held'; rope.holder = win ? potty : dogs.biscotto; potty.st.holding = win; dogs.biscotto.st.holding = !win; P.carrying = win ? 'rope' : null;
      if (!win){ setTimeout(() => { if (rope.holder === dogs.biscotto){ rope.state = 'ground'; rope.pos.copy(dogs.biscotto.st.pos).setY(0.03); dogs.biscotto.st.holding = false; } }, 2500); }
      addScore(win ? 14 : 8); progress('tug'); toast(win ? 'Hai vinto il tira e molla! Biscotto si arrende.' : 'Biscotto pesa 30 chili: ha vinto lui, ma ti sei divertita.');
    }
  } else if (a.type === 'drink'){
    s.pose = 'drink'; G.fresco = Math.min(100, G.fresco + dt * 22); if (Math.random() < dt * 8) PM.sfx.lap();
    if (a.t > 2.2 || G.fresco >= 100){ P.action = null; s.pose = 'stand'; }
  } else if (a.type === 'belly'){
    const mp = marta.st.pos; const tgt = tv1.set(mp.x + Math.sin(marta.st.heading) * 0.55, 0, mp.z + Math.cos(marta.st.heading) * 0.55);
    if (a.t < 0.8) steer(potty, tgt, 1.0, dt, 0.15);
    else { s.pose = 'roll'; s.happy = 1; s.eyesClosed = a.t > 1.6 ? 1 : 0; marta.st.armR = potty.bones.spine.getWorldPosition(new V3()).add(new V3(0, 0.12, 0)); marta.st.armR.x += Math.sin(a.t * 9) * 0.05; marta.st.look = potty.bones.head.getWorldPosition(new V3()); if (Math.random() < dt * 4) spawnHearts(s.pos, 1); }
    if (a.t > 4.5){ P.action = null; s.pose = 'stand'; s.eyesClosed = 0; marta.st.armR = null; marta.st.pose = 'stand'; P.cuddleCd = 25; addScore(10); progress('belly'); }
  } else if (a.type === 'trick'){
    const T = a.trick;
    s.pose = T === 'seduta' ? 'sit' : T === 'zampa' ? 'paw' : T === 'terra' ? 'lie' : 'stand';
    if (T === 'bacino' && a.t < 0.1){ PM.dogJump(potty, 0.18, 0.5); }
    if (T === 'zampa'){ marta.st.armR = potty.bones.f3R.getWorldPosition(new V3()).add(new V3(0, 0.03, 0.04)); }
    if (a.t > 1.8){ P.action = null; s.pose = 'stand'; marta.st.armR = null; marta.st.pose = 'stand'; }
  } else if (a.type === 'pee'){
    s.pose = 'squat'; s.hunch = 0;
    if (a.t > 0.6 && !a.puddle){ a.puddle = true; makePuddle(); }
    if (a.t > 2.6){ P.action = null; s.pose = 'stand'; G.peeCount = (G.peeCount || 0) + 1; addScore(3); progress('pee'); label(pick(['Messaggio lasciato.', 'Firmato: Potty.', 'Questo posto ora è mio.']), 'sniff', () => potty.st.pos.clone().setY(0.8), 2.2, 0.1); }
  } else if (a.type === 'poop'){
    s.pose = 'squat'; s.hunch = 1;
    if (a.t > 1.6 && !a.done){ a.done = true; makePoop(); }
    if (a.t > 3.0){ P.action = null; s.pose = 'stand'; s.hunch = 0; MS.mode = MS.mode === 'area' ? 'area' : MS.mode; MS.poop = true; MS.poopStage = 'go'; MS.poopT = 0; martaSay(pick(['Brava! Prendo il sacchetto.', 'Ecco fatto. Sacchetto!'])); PM.sfx.snort(); }
  } else if (a.type === 'sploot'){
    s.pose = 'sploot'; G.fresco = Math.min(100, G.fresco + dt * 8);
    if (a.t > 3){ P.action = null; s.pose = 'stand'; G.fresco = Math.max(G.fresco, 30); }
  }
}

/* ---------- Tricks ---------- */
const TRICKS = [['seduta', 'Seduta'], ['zampa', 'Zampa'], ['terra', 'Terra'], ['bacino', 'Bacino']];
const trickBox = $('tricks');
TRICKS.forEach((t, i) => { const b = document.createElement('button'); b.innerHTML = '<kbd>' + (i + 1) + '</kbd>' + t[1]; b.addEventListener('pointerdown', e => { e.preventDefault(); answerTrick(i); }); trickBox.appendChild(b); });
function askTrick(force, red){
  const i = force != null ? force : (Math.random() * TRICKS.length) | 0; G.trick = { want: i, t: red ? 7 : 4.5, red: !!red, stubborn: !red && !G.hintShown.stubborn && Math.random() < 0.5 };
  const lines = { seduta: 'Potty, seduta!', zampa: 'Dammi la zampa!', terra: 'Potty, a terra!', bacino: 'Un bacino alla mamma?' };
  martaSay(red ? 'Rosso. Potty, seduta: aspettiamo il verde.' : lines[TRICKS[i][0]]); marta.st.pose = TRICKS[i][0] === 'bacino' ? 'crouch' : 'stand'; trickBox.hidden = false; potty.st.tiltTarget = 0.35;
}
function answerTrick(i){
  if (!G.trick || G.mode !== 'play') return;
  const T = G.trick; trickBox.hidden = true; potty.st.tiltTarget = 0;
  if (T.stubborn){ G.hintShown.stubborn = 1; G.trick = null; martaSay('Potty… ti ho vista. Fai finta di non sentire?'); toast('Testarda come ogni bulldog francese. Marta riproverà tra poco.'); G.nextTrick = 6; PM.sfx.grumble(); return; }
  P.action = { type: 'trick', t: 0, trick: TRICKS[i][0] };
  if (i === T.want && T.red){ addScore(8); progress('redlight'); martaSay('Bravissima, che cagnolina educata!'); G.trick = null; G.nextTrick = 40; return; }
  if (i === T.want){ addScore(6); progress('tricks'); PM.sfx.crunch(); martaSay(pick(['Bravissima! Ecco il biscotto.', 'Brava la mia Potty!', 'Che talento!'])); }
  else { martaSay('Quasi! Ma ti do il biscotto lo stesso.'); addScore(2); }
  G.trick = null; G.nextTrick = 40 + Math.random() * 25;
}

/* ---------- Bark ---------- */
function bark(){
  if (P.barkCd > 0 || (P.action && P.action.type !== 'tug')) return;
  P.barkCd = 0.7; PM.dogBark(potty); PM.sfx.bark();
  label('Bau!', 'say bark', () => potty.bones.head.getWorldPosition(new V3()).add(new V3(0, 0.3, 0)), 0.9, 0.2);
  pigeons.forEach(pg => { if (pg.state !== 'fly' && pg.pos.distanceTo(potty.st.pos) < 5) scarePigeon(pg); });
  if (ball.holder === dogs.luna && dist2(dogs.luna.st.pos, potty.st.pos) < 4){ dropBall(dogs.luna); NPC.dogs.luna.state = 'wander'; NPC.dogs.luna.t = 3; say(NPC.dogs.luna, 'Ok ok, è tua!', true); }
  if (P.inArea && MS.hasBall && dist2(potty.st.pos, marta.st.pos) < 4 && !P.carrying){ throwBall(); martaSay('Va bene, va bene!'); }
  for (const k in NPC.dogs){ const n = NPC.dogs[k]; if (dist2(n.dog.st.pos, potty.st.pos) < 3 && Math.random() < 0.6){ setTimeout(() => { PM.dogBark(n.dog); PM.sfx.otherBark(n.pitch); }, 300 + Math.random() * 300); } }
}
function scarePigeon(pg){
  pg.state = 'fly'; pg.st = 0;
  const away = pg.pos.clone().sub(potty.st.pos).setY(0).normalize();
  pg.vel.set(away.x * 4 + (Math.random() - 0.5) * 2, 3.5 + Math.random() * 1.5, away.z * 4 + (Math.random() - 0.5) * 2);
  pg.rot = Math.atan2(pg.vel.x, pg.vel.z); PM.sfx.flap();
  if (G.mode === 'play'){ G.score += 1; G.stats.pigeons = (G.stats.pigeons || 0) + 1; progress('pigeons'); label('+1', 'pop blue', () => pg.g.position.clone(), 1.0); }
}
function updatePigeons(dt){
  const tt = performance.now() / 1000;
  for (const pg of pigeons){
    pg.st += dt;
    if (pg.state === 'walk'){
      if (!pg.target || pg.pos.distanceTo(pg.target) < 0.1){ pg.target = randomLawn(pg.pos, 1.5); pg.peck = 1 + Math.random() * 2; }
      if (pg.peck > 0){ pg.peck -= dt; const p = Math.max(0, Math.sin(tt * 14 + pg.rot)); pg.head.position.y = 0.2 - p * 0.07; pg.head.position.z = 0.085 + p * 0.04; }
      else { const d = pg.target.clone().sub(pg.pos), dd = d.length(); pg.rot = angDamp(pg.rot, Math.atan2(d.x, d.z), 8, dt); pg.pos.addScaledVector(d.normalize(), Math.min(dd, 0.45 * dt)); pg.head.position.z = 0.085 + Math.sin(tt * 12) * 0.025; pg.head.position.y = 0.2; }
      pg.wings.forEach(w => w.rotation.z = 0);
      if (dist2(pg.pos, potty.st.pos) < 1.6 && potty.st.speed > 2.0) scarePigeon(pg);
    } else if (pg.state === 'fly'){
      pg.vel.y -= 0.5 * dt; pg.pos.addScaledVector(pg.vel, dt);
      pg.wings.forEach((w, i) => w.rotation.z = Math.sin(tt * 30) * 0.9 * (i ? -1 : 1));
      if (pg.st > 4.5){ pg.state = 'land'; pg.st = 0; pg.target = randomLawn(); pg.pos.set(pg.target.x - 6, 9, pg.target.z - 6); }
    } else {
      const d = pg.target.clone().sub(pg.pos), dd = d.length(); pg.rot = Math.atan2(d.x, d.z);
      pg.pos.addScaledVector(d.normalize(), Math.min(dd, 5 * dt)); pg.wings.forEach((w, i) => w.rotation.z = Math.sin(tt * 26) * 0.8 * (i ? -1 : 1));
      if (dd < 0.05){ pg.state = 'walk'; pg.st = 0; pg.target = null; }
    }
    pg.g.position.copy(pg.pos); pg.g.rotation.y = pg.rot;
  }
}

/* ---------- Hearts & droplets ---------- */
const heartTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.translate(64, 70); g.scale(4.6, 4.6); g.beginPath(); g.moveTo(0, 9); g.bezierCurveTo(-14, 0, -10, -12, 0, -5); g.bezierCurveTo(10, -12, 14, 0, 0, 9); g.closePath(); g.fillStyle = '#ff5c7a'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#fff'; g.stroke(); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })();
const hearts = [], drops = [];
function spawnHearts(pos, n){ for (let i = 0; i < n; i++){ let h = hearts.find(x => !x.alive); if (!h){ h = { sp: new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, depthWrite: false })) }; scene.add(h.sp); hearts.push(h); } h.alive = true; h.t = 0; h.life = 1.4; h.sp.visible = true; h.sp.position.set(pos.x + (Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.2, pos.z + (Math.random() - 0.5) * 0.4); h.v = new V3((Math.random() - 0.5) * 0.3, 0.7 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3); h.s = 0.12 + Math.random() * 0.1; } }
const dropGeo = new THREE.SphereGeometry(0.018, 6, 5), dropMat = new THREE.MeshBasicMaterial({ color: '#cdeefa', transparent: true, opacity: 0.85 });
function spawnDrop(pos, vel, life){ let d = drops.find(x => !x.alive); if (!d){ d = { m: new THREE.Mesh(dropGeo, dropMat) }; scene.add(d.m); drops.push(d); } d.alive = true; d.t = 0; d.life = life || 0.8; d.m.visible = true; d.m.position.copy(pos); d.v = vel.clone(); }
function splash(pos, n){ for (let i = 0; i < n; i++){ const a = Math.random() * TAU, s = 0.5 + Math.random() * 1.2; spawnDrop(pos, new V3(Math.cos(a) * s, 1.4 + Math.random() * 1.8, Math.sin(a) * s)); } }
function updateParticles(dt){
  for (const h of hearts){ if (!h.alive) continue; h.t += dt; h.sp.position.addScaledVector(h.v, dt); const k = h.t / h.life; h.sp.material.opacity = 1 - k * k; const sz = h.s * Math.min(1, h.t * 6); h.sp.scale.set(sz, sz, 1); if (h.t > h.life){ h.alive = false; h.sp.visible = false; } }
  for (const d of drops){ if (!d.alive) continue; d.t += dt; d.v.y -= 9.8 * dt; d.m.position.addScaledVector(d.v, dt); if (d.m.position.y < 0.01 || d.t > d.life){ d.alive = false; d.m.visible = false; } }
}

/* ---------- Potty ---------- */
const UP = new V3(0, 1, 0);
function updatePotty(dt){
  readInput();
  const s = potty.st; P.barkCd = Math.max(0, P.barkCd - dt); P.cuddleCd = Math.max(0, P.cuddleCd - dt); P.zoomT = Math.max(0, P.zoomT - dt); P.lastFast = Math.max(0, P.lastFast - dt);
  if (G.mode === 'play' && !G.ending){
    const ca = contextAction();
    actBtn.disabled = !ca; actBtn.textContent = ca ? ca.label : '…';
    if (ca && ca.hold){
      if (input.act){ actionHoldT += dt; showRing(actionHoldT / 1.3, potty.st.pos);
        if (ca.id === 'sniff'){ s.pose = 'sniff'; if (Math.random() < dt * 5) PM.sfx.sniff(); }
        if (actionHoldT >= 1.3){ actionHoldT = 0; hideRing(); if (ca.id === 'sniff') finishSniff(ca.spot); }
      } else if (actionHoldT > 0){ actionHoldT = 0; hideRing(); if (s.pose === 'sniff') s.pose = 'stand'; }
    } else if (ca && input.actPressed && !P.action) startAction(ca);
    if (!ca && actionHoldT > 0){ actionHoldT = 0; hideRing(); }
  }
  updateAction(dt);
  input.actPressed = false;
  if (P.action || (G.ending && G.ending.phase !== 'home')){ PM.animateDog(potty, dt, W.getH); return; }
  // movement
  const fwd = tv1.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)), right = tv2.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
  const want = tv3.set(0, 0, 0).addScaledVector(right, input.x).addScaledVector(fwd, input.z);
  let mag = Math.min(1, want.length());
  if (actionHoldT > 0) mag = 0;
  const hot = G.fresco < 25;
  let maxSp = (input.sprint ? 3.9 : 2.1) * (hot ? 0.6 : 1) * (P.zoomT > 0 ? 1.35 : 1) * (P.inWater ? 0.5 : 1);
  if (G.ending && G.ending.phase === 'home' && input.act){ mag = 0; }
  const tsp = mag > 0.05 ? maxSp * mag : 0;
  s.speed = damp(s.speed, tsp, tsp > s.speed ? 5 : 9, dt);
  if (mag > 0.05){ s.heading = angDamp(s.heading, Math.atan2(want.x, want.z), 10, dt); if (s.pose !== 'stand') s.pose = 'stand'; }
  const prev = tv1.copy(s.pos);
  s.pos.x += Math.sin(s.heading) * s.speed * dt; s.pos.z += Math.cos(s.heading) * s.speed * dt;
  if (s.speed > 2.6) P.lastFast = 1.2;
  PM.collide(W, s.pos, 0.2, { park: false });
  keepWalk(prev, s.pos);
  // red light: wait at the kerb (and sit for Marta)
  const cr = W.atCrossing(s.pos.x, s.pos.z);
  if (cr && W.lights[cr].state === 'red' && !W.inRoad(s.pos.x, s.pos.z)){
    if (mag > 0.3 && MS.sayCd < 0){ MS.sayCd = 6; martaSay('Rosso! Aspettiamo il verde.'); }
    if (!G.trick && !P.action && s.speed < 0.3 && !G.missions.find(m => m.id === 'redlight').done && (G.redAsk || 0) <= 0){ G.redAsk = 12; askTrick(0, true); }
  }
  G.redAsk = Math.max(0, (G.redAsk || 0) - dt);
  for (const k in NPC.dogs){ const o = NPC.dogs[k].dog.st.pos, d = dist2(s.pos, o), m = 0.36; if (d < m && d > 1e-4){ s.pos.x = o.x + (s.pos.x - o.x) / d * m; s.pos.z = o.z + (s.pos.z - o.z) / d * m; } }
  { const o = marta.st.pos, d = dist2(s.pos, o); if (d < 0.38 && d > 1e-4){ s.pos.x = o.x + (s.pos.x - o.x) / d * 0.38; s.pos.z = o.z + (s.pos.z - o.z) / d * 0.38; } }
  // dog-area fence: only through the gate
  const inA = PM.inDogArea(s.pos.x, s.pos.z);
  // leash constraint
  if (P.leashed){
    const hp = marta.st.pos, dx = s.pos.x - hp.x, dz = s.pos.z - hp.z, d = Math.hypot(dx, dz), Lmax = 2.6;
    if (d > Lmax){ s.pos.x = hp.x + dx / d * Lmax; s.pos.z = hp.z + dz / d * Lmax; s.speed = Math.min(s.speed, 1.7); P.pulling = 1; } else P.pulling = Math.max(0, (P.pulling || 0) - dt * 3);
  }
  // water: fountain & paddling pool
  let inWater = false;
  for (const w of [W.fountain, W.pool]){
    const d = Math.hypot(s.pos.x - w.x, s.pos.z - w.z);
    if (d < w.rIn - 0.12) inWater = w;
  }
  if (inWater && !P.inWater){ PM.sfx.splash(); splash(new V3(s.pos.x, inWater.waterY, s.pos.z), 26); G.stats.baths = (G.stats.baths || 0) + 1; hint('bath', 'Che sollievo! Ora esci e scrollati.'); }
  if (!inWater && P.inWater){ PM.dogShake(potty); P.zoomT = 6; label('ZOOMIES!', 'pop orange', () => potty.st.pos.clone().setY(0.8), 1.6, 0.6); progress('bath'); setTimeout(() => PM.sfx.aroo(), 600); for (let i = 0; i < 30; i++) setTimeout(() => spawnDrop(potty.bones.spine.getWorldPosition(new V3()), new V3((Math.random() - 0.5) * 3, 1 + Math.random(), (Math.random() - 0.5) * 3), 0.6), i * 20); }
  P.inWater = inWater;
  const fd = W.fountain, dF = Math.hypot(s.pos.x - fd.x, s.pos.z - fd.z);
  s.groundOffset = inWater ? (inWater === W.pool ? 0.0 : 0.05) : (dF < fd.rOut + 0.1 ? 0.34 : 0);
  if (inWater) G.fresco = Math.min(100, G.fresco + 40 * dt);
  // heat (brachycephalic!)
  if (G.mode === 'play' && !G.ending){
    const shade = W.TREES.some(t => Math.hypot(t.x - s.pos.x, t.z - s.pos.z) < 4.5);
    const sn = s.speed / 3.9;
    let drain = (shade ? 0.05 : 0.16) + sn * sn * 1.5 + (input.sprint && s.speed > 3 ? 1.6 : 0);
    if (P.zoomT > 0) drain = 0;
    if (s.speed < 0.2) drain = shade ? -1.4 : -0.25;
    if (!inWater) G.fresco = clamp(G.fresco - drain * dt, 0, 100);
    if (G.fresco < 30) hint('hot', 'Potty ha caldo e sbuffa: cerca l\'ombra, la fontanella o la ciotola.');
    if (G.fresco <= 0 && !P.action){ P.action = { type: 'sploot', t: 0 }; toast('Splooting! Potty si spalma sul fresco e non si muove.'); PM.sfx.snort(); if (P.carrying === 'ball'){ dropBall(potty); P.carrying = null; } }
    if (G.fresco < 30 && Math.random() < dt * 0.5) PM.sfx.snort();
  }
  s.pant = clamp(1 - G.fresco / 70, 0.15, 1) * (P.carrying ? 0 : 1);
  s.zoom = P.zoomT > 0 ? 1 : 0; s.earsBack = s.speed > 3 ? 1 : 0; s.happy = 0.6 + (P.zoomT > 0 ? 0.4 : 0);
  // the walk to the park
  if (G.mode === 'play' && G.wp < L.ROUTE_WP.length){
    const w = L.ROUTE_WP[G.wp];
    if (Math.hypot(s.pos.x - w.x, s.pos.z - w.z) < 2.6 || (G.wp >= 3 && s.pos.z < w.z && Math.abs(s.pos.x - w.x) < 6)){
      G.wp++;
      const msgs = ['', 'Via Santa Sofia: al semaforo di Corso Italia si aspetta il verde.', 'Corso Italia attraversato! Ora il Parco delle Basiliche, con il campanile di Sant\'Eustorgio.', 'Parco delle Basiliche: tanti alberi da annusare.', 'Ultimo semaforo: via Molino delle Armi.', 'Ecco il Parco Vetra, con la cupola di San Lorenzo!', ''];
      if (msgs[G.wp - 1]) toast(msgs[G.wp - 1], 4);
      if (G.wp === L.ROUTE_WP.length){ progress('route'); addScore(10); }
    }
  }
  if (G.mode === 'play' && !P.poopDone && !P.poopReady && G.t > 55){ P.poopReady = true; P.poopDone = true; toast('Potty gira in tondo annusando: è il momento della cacca! Trova un\'aiuola o un prato.', 4); }
  P.peeT = Math.max(0, (P.peeT || 0) - dt);
  // gate transitions for the dog area
  if (inA && !P.inArea){ P.inArea = true; if (P.leashed){ MS.mode = 'unclip'; } }
  if (!inA && P.inArea){ P.inArea = false; if (!P.leashed){ MS.mode = 'clip'; martaSay('Aspettami Potty, il guinzaglio!'); } }
  // grass push
  W.U.uPush.value[0].set(s.pos.x, s.pos.z, 0.35, 0);
  PM.animateDog(potty, dt, W.getH);
  if (s.groundOffset) potty.root.position.y += s.groundOffset;
}
function finishSniff(spot){
  spot.done = true; potty.st.pose = 'stand';
  const txt = pick(SNIFFS[spot.kind] || SNIFFS.tree);
  label(txt, 'sniff', () => potty.st.pos.clone().setY(0.85), 2.8, 0.1);
  addScore(3); progress('sniff'); PM.sfx.snort(); G.stats.sniffs = (G.stats.sniffs || 0) + 1;
  if ((G.peeCount || 0) < 4){ P.peeT = 6; hint('pee', 'Dopo una bella annusata puoi lasciare un messaggio: premi Pipì.'); }
}
function keepWalk(prev, pos){ if (W.inRoad(prev.x, prev.z) && W.inRoad(pos.x, pos.z)) return; PM.keepWalkable(W, prev, pos); }
const puddles = [];
function makePuddle(){
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshStandardMaterial({ color: '#2a2418', transparent: true, opacity: 0.45, roughness: 0.15, depthWrite: false }));
  const h = potty.bones.hips.getWorldPosition(new V3()); m.rotation.x = -Math.PI / 2; m.position.set(h.x, 0.015, h.z); m.scale.set(1, 0.7, 1); scene.add(m); puddles.push({ m, t: 0 });
}
let poopMesh = null, bagMesh = null;
function makePoop(){
  if (!poopMesh){ poopMesh = new THREE.Group(); const pm = new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.55 }); [[0, 0.02, 0, 0.032], [0.02, 0.035, 0.01, 0.024], [-0.015, 0.05, 0.0, 0.018]].forEach(([x, y, z, r]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), pm); b.position.set(x, y, z); b.scale.set(1, 0.75, 1.3); b.castShadow = true; poopMesh.add(b); }); scene.add(poopMesh); }
  const h = potty.bones.hips.getWorldPosition(new V3()), hd = potty.st.heading; poopMesh.position.set(h.x - Math.sin(hd) * 0.12, 0, h.z - Math.cos(hd) * 0.12); poopMesh.visible = true;
}

/* ---------- Marta ---------- */
function updateMarta(dt){
  const s = marta.st, pp = potty.st.pos; MS.busy = Math.max(0, MS.busy - dt); MS.sayCd -= dt;
  s.look = potty.bones.head.getWorldPosition(new V3());
  if (G.ending){ updateEnding(dt); PM.animateHuman(marta, dt, W.getH); return; }
  const d = dist2(s.pos, pp);
  for (const pd of puddles){ pd.t += dt; pd.m.material.opacity = Math.max(0, 0.45 - pd.t * 0.012); }
  if (MS.poop){
    MS.poopT = (MS.poopT || 0) + dt;
    if (MS.poopT > 50){ MS.poop = false; MS.poopStage = null; MS.poopT = 0; if (bagMesh) bagMesh.visible = false; s.armR = null; s.pose = 'stand'; if (poopMesh) poopMesh.visible = false; progress('poop'); addScore(8); }
    if (MS.poopStage === 'go'){ if (walkTo(poopMesh.position, 1.6, dt, 0.45) < 0.5){ MS.poopStage = 'pick'; MS.pt = 0; } PM.animateHuman(marta, dt, W.getH); return; }
    if (MS.poopStage === 'pick'){
      MS.pt += dt; s.speed = damp(s.speed, 0, 8, dt); s.pose = 'crouch'; s.armR = poopMesh.position.clone().setY(0.06); s.look = poopMesh.position.clone();
      if (MS.pt > 1.3){ poopMesh.visible = false; s.armR = null; s.pose = 'stand';
        if (!bagMesh){ bagMesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshStandardMaterial({ color: '#3f9b4f', roughness: 0.5 })); bagMesh.scale.set(1, 1.3, 1); marta.handR.add(bagMesh); bagMesh.position.set(0, -0.05, 0); }
        bagMesh.visible = true; MS.poopStage = 'bin'; let best = null, bd = 1e9; for (const b of W.bins){ const dd = Math.hypot(b.x - s.pos.x, b.z - s.pos.z); if (dd < bd){ bd = dd; best = b; } } MS.bin = best; }
      PM.animateHuman(marta, dt, W.getH); return;
    }
    if (MS.poopStage === 'bin'){
      // walk along with Potty; drop the bag when passing near a bin
      for (const b of W.bins) if (Math.hypot(b.x - s.pos.x, b.z - s.pos.z) < 1.4){ bagMesh.visible = false; MS.poop = false; MS.poopStage = null; martaSay('Nel cestino. Sempre!'); progress('poop'); addScore(8); toast('Marta raccoglie sempre: Milano ringrazia.'); break; }
      if (MS.poop && MS.sayCd < 0 && Math.random() < dt * 0.1){ MS.sayCd = 10; martaSay('Cerco un cestino…'); }
    }
  }
  if (MS.mode === 'unclip'){
    // walk in behind Potty, then unclip
    const tgt = new V3(L.DOG.gate.x + 1.2, 0, L.DOG.gate.z);
    walkTo(tgt, 1.6, dt);
    if (dist2(s.pos, tgt) < 0.4 || (PM.inDogArea(s.pos.x, s.pos.z) && d < 1.6)){ P.leashed = false; MS.mode = 'area'; MS.hasBall = true; martaSay('Libera! Vai a giocare!'); hint('area', 'Sei senza guinzaglio! Abbaia vicino a Marta per farle lanciare la Chuckit.'); s.pose = 'crouch'; MS.busy = 1; }
  } else if (MS.mode === 'clip'){
    walkTo(pp, 2.6, dt);
    if (d < 1.0){ P.leashed = true; MS.mode = 'follow'; martaSay('Ecco, a passeggio.'); s.pose = 'crouch'; MS.busy = 0.8; if (ball.state === 'held' && ball.holder === potty){ ball.state = 'hand'; potty.st.holding = false; P.carrying = null; } if (ball.state !== 'hand'){ ball.state = 'hand'; } MS.hasBall = true; }
  } else if (MS.mode === 'area'){
    const home = new V3(W.marta.x, 0, W.marta.z);
    if (MS.busy > 0){ s.speed = damp(s.speed, 0, 8, dt); }
    else { s.pose = 'stand'; walkTo(home, 1.3, dt); }
  } else {
    // follow on the leash
    if (MS.busy > 0) s.speed = damp(s.speed, 0, 8, dt);
    else {
      s.pose = 'stand';
      const ph = potty.st.heading, side = new V3(pp.x - Math.cos(ph) * 0.95 - Math.sin(ph) * 0.35, 0, pp.z + Math.sin(ph) * 0.95 - Math.cos(ph) * 0.35);
      const ds = dist2(s.pos, side);
      if (d > 2.3) walkTo(pp, 2.3, dt, 1.4);
      else if (ds > 0.5 && potty.st.speed > 0.3) walkTo(side, Math.min(2.3, 0.6 + potty.st.speed * 1.05), dt, 0.1);
      else if (d > 1.7) walkTo(pp, 1.3, dt, 1.4);
      else s.speed = damp(s.speed, 0, 5, dt);
      if (s.speed < 0.2 && d < 2.4) s.heading = angDamp(s.heading, Math.atan2(pp.x - s.pos.x, pp.z - s.pos.z), 2, dt);
    }
    if (P.pulling > 0.5 && s.speed < 0.3){ MS.stuckT = (MS.stuckT || 0) + dt; if (MS.stuckT > 2.5){ MS.stuckT = 0; s.pos.set(pp.x - Math.sin(potty.st.heading) * 1.1 + Math.cos(potty.st.heading) * 0.7, 0, pp.z - Math.cos(potty.st.heading) * 1.1 - Math.sin(potty.st.heading) * 0.7); keepWalk(pp, s.pos); } } else MS.stuckT = 0;
    if (P.pulling > 0.5 && MS.sayCd < 0){ MS.sayCd = 7; martaSay(pick(['Piano Potty!', 'Ehi, chi porta a spasso chi?', 'Non tirare!'])); }
  }
  // left hand reaches toward Potty when the leash is taut
  if (P.leashed && P.pulling > 0.2){ s.armL = marta.bones.uaL.getWorldPosition(new V3()).lerp(pp, 0.22).setY(0.95); } else if (!P.action || P.action.type !== 'belly') s.armL = null;
  if (MS.busy <= 0 && s.pose === 'crouch' && !(P.action && P.action.type === 'trick')) s.pose = 'stand';
  // tricks
  if (G.mode === 'play' && !P.action && !G.trick && d < 3 && potty.st.speed < 0.5){ G.nextTrick -= dt; if (G.nextTrick < 0) askTrick(); }
  if (G.trick){ G.trick.t -= dt; if (G.trick.t < 0){ G.trick = null; trickBox.hidden = true; potty.st.tiltTarget = 0; martaSay('Va bene, niente biscotto allora.'); G.nextTrick = 30; } }
  PM.animateHuman(marta, dt, W.getH);
}
function walkTo(t0, sp, dt, stopAt){
  const s = marta.st; let t = t0;
  const inM = PM.inDogArea(s.pos.x, s.pos.z), inT = PM.inDogArea(t0.x, t0.z), Gt = L.DOG.gate;
  if (inM !== inT){ const side = inM ? 0.9 : -0.9; const wp = new V3(Gt.x + side, 0, Gt.z); const wp2 = new V3(Gt.x - side * 1.4, 0, Gt.z); const atGate = Math.abs(s.pos.z - Gt.z) < 0.45 && Math.abs(s.pos.x - Gt.x) < 1.15; t = atGate ? wp2 : wp; stopAt = 0.02; }
  const dx = t.x - s.pos.x, dz = t.z - s.pos.z, d = Math.hypot(dx, dz), stop = stopAt || 0.15;
  const v = d > stop ? Math.min(sp, (d - stop) * 2 + 0.3) : 0;
  s.speed = damp(s.speed, v, 5, dt);
  if (d > 0.05 && v > 0.05) s.heading = angDamp(s.heading, Math.atan2(dx, dz), 6, dt);
  const prev = tv2.copy(s.pos);
  s.pos.x += Math.sin(s.heading) * s.speed * dt; s.pos.z += Math.cos(s.heading) * s.speed * dt;
  PM.collide(W, s.pos, 0.28, { park: false });
  keepWalk(prev, s.pos);
  return d;
}

/* ---------- Ending: going home (sciopero + carried home) ---------- */
function startEnding(){
  G.ending = { phase: 'home', t: 0, strike: 0 };
  trickBox.hidden = true; G.trick = null;
  if (!P.leashed){ MS.mode = 'clip'; }
  martaSay('Dai Potty, si torna a casa!');
  toast('Marta vuole tornare a casa. Fai lo sciopero del guinzaglio: tieni premuto Azione!');
  PM.sfx.bell();
}
function updateEnding(dt){
  const E = G.ending, s = marta.st; E.t += dt;
  const exit = new V3(L.ENTR.x, 0, L.ENTR.z - 1.5);
  if (E.phase === 'home'){
    if (!P.leashed){ walkTo(potty.st.pos, 2.6, dt); if (dist2(s.pos, potty.st.pos) < 1.0){ P.leashed = true; MS.mode = 'follow'; } return; }
    if (E.t > 45 && !E.forced){ E.forced = true; martaSay('Ok, basta: ti porto io!'); E.phase = 'pickup'; E.t = 0; return; }
    const resisting = input.act;
    actBtn.disabled = false; actBtn.textContent = 'Pianta le zampe';
    if (resisting){
      E.strike += dt; potty.st.pose = 'sploot'; potty.st.speed = 0; s.speed = damp(s.speed, 0, 6, dt);
      showRing(E.strike / 3, potty.st.pos);
      if (E.strike > 0.3 && E.strike < 0.35) martaSay('Potty… sul serio?');
      if (E.strike >= 3){ hideRing(); progress('strike'); addScore(10); martaSay('Va bene, ti porto in braccio. Come sempre.'); E.phase = 'pickup'; E.t = 0; PM.sfx.grumble(); }
    } else {
      E.strike = Math.max(0, E.strike - dt); hideRing(); potty.st.pose = 'stand';
      walkTo(exit, 1.2, dt, 0.4);
      const dd = dist2(potty.st.pos, s.pos);
      if (dd > 1.5){ const dx = s.pos.x - potty.st.pos.x, dz = s.pos.z - potty.st.pos.z; potty.st.heading = angDamp(potty.st.heading, Math.atan2(dx, dz), 6, dt); potty.st.speed = Math.min(1.4, dd - 1.2); potty.st.pos.x += Math.sin(potty.st.heading) * potty.st.speed * dt; potty.st.pos.z += Math.cos(potty.st.heading) * potty.st.speed * dt; PM.collide(W, potty.st.pos, 0.2); }
      if (dist2(s.pos, exit) < 1.0){ E.phase = 'pickup'; E.t = 0; martaSay('Su, in braccio che sei stanca.'); }
    }
  } else if (E.phase === 'pickup'){
    s.speed = damp(s.speed, 0, 8, dt);
    const pp = potty.st.pos; s.heading = angDamp(s.heading, Math.atan2(pp.x - s.pos.x, pp.z - s.pos.z), 6, dt);
    if (dist2(s.pos, pp) > 0.6) walkTo(pp, 1.2, dt, 0.5);
    else { s.pose = 'crouch'; s.armL = potty.bones.spine.getWorldPosition(new V3()).add(new V3(0.08, 0, 0)); s.armR = potty.bones.hips.getWorldPosition(new V3()); }
    if (E.t > 2.2){ E.phase = 'carry'; E.t = 0; potty.st.carried = true; potty.st.pose = 'carried'; s.pose = 'stand'; label('♥', 'pop', () => marta.bones.head.getWorldPosition(new V3()).add(new V3(0, 0.3, 0)), 2, 0.3); }
  } else if (E.phase === 'carry'){
    actBtn.disabled = true; actBtn.textContent = '♥';
    walkTo(new V3(L.ENTR.x, 0, L.ENTR.z + 8), 1.0, dt, 0.2);
    // Potty in Marta's arms, belly against her chest
    marta.root.updateMatrixWorld(true);
    const p = new V3(0.0, 1.02, 0.24); marta.root.localToWorld(p);
    potty.root.position.set(p.x, p.y - 0.28, p.z); potty.root.rotation.set(0, s.heading + Math.PI / 2, 0);
    potty.st.pos.set(p.x, 0, p.z);
    s.armL = potty.bones.spine.getWorldPosition(new V3()).add(new V3(0, -0.06, 0)); s.armR = potty.bones.hips.getWorldPosition(new V3()).add(new V3(0, -0.04, 0));
    potty.st.eyesClosed = E.t > 2 ? 1 : 0; potty.st.happy = 1;
    if (Math.random() < dt * 2) spawnHearts(potty.st.pos, 1);
    if (E.t > 1.5 && !E.snored){ E.snored = true; PM.sfx.snore(); }
    if (E.t > 5.5 && G.mode !== 'end') showEnd();
  }
}

/* ---------- Leash ---------- */
function updateLeash(){
  const show = P.leashed && !(G.ending && G.ending.phase === 'carry');
  leashMesh.visible = show; if (!show) return;
  marta.handL.getWorldPosition(_ea); potty.leashAnchor.getWorldPosition(_eb);
  setLeash(leashMesh, _ea, _eb, 2.75);
}

/* ---------- Camera ---------- */
const camPos = new V3(), camLook = new V3(); let camInit = false;
function updateCamera(dt){
  const pp = potty.st.pos;
  if (G.mode === 'attract' || G.mode === 'loading'){
    const tt = performance.now() / 1000, a = 0.5 + Math.sin(tt * 0.12) * 0.6;
    camPos.set(pp.x + Math.sin(a) * 2.6, 0.9 + Math.sin(tt * 0.2) * 0.15, pp.z - Math.cos(a) * 2.6);
    camLook.set(pp.x * 0.6 + marta.st.pos.x * 0.4, 0.55, pp.z * 0.6 + marta.st.pos.z * 0.4);
    camera.position.lerp(camPos, camInit ? 1 - Math.exp(-2 * dt) : 1); camInit = true; camera.lookAt(camLook); return;
  }
  if (G.ending && G.ending.phase === 'carry'){
    const m = marta.st; camPos.set(m.pos.x + Math.sin(m.heading + 0.6) * 2.4, 1.5, m.pos.z + Math.cos(m.heading + 0.6) * 2.4); camLook.set(m.pos.x, 1.1, m.pos.z);
    camera.position.lerp(camPos, 1 - Math.exp(-2 * dt)); camera.lookAt(camLook); return;
  }
  if (keys.has('KeyQ')){ camYaw += dt * 2.2; manualCamT = 2; camRecenter = 0; } if (keys.has('KeyR')){ camYaw -= dt * 2.2; manualCamT = 2; camRecenter = 0; }
  manualCamT -= dt;
  const sp = potty.st.speed;
  if (camRecenter > 0){
    camRecenter -= dt; camYaw = angDamp(camYaw, potty.st.heading + Math.PI, 6, dt); camTilt = damp(camTilt, 0.18, 4, dt);
  } else if (manualCamT <= 0 && sp > 0.4 && input.z > 0.25 && Math.abs(input.x) > 0.08){
    camYaw -= input.x * 1.05 * clamp(input.z, 0, 1) * dt; // pushing up-and-sideways steers the view like a car, so one thumb is enough
  }
  const close = P.action && (P.action.type === 'belly' || P.action.type === 'trick' || P.action.type === 'greet');
  const port = camera.aspect < 0.8 ? 1 : 0; // phones held upright: pull back so the dog stays framed
  const wantD = (close ? 2.1 : (P.leashed ? 3.7 : 3.1)) + port * 0.9;
  const baseH = (close ? 0.95 : (P.leashed ? 2.0 : 1.55)) + port * 0.5;
  const ht = baseH + (camTilt - 0.18) * 2.8;
  // keep the camera out of buildings: shorten the arm until it stands over a walkable or road area
  // keep Marta from standing between the camera and Potty: slide the camera to the side
  const mdx = marta.st.pos.x - pp.x, mdz = marta.st.pos.z - pp.z, sideM = mdx * Math.cos(camYaw) - mdz * Math.sin(camYaw), fwdM = -mdx * Math.sin(camYaw) - mdz * Math.cos(camYaw);
  const block = clamp(-fwdM / 1.6, 0, 1) * (1 - clamp(Math.abs(sideM) / 1.1, 0, 1));
  const wantOff = clamp(0.2 - sideM * 0.3, -0.45, 0.55) + block * 0.6 * (sideM >= 0 ? -1 : 1);
  camOff = damp(camOff, P.leashed ? wantOff : 0.2, 2.2, dt);
  let allowed = wantD;
  const ycs = camYaw + camOff;
  while (allowed > 0.9 && !W.camOK(pp.x + Math.sin(ycs) * allowed, pp.z + Math.cos(ycs) * allowed)) allowed -= 0.25;
  camDist = damp(camDist, allowed, allowed < camDist ? 14 : 2.2, dt);
  camPos.set(pp.x + Math.sin(ycs) * camDist, Math.max(0.35, ht * (0.5 + 0.5 * camDist / wantD)), pp.z + Math.cos(ycs) * camDist);
  camera.position.lerp(camPos, 1 - Math.exp(-9 * dt));
  camLook.set(pp.x, 0.42 + Math.max(0, camTilt) * 0.12, pp.z);
  camera.lookAt(camLook);
}

/* ---------- HUD ---------- */
const scoreEl = $('score'), clockEl = $('clock'), frescoEl = $('fresco'), meterEl = $('meter'), toastEl = $('toast'), ringEl = $('ring'), ringFg = $('ringFg'), pointerEl = $('pointer');
let lastScore = -1;
function updateHUD(dt){
  if (G.score !== lastScore){ scoreEl.textContent = G.score; lastScore = G.score; }
  frescoEl.style.width = G.fresco.toFixed(1) + '%'; meterEl.classList.toggle('hot', G.fresco < 25);
  const cr = W.atCrossing(potty.st.pos.x, potty.st.pos.z), lc = $('lightChip');
  if (cr && !G.ending){ const Lt = W.lights[cr], go = Lt.state === 'green'; lc.hidden = false; lc.classList.toggle('go', go); $('lightTxt').textContent = go ? 'Verde: attraversa! ' + Math.ceil(Lt.t) + ' s' : 'Rosso: aspetta ' + Math.ceil(Lt.t) + ' s'; } else lc.hidden = true;
  const hour = H0 + (H1 - H0) * Math.min(1, G.t / DAY), hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60 / 5) * 5;
  clockEl.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  if (hh > G.lastHour){ G.lastHour = hh; PM.sfx.bell(); }
  // toasts
  if (G.toastT > 0){ G.toastT -= dt; if (G.toastT <= 0) toastEl.classList.remove('show'); }
  else if (G.toastQ.length){ const [m, d] = G.toastQ.shift(); toastEl.textContent = m; toastEl.classList.add('show'); G.toastT = d; }
}
function showRing(v, pos){ ringEl.hidden = false; ringFg.setAttribute('stroke-dashoffset', String(138.2 * (1 - clamp(v, 0, 1)))); const p = project(tv3.copy(pos).setY(0.75)); ringEl.style.transform = `translate(${p.x}px,${p.y}px)`; }
function hideRing(){ ringEl.hidden = true; }
function project(v){ const q = v.clone().project(camera); return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight, z: q.z, nx: q.x, ny: q.y }; }
function updateLabels(dt){
  for (let i = labels.length - 1; i >= 0; i--){
    const l = labels[i]; l.t += dt;
    const p = l.getPos().clone(); p.y += l.rise * l.t;
    const s = project(p), k = l.t / l.life;
    l.el.style.opacity = s.z > 1 ? 0 : String(k > 0.75 ? (1 - k) / 0.25 : Math.min(1, l.t * 8));
    l.el.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-100%)`;
    if (l.t > l.life){ l.el.remove(); labels.splice(i, 1); }
  }
}
function updatePointer(){
  let target = null, cls = '';
  if (G.mode !== 'play'){ pointerEl.hidden = true; return; }
  if (P.inArea && (ball.state === 'free' || ball.state === 'flying')) target = ball.pos;
  else if (P.inArea && ball.holder === dogs.luna) target = dogs.luna.st.pos;
  else if (P.carrying === 'ball'){ target = marta.st.pos.clone().setY(1.2); cls = 'marta'; }
  else if (P.carrying === 'rope'){ target = dogs.biscotto.st.pos; cls = 'goal'; }
  else if (G.ending && !P.leashed){ target = marta.st.pos; cls = 'marta'; }
  else if (G.wp < L.ROUTE_WP.length){ const w = L.ROUTE_WP[G.wp]; target = new V3(w.x, 0.3, w.z); cls = 'goal'; }
  if (!target){ pointerEl.hidden = true; return; }
  const q = target.clone().project(camera); let x = q.x, y = q.y; const behind = q.z > 1;
  if (behind){ x = -x; y = -y; if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) y = -1; }
  if (!behind && Math.abs(x) < 0.9 && Math.abs(y) < 0.85){ if (cls === 'goal' && dist2(potty.st.pos, target) > 4){ const sx = (x + 1) / 2 * innerWidth, sy = (1 - y) / 2 * innerHeight; pointerEl.hidden = false; pointerEl.className = cls; pointerEl.style.transform = `translate(${sx}px,${sy - 40}px) rotate(${Math.PI / 2}rad)`; return; } pointerEl.hidden = true; return; }
  const mm = Math.max(Math.abs(x) / 0.86, y > 0 ? y / 0.55 : -y / 0.72); x /= mm; y /= mm;
  pointerEl.hidden = false; pointerEl.className = cls;
  pointerEl.style.transform = `translate(${(x + 1) / 2 * innerWidth}px,${(1 - y) / 2 * innerHeight}px) rotate(${Math.atan2(-y, x)}rad)`;
}
function bestText(){ return G.best > 0 ? 'Record: <b>' + G.best + '</b> cuori' : ''; }

/* ---------- Adaptive quality: lower the render scale (then shadows and grass) when the frame rate drops ---------- */
const QL = { level: isTouch ? 1 : 0, acc: 0, n: 0, t: 0, calm: 0, noRaise: false };
function applyQuality(){
  const base = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2), f = [1, 0.8, 0.64, 0.5][QL.level];
  renderer.setPixelRatio(Math.max(0.6, base * f)); resize();
  if (W){ W.sun.castShadow = QL.level < 3; if (W.grass) W.grass.visible = QL.level < 3; }
}
function adaptQuality(dt){
  if (G.mode !== 'play'){ QL.acc = 0; QL.n = 0; QL.t = 0; return; }
  QL.acc += dt; QL.n++; QL.t += dt;
  if (QL.t < 2.5) return;
  const avg = QL.acc / QL.n; QL.acc = 0; QL.n = 0; QL.t = 0;
  if (avg > 0.034 && QL.level < 3){ if (QL.calm > 0) QL.noRaise = true; QL.level++; QL.calm = 0; applyQuality(); }
  else if (avg < 0.019 && QL.level > 0 && !QL.noRaise){ if (++QL.calm >= 4){ QL.level--; QL.calm = 0; applyQuality(); } }
  else if (avg >= 0.019) QL.calm = 0;
}

/* ---------- Flow ---------- */
function resetGame(){
  G.t = 0; G.score = 0; G.fresco = 100; G.wp = 0; G.peeCount = 0; G.redAsk = 0; G.stats = {}; G.ending = null; G.trick = null; G.nextTrick = 30; G.lastHour = 16; G.hintShown = {}; G.toastQ = []; G.toastT = 0;
  toastEl.classList.remove('show');
  resetMissions();
  dropTouch(); camTilt = 0.18; camDist = 3.4; camRecenter = 0;
  Object.assign(P, { carrying: null, action: null, leashed: true, inArea: false, zoomT: 0, inWater: false, greeted: {}, cuddleCd: 0, pulling: 0, peeT: 0, poopReady: false, poopDone: false });
  puddles.forEach(p => scene.remove(p.m)); puddles.length = 0; if (poopMesh) poopMesh.visible = false; if (bagMesh) bagMesh.visible = false;
  Object.assign(MS, { mode: 'follow', hasBall: true, sayCd: 3, busy: 0, poop: false, poopStage: null });
  const s = potty.st; s.pos.set(94, 0, 157); s.heading = -0.785; s.speed = 0; s.pose = 'stand'; s.carried = false; s.holding = false; s.eyesClosed = 0; s.tug = 0;
  for (const k in s.poseW) s.poseW[k] = 0;
  const m = marta.st; m.pos.set(95.2, 0, 156.2); m.heading = -0.6; m.speed = 0; m.pose = 'stand'; m.armL = m.armR = null;
  ball.state = 'hand'; ball.holder = null; rope.state = 'ground'; rope.holder = null; rope.pos.set(W.ropeSpot.x, 0.03, W.ropeSpot.z);
  W.scent.forEach(x => x.done = false);
  placeNPCs();
  camYaw = potty.st.heading + Math.PI; labels.forEach(l => l.el.remove()); labels.length = 0;
  trickBox.hidden = true; hideRing();
}
function startGame(){
  PM.audio.init(); resetGame(); G.mode = 'play';
  $('startScreen').hidden = true; $('endScreen').hidden = true; $('pauseScreen').hidden = true; $('hud').hidden = false; $('joyHint').hidden = !isTouch; if (isTouch) homeJoy();
  canvas.focus({ preventScroll: true });
  toast('Si esce da piazza Mondadori 2: si va al Parco Vetra! La freccia verde indica la strada.', 4.5);
  const md = $('missions'); md.open = !isTouch; if (!isTouch) setTimeout(() => { if (G.mode === 'play') md.open = false; }, 12000);
  martaSay('Andiamo al parco, Potty!');
}
function pause(on){
  if (on && G.mode === 'play'){ G.mode = 'paused'; $('pauseScreen').hidden = false; keys.clear(); actHeld = false; dropTouch(); }
  else if (!on && G.mode === 'paused'){ G.mode = 'play'; $('pauseScreen').hidden = true; canvas.focus({ preventScroll: true }); }
}
function showEnd(){
  G.mode = 'end'; $('hud').hidden = true;
  const rec = G.score > G.best; if (rec){ G.best = G.score; store.set('best', G.best); }
  $('endScore').textContent = G.score; $('newRec').hidden = !rec || G.score === 0;
  const done = G.missions.filter(m => m.done).length;
  const st = [[done + '/' + G.missions.length, 'missioni compiute'], [G.stats.sniffs || 0, 'posti annusati'], [G.stats.fetch || 0, 'palline riportate'], [G.stats.pigeons || 0, 'piccioni in volo']];
  $('endStats').innerHTML = st.map(([n, t]) => '<div class="stat"><div class="n"></div><div class="t"></div></div>').join('');
  [...$('endStats').children].forEach((el, i) => { el.children[0].textContent = st[i][0]; el.children[1].textContent = st[i][1]; });
  $('bestEnd').innerHTML = bestText(); $('bestStart').innerHTML = bestText();
  $('endScreen').hidden = false;
}
$('btnStart').addEventListener('click', startGame);
$('btnAgain').addEventListener('click', startGame);
$('btnPause').addEventListener('click', () => pause(true));
$('btnResume').addEventListener('click', () => pause(false));
$('btnQuit').addEventListener('click', startGame);
$('btnCam').addEventListener('click', () => { camRecenter = 1.4; manualCamT = 0; });
$('btnMute').addEventListener('click', () => { PM.audio.init(); PM.audio.setMuted(!PM.audio.muted); $('muteIcon').setAttribute('d', PM.audio.muted ? 'M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6' : 'M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12'); $('btnMute').setAttribute('aria-label', PM.audio.muted ? 'Attiva l\'audio' : 'Disattiva l\'audio'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });

/* ---------- Main loop ---------- */
let last = performance.now(), simT = 0;
function tick(dt){
  if (G.mode === 'paused') dt = 0;
  simT += dt;
  if (G.mode === 'play'){
    G.t += dt;
    if (G.t >= DAY - 25 && !G.ending) startEnding();
  }
  if (dt > 0){
    updatePotty(dt);
    updateMarta(dt);
    updateNPCDogs(dt);
    updateBall(dt); updateRope(dt);
    updatePigeons(dt);
    updateParticles(dt);
    updateLeash();
  }
  const dayT = G.mode === 'play' || G.mode === 'end' ? Math.min(1, G.t / DAY) : 0.3;
  updateCamera(dt || 0);
  W.setTime(dayT, new V3(potty.st.pos.x, 0, potty.st.pos.z));
  W.update(simT, dt, camera.position);
  if (G.mode === 'play') updateHUD(dt);
  updateLabels(dt); updatePointer();
}
let tickErrors = 0;
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.mode === 'loading') return;
  try { tick(dt); adaptQuality(dt); }
  catch (e){ if (tickErrors++ < 5) console.error('tick', e); if (tickErrors > 600 && G.mode === 'play'){ G.mode = 'paused'; $('pauseScreen').hidden = false; } }
  renderer.render(scene, camera);
}
requestAnimationFrame(t => { last = t; frame(t); });
load().catch(e => { console.error(e); $('loadTxt').textContent = 'Qualcosa è andato storto nel caricamento: ricarica la pagina.'; });
if (location.search.indexOf('debug') >= 0) window.__pv = { get ball(){ return ball; }, G, P, MS, get potty(){ return potty; }, get marta(){ return marta; }, get dogs(){ return dogs; }, get W(){ return W; }, get camYaw(){ return camYaw; }, get QL(){ return QL; }, get stick(){ return stick; }, get look(){ return look; }, get camTilt(){ return camTilt; }, get camDist(){ return camDist; }, step: n => { for (let i = 0; i < n; i++) tick(1 / 60); }, start: startGame, camera, renderer, scene, NPC, input, keys, setStick: (x, z, sp) => { stickOverride = x == null ? null : { x, z, sprint: !!sp }; }, get tickErrors(){ return tickErrors; } };
})();
