// Sons e música via WebAudio (opcionais, sem arquivos externos). v0.7: trilha procedural por cena, ambiente de chuva e mais efeitos.
let ctx = null; let on = true; let vSfx = 0.8; let vMus = 0.5; let musicOn = true;
export function setSound(v) { on = v; if (!v) stopRain(); }
export function soundOn() { return on; }
export function setVolumes(sfxV, musV) { vSfx = Math.max(0, Math.min(1, sfxV)); vMus = Math.max(0, Math.min(1, musV)); if (mg && ctx) mg.gain.setTargetAtTime(vMus * 0.9, ctx.currentTime, 0.05); if (rainG && ctx) rainG.gain.setTargetAtTime(0.05 * vSfx, ctx.currentTime, 0.2); }
export function setMusicOn(v) { musicOn = v; if (!v) stopMusic(); else if (scene) { const sc = scene; scene = null; playMusic(sc); } }
export function applyAudioSettings(c) { setSound(c.som !== false); setVolumes(c.volSfx ?? 0.8, c.volMus ?? 0.5); setMusicOn(c.musica !== false); }
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(f, d = 0.1, type = 'square', vol = 0.05, when = 0, slide = 0) {
  if (!on) return; const a = ac(); if (!a) return;
  const t = a.currentTime + when; const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, f + slide), t + d);
  const v = vol * vSfx * 1.25; g.gain.setValueAtTime(Math.max(0.0001, v), t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.02);
}
function noise(d = 0.08, vol = 0.03, when = 0, hp = 2000) {
  if (!on) return; const a = ac(); if (!a) return; const t = a.currentTime + when;
  const len = Math.max(1, Math.floor(a.sampleRate * d)); const b = a.createBuffer(1, len, a.sampleRate); const dat = b.getChannelData(0);
  for (let i = 0; i < len; i++) dat[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; const g = a.createGain(); g.gain.value = vol * vSfx * 1.25;
  s.connect(f); f.connect(g); g.connect(a.destination); s.start(t);
}
export const sfx = {
  click: () => tone(520, 0.05, 'square', 0.035),
  tick: () => tone(880, 0.03, 'triangle', 0.02),
  coin: () => { tone(988, 0.07, 'square', 0.04); tone(1319, 0.12, 'square', 0.04, 0.07); },
  good: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.045, i * 0.09)); },
  bad: () => { tone(200, 0.25, 'sawtooth', 0.05, 0, -90); tone(150, 0.3, 'sawtooth', 0.05, 0.15, -60); },
  event: () => { tone(660, 0.1, 'triangle', 0.05); tone(880, 0.14, 'triangle', 0.05, 0.1); },
  type: () => tone(300 + Math.random() * 200, 0.02, 'square', 0.012),
  level: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1, 'triangle', 0.05, i * 0.07)); },
  launch: () => { [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, 0.16, 'square', 0.045, i * 0.08)); },
  // v0.7
  open: () => { tone(420, 0.05, 'triangle', 0.03); tone(630, 0.06, 'triangle', 0.03, 0.04); },
  close: () => { tone(630, 0.05, 'triangle', 0.025); tone(420, 0.06, 'triangle', 0.025, 0.04); },
  paper: () => noise(0.12, 0.03, 0, 3000),
  keys: () => { for (let i = 0; i < 5; i++) tone(260 + Math.random() * 260, 0.02, 'square', 0.011, i * 0.05 + Math.random() * 0.02); },
  cash: () => { noise(0.05, 0.03, 0, 5000); tone(1568, 0.08, 'square', 0.04, 0.03); tone(2093, 0.18, 'square', 0.035, 0.1); },
  alarm: () => { for (let i = 0; i < 3; i++) { tone(880, 0.1, 'square', 0.05, i * 0.22); tone(660, 0.1, 'square', 0.05, i * 0.22 + 0.11); } },
  award: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 6 ? 0.5 : 0.13, 'triangle', 0.06, i * 0.1)); noise(0.5, 0.02, 0.55, 6000); },
  drum: () => { tone(120, 0.25, 'sine', 0.12, 0, -80); noise(0.08, 0.02, 0, 800); },
  pop: () => tone(700, 0.06, 'sine', 0.05, 0, 500),
  step: () => noise(0.03, 0.012, 0, 400),
  meme: () => { [660, 784, 660, 523].forEach((f, i) => tone(f, 0.09, 'square', 0.04, i * 0.08)); },
  door: () => { tone(180, 0.1, 'triangle', 0.06, 0, -60); noise(0.06, 0.02, 0.02, 600); },
};

