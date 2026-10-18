/* Synthesised sounds. Starts muted; the viewer turns audio on from the HUD. Potty's voice is a small female French bulldog: raspy, grumbly, snorty. */
(function(){
'use strict';
const PM = window.PM = window.PM || {};
const A = PM.audio = { ctx: null, master: null, noise: null, muted: true };
A.init = function(){
  if (A.ctx){ if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try {
    A.ctx = new AC(); A.master = A.ctx.createGain(); A.master.gain.value = A.muted ? 0 : 0.6; A.master.connect(A.ctx.destination);
    const b = A.ctx.createBuffer(1, A.ctx.sampleRate * 2, A.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; A.noise = b;
  } catch(e){ A.ctx = null; }
};
A.setMuted = function(m){ A.muted = m; if (A.master) A.master.gain.value = m ? 0 : 0.6; };
const ok = () => A.ctx && !A.muted;
function env(g, t, peak, a, d){ g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function noise(t, dur, type, f0, q, peak, f1, dest){
  const c = A.ctx, n = c.createBufferSource(); n.buffer = A.noise;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1;
  const g = c.createGain(); env(g, t, peak, 0.008, dur); n.connect(f).connect(g).connect(dest || A.master); n.start(t, Math.random()); n.stop(t + dur + 0.05);
}
function tone(t, type, f0, f1, dur, peak, att){
  const c = A.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain(); env(g, t, peak, att || 0.01, dur); o.connect(g).connect(A.master); o.start(t); o.stop(t + dur + 0.05);
}
/* raspy voiced burst through two formants, with jitter: the core of the frenchie voice */
function voice(t, f0, f1, dur, peak, formants){
  const c = A.ctx, o = c.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.12, t + dur * 0.25); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const lfo = c.createOscillator(); lfo.frequency.value = 38 + Math.random() * 14; const lg = c.createGain(); lg.gain.value = f0 * 0.06; lfo.connect(lg).connect(o.frequency);
  const mix = c.createGain(); mix.gain.value = 1;
  (formants || [[900, 5], [1900, 7]]).forEach(([f, q]) => { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; o.connect(bp).connect(mix); });
  const g = c.createGain(); env(g, t, peak, 0.012, dur); mix.connect(g).connect(A.master);
  o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  noise(t, dur * 0.8, 'bandpass', 2400, 1.5, peak * 0.35); // breathy rasp
}
PM.sfx = {
  bark(){ if (!ok()) return; const t = A.ctx.currentTime; voice(t, 560, 330, 0.13, 0.7); voice(t + 0.19, 520, 300, 0.11, 0.55); noise(t + 0.33, 0.12, 'lowpass', 600, 1, 0.25); },
  grumble(){ if (!ok()) return; const t = A.ctx.currentTime; voice(t, 210, 180, 0.6, 0.35, [[500, 4], [1200, 5]]); },
  aroo(){ if (!ok()) return; const t = A.ctx.currentTime; voice(t, 420, 620, 0.45, 0.4, [[800, 4], [1700, 6]]); voice(t + 0.42, 600, 380, 0.35, 0.35, [[800, 4], [1700, 6]]); },
  snort(){ if (!ok()) return; const t = A.ctx.currentTime; noise(t, 0.09, 'lowpass', 900, 3, 0.5, 300); noise(t + 0.12, 0.07, 'lowpass', 1100, 3, 0.35, 400); },
  sniff(){ if (!ok()) return; const t = A.ctx.currentTime; for (let i = 0; i < 4; i++) noise(t + i * 0.09, 0.05, 'bandpass', 3200, 2, 0.18); },
  snore(){ if (!ok()) return; const t = A.ctx.currentTime; voice(t, 90, 70, 0.9, 0.18, [[300, 3], [700, 4]]); noise(t, 0.9, 'lowpass', 500, 2, 0.08); },
  splash(){ if (!ok()) return; const t = A.ctx.currentTime; noise(t, 0.6, 'lowpass', 3200, 0.7, 0.5, 300); noise(t + 0.08, 0.35, 'bandpass', 1500, 2, 0.2, 600); },
  lap(){ if (!ok()) return; const t = A.ctx.currentTime; noise(t, 0.05, 'bandpass', 1800, 4, 0.15); },
  pickup(){ if (!ok()) return; tone(A.ctx.currentTime, 'sine', 520, 880, 0.12, 0.25); },
  score(){ if (!ok()) return; const t = A.ctx.currentTime; [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(t + i * 0.08, 'triangle', f, null, 0.22, 0.18)); },
  mission(){ if (!ok()) return; const t = A.ctx.currentTime; [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(t + i * 0.09, 'triangle', f, null, 0.3, 0.2)); },
  throwIt(){ if (!ok()) return; noise(A.ctx.currentTime, 0.3, 'bandpass', 600, 3, 0.22, 2400); },
  crunch(){ if (!ok()) return; const t = A.ctx.currentTime; for (let i = 0; i < 3; i++) noise(t + i * 0.06, 0.05, 'highpass', 2500, 1, 0.22); },
  flap(){ if (!ok()) return; const t = A.ctx.currentTime; for (let i = 0; i < 6; i++) noise(t + i * 0.06, 0.045, 'lowpass', 900, 1, 0.16); },
  bell(){ if (!ok()) return; const t = A.ctx.currentTime; [[1, 0.22], [2, 0.1], [2.76, 0.08], [5.4, 0.04]].forEach(([m, p]) => tone(t, 'sine', 330 * m, null, 2.6, p, 0.004)); },
  tram(){ if (!ok()) return; const t = A.ctx.currentTime; tone(t, 'triangle', 1320, null, 0.25, 0.12); tone(t + 0.28, 'triangle', 1320, null, 0.25, 0.1); },
  otherBark(pitch){ if (!ok()) return; const t = A.ctx.currentTime; voice(t, pitch, pitch * 0.6, 0.15, 0.4, [[700, 4], [1500, 5]]); },
  yip(){ if (!ok()) return; const t = A.ctx.currentTime; voice(t, 900, 700, 0.09, 0.35, [[1200, 4], [2400, 6]]); voice(t + 0.14, 950, 700, 0.08, 0.3, [[1200, 4], [2400, 6]]); },
  thud(){ if (!ok()) return; tone(A.ctx.currentTime, 'sine', 160, 60, 0.25, 0.3); }
};
})();
