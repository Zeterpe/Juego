// Efectos de sonido sintetizados con WebAudio (no hace falta ningún archivo).
// Los sonidos de los demás jugadores suenan en estéreo según de dónde vienen y,
// si hay una pared en medio, más apagados.
let ctx = null;
let master = null;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const stored = (k, def) => { try { return localStorage.getItem(k) ?? def; } catch { return def; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* modo privado */ } };
let muted = stored('muted', '0') === '1';
let volume = clamp(parseFloat(stored('volume', '0.8')) || 0, 0, 1);

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // compresor: se puede subir el volumen sin que se sature cuando suena todo a la vez
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(comp);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMuted(m) {
  muted = m;
  save('muted', m ? '1' : '0');
  if (master) master.gain.value = m ? 0 : volume;
}
export const isMuted = () => muted;
export function setVolume(v) {
  volume = clamp(v, 0, 1);
  save('volume', String(volume));
  if (master) master.gain.value = muted ? 0 : volume;
}
export const getVolume = () => volume;

// salida con volumen, posición izquierda/derecha y filtro de «detrás de una pared»
function bus({ vol = 1, pan = 0, muffle = 0 } = {}) {
  if (!ctx) return null;
  const g = ctx.createGain();
  g.gain.value = vol;
  let node = g;
  if (ctx.createStereoPanner && pan) {
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    node.connect(p);
    node = p;
  }
  if (muffle > 0) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 9000 * (1 - muffle) + 600 * muffle;
    node.connect(f);
    node = f;
  }
  node.connect(master);
  return g;
}

