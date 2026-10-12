// Efectos de sonido sintetizados con WebAudio (no hace falta ningún archivo).
let ctx = null;
let master = null;
let muted = localStorage.getItem('muted') === '1';

export function unlockAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMuted(m) {
  muted = m;
  localStorage.setItem('muted', m ? '1' : '0');
  if (master) master.gain.value = m ? 0 : 0.5;
}
export const isMuted = () => muted;

function tone({ freq = 440, to = null, type = 'sine', dur = 0.2, vol = 0.5, delay = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.15, vol = 0.3, delay = 0, filter = 1200 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filter;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

const TAUNTS = [
  // pato
  (v) => { tone({ freq: 600, to: 380, type: 'sawtooth', dur: 0.15, vol: 0.3 * v }); tone({ freq: 620, to: 360, type: 'sawtooth', dur: 0.18, vol: 0.3 * v, delay: 0.2 }); },
  // bocina
  (v) => { tone({ freq: 330, type: 'square', dur: 0.35, vol: 0.2 * v }); tone({ freq: 262, type: 'square', dur: 0.4, vol: 0.2 * v, delay: 0.35 }); },
  // silbido
  (v) => { tone({ freq: 1200, to: 2200, dur: 0.25, vol: 0.25 * v }); tone({ freq: 2200, to: 900, dur: 0.35, vol: 0.25 * v, delay: 0.28 }); },
  // boing
  (v) => { tone({ freq: 120, to: 600, type: 'triangle', dur: 0.4, vol: 0.5 * v }); },
];

export const sfx = {
  shoot() { noise({ dur: 0.12, vol: 0.35, filter: 2500 }); tone({ freq: 900, to: 300, type: 'triangle', dur: 0.1, vol: 0.15 }); },
  shootFar(v = 0.4) { noise({ dur: 0.1, vol: 0.3 * v, filter: 2000 }); },
  hit() { tone({ freq: 880, to: 1320, type: 'square', dur: 0.08, vol: 0.2 }); },
  hurt() { tone({ freq: 300, to: 120, type: 'sawtooth', dur: 0.25, vol: 0.3 }); },
  wrong() { tone({ freq: 200, to: 140, type: 'square', dur: 0.15, vol: 0.15 }); },
  taunt(i, v = 1) { TAUNTS[i % TAUNTS.length](Math.max(0.05, Math.min(1, v))); },
  disguise() { tone({ freq: 500, to: 1000, type: 'sine', dur: 0.15, vol: 0.3 }); noise({ dur: 0.2, vol: 0.1, filter: 4000 }); },
  caught() { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.15, vol: 0.3, delay: i * 0.08 })); },
  beep(high = false) { tone({ freq: high ? 1320 : 880, type: 'square', dur: 0.1, vol: 0.15 }); },
  start() { [392, 523, 659].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.2, vol: 0.15, delay: i * 0.15 })); },
  win() { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.25, vol: 0.3, delay: i * 0.14 })); },
  click() { tone({ freq: 700, type: 'sine', dur: 0.05, vol: 0.15 }); },
  freeze() { tone({ freq: 2000, to: 400, type: 'sine', dur: 0.5, vol: 0.2 }); },
};