// ---------------------------------------------------------------- chuva (ruído filtrado)
let rainN = null, rainG = null;
export function rain(v) {
  if (!v || !on) return stopRain(); const a = ac(); if (!a || rainN) return;
  const len = a.sampleRate * 2; const b = a.createBuffer(1, len, a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  rainN = a.createBufferSource(); rainN.buffer = b; rainN.loop = true; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.4; rainG = a.createGain(); rainG.gain.value = 0.0001;
  rainN.connect(f); f.connect(rainG); rainG.connect(a.destination); rainN.start(); rainG.gain.setTargetAtTime(0.05 * vSfx, a.currentTime, 0.6);
}
function stopRain() { try { rainN?.stop(); } catch { /* já parado */ } rainN = null; rainG = null; }

// ---------------------------------------------------------------- música procedural
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SCENES = {
  title: { bpm: 92, root: 60, scale: [0, 2, 4, 7, 9], prog: [0, 5, 3, 4], lead: 0.55, hat: false, wave: 'triangle', vol: 1 },
  office: { bpm: 100, root: 57, scale: [0, 3, 5, 7, 10], prog: [0, 5, 2, 6], lead: 0.35, hat: true, wave: 'triangle', vol: 0.85 },
  city: { bpm: 112, root: 55, scale: [0, 2, 4, 7, 9], prog: [0, 3, 4, 3], lead: 0.6, hat: true, wave: 'square', vol: 0.75 },
  night: { bpm: 76, root: 50, scale: [0, 3, 5, 7, 10], prog: [0, 6, 5, 4], lead: 0.22, hat: false, wave: 'sine', vol: 1 },
  tense: { bpm: 124, root: 52, scale: [0, 3, 5, 6, 7, 10], prog: [0, 0, 6, 5], lead: 0.3, hat: true, wave: 'sawtooth', vol: 0.55 },
};
let mg = null, scene = null, timer = null, nextT = 0, stepN = 0, rngS = 1;
const rng = () => { rngS = (rngS + 0x6D2B79F5) >>> 0; let t = rngS; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const musicScene = () => scene;
function note(freq, t, d, type, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(mg); o.start(t); o.stop(t + d + 0.03);
}
function hat(t, vol) {
  const len = Math.floor(ctx.sampleRate * 0.04); const b = ctx.createBuffer(1, len, ctx.sampleRate); const dd = b.getChannelData(0); for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(mg); s.start(t);
}
function schedule() {
  if (!ctx || !scene || !on || !musicOn || ctx.state !== 'running') { if (ctx && nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05; return; }
  const sc = SCENES[scene]; const sixteenth = 60 / sc.bpm / 4;
  while (nextT < ctx.currentTime + 0.35) {
    const bar = Math.floor(stepN / 16), st = stepN % 16; rngS = (bar * 2654435761 + scene.length * 977) >>> 0;
    const chord = sc.prog[bar % sc.prog.length]; const deg = (i) => sc.root + sc.scale[((chord + i) % sc.scale.length + sc.scale.length) % sc.scale.length] + 12 * Math.floor((chord + i) / sc.scale.length);
    const v = sc.vol * 0.08;
    if (st % 4 === 0) note(hz(deg(0) - 12), nextT, sixteenth * 3.4, 'triangle', v * 1.2);
    if (st % 2 === 0) note(hz(deg([0, 2, 4, 2][(st / 2) % 4])), nextT, sixteenth * 1.6, sc.wave, v * 0.45);
    // melodia determinística por compasso
    for (let k = 0; k < st; k++) rng();
    if (st % 2 === 1 && rng() < sc.lead * 0.5 || st === 0 && rng() < sc.lead) note(hz(deg(Math.floor(rng() * 6) - 1) + 12), nextT, sixteenth * (1 + Math.floor(rng() * 3)), sc.wave, v * 0.55);
    if (sc.hat && st % 4 === 2) hat(nextT, v * 0.28);
    nextT += sixteenth; stepN++;
  }
}
export function playMusic(name) {
  if (!SCENES[name]) return; if (scene === name) return;
  scene = name; if (!on || !musicOn) return; const a = ac(); if (!a) return;
  if (!mg) { mg = a.createGain(); mg.gain.value = vMus * 0.9; mg.connect(a.destination); }
  nextT = a.currentTime + 0.1; stepN = 0;
  if (!timer) timer = setInterval(schedule, 90);
}
export function stopMusic() { if (timer) { clearInterval(timer); timer = null; } const g = mg; mg = null; if (g && ctx) { g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1); setTimeout(() => { try { g.disconnect(); } catch { /* ok */ } }, 400); } }