function tone({ freq = 440, to = null, type = 'sine', dur = 0.2, vol = 0.5, delay = 0, vib = 0, out = null }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  if (vib) {
    // vibrato: le da un toque más «de verdad» a trompetas y sirenas
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 6;
    lg.gain.value = vib;
    lfo.connect(lg);
    lg.connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012);
  g.gain.setValueAtTime(Math.max(0.0002, vol), t + Math.max(0.013, dur * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(out || master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise({ dur = 0.15, vol = 0.3, delay = 0, filter = 1200, q = 1, out = null }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filter;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(out || master);
  src.start(t);
}

// Ruidos de los escondidos: largos y fuertes para que se oigan de lejos.
export const TAUNT_NAMES = ['Pato', 'Bocina', 'Silbido', 'Boing', 'Gallina', 'Trombón', 'Sirena', 'Cucú'];
const TAUNTS = [
  // pato: cua-cua-cuaaa
  (o) => [0, 0.22, 0.44].forEach((d, i) => tone({ freq: 640, to: 380, type: 'sawtooth', dur: i === 2 ? 0.3 : 0.17, vol: 0.55, delay: d, out: o })),
  // bocina de payaso
  (o) => { tone({ freq: 330, type: 'square', dur: 0.32, vol: 0.42, out: o }); tone({ freq: 262, type: 'square', dur: 0.5, vol: 0.42, delay: 0.36, out: o }); },
  // silbido de piropo
  (o) => { tone({ freq: 1100, to: 2400, dur: 0.28, vol: 0.6, out: o }); tone({ freq: 2400, to: 850, dur: 0.45, vol: 0.6, delay: 0.32, out: o }); },
  // boing boing
  (o) => { tone({ freq: 110, to: 620, type: 'triangle', dur: 0.4, vol: 0.85, out: o }); tone({ freq: 140, to: 760, type: 'triangle', dur: 0.4, vol: 0.85, delay: 0.42, out: o }); },
  // gallina: co-co-co-cooo
  (o) => { [0, 0.14, 0.28].forEach((d) => tone({ freq: 820, to: 620, type: 'square', dur: 0.08, vol: 0.38, delay: d, out: o })); tone({ freq: 700, to: 1150, type: 'square', dur: 0.45, vol: 0.38, delay: 0.46, vib: 25, out: o }); },
  // trombón triste: wah wah wah waaaah
  (o) => [[392, 0.28], [370, 0.28], [349, 0.28], [330, 0.8]].reduce((d, [f, len]) => { tone({ freq: f, type: 'sawtooth', dur: len, vol: 0.4, delay: d, vib: len > 0.5 ? 9 : 0, out: o }); return d + len + 0.04; }, 0),
  // sirena
  (o) => { tone({ freq: 620, to: 1250, dur: 0.45, vol: 0.55, out: o }); tone({ freq: 1250, to: 620, dur: 0.45, vol: 0.55, delay: 0.45, out: o }); tone({ freq: 620, to: 1250, dur: 0.45, vol: 0.55, delay: 0.9, out: o }); },
  // cucú, cucú
  (o) => [0, 0.55].forEach((d) => { tone({ freq: 784, dur: 0.22, vol: 0.65, delay: d, out: o }); tone({ freq: 622, dur: 0.3, vol: 0.65, delay: d + 0.24, out: o }); }),
];

export const sfx = {
  shoot() { noise({ dur: 0.12, vol: 0.35, filter: 2500 }); tone({ freq: 900, to: 300, type: 'triangle', dur: 0.1, vol: 0.15 }); },
  shootFar(v = 0.4, pan = 0, muffle = 0) { noise({ dur: 0.1, vol: 0.35, filter: 2000, out: bus({ vol: v, pan, muffle }) }); },
  hit() { tone({ freq: 880, to: 1320, type: 'square', dur: 0.08, vol: 0.2 }); },
  hitmark() { tone({ freq: 1900, type: 'square', dur: 0.04, vol: 0.12 }); },
  kill() { [660, 880, 1320].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.14, vol: 0.32, delay: i * 0.07 })); },
  hurt() { tone({ freq: 300, to: 120, type: 'sawtooth', dur: 0.25, vol: 0.3 }); },
  wrong() { tone({ freq: 200, to: 140, type: 'square', dur: 0.15, vol: 0.15 }); },
  // ruido de un escondido: vol 0..1, pan -1 (izquierda) a 1 (derecha), muffle 0..1 (pared en medio)
  taunt(i, { vol = 1, pan = 0, muffle = 0 } = {}) {
    const out = bus({ vol: clamp(vol, 0.05, 1.2), pan, muffle });
    if (out) TAUNTS[((i % TAUNTS.length) + TAUNTS.length) % TAUNTS.length](out);
  },
  step(vol = 0.3, pan = 0, soft = false) {
    const out = bus({ vol, pan });
    if (!out) return;
    if (soft) noise({ dur: 0.12, vol: 0.5, filter: 300, q: 0.7, out }); // objeto arrastrándose
    else {
      noise({ dur: 0.05, vol: 0.7, filter: 500 + Math.random() * 300, q: 1.2, out });
      tone({ freq: 85 + Math.random() * 20, type: 'sine', dur: 0.07, vol: 0.5, out });
    }
  },
  disguise(vol = 1, pan = 0) { const out = bus({ vol, pan }); tone({ freq: 500, to: 1000, type: 'sine', dur: 0.15, vol: 0.3, out }); noise({ dur: 0.2, vol: 0.1, filter: 4000, out }); },
  caught() { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.15, vol: 0.3, delay: i * 0.08 })); },
  beep(high = false) { tone({ freq: high ? 1320 : 880, type: 'square', dur: 0.1, vol: 0.15 }); },
  start() { [392, 523, 659].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.2, vol: 0.15, delay: i * 0.15 })); },
  roundStart() { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.12, vol: 0.12, delay: i * 0.09 })); },
  lose() { [392, 349, 311].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.25, delay: i * 0.2 })); },
  win() { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.25, vol: 0.3, delay: i * 0.14 })); },
  click() { tone({ freq: 700, type: 'sine', dur: 0.05, vol: 0.15 }); },
  freeze() { tone({ freq: 2000, to: 400, type: 'sine', dur: 0.5, vol: 0.2 }); },
};
