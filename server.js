// Servidor del Escondite 3D: salas, rondas, puntuaciones y comandos de administrador.
import crypto from 'crypto';
import express from 'express';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import { MAPS, MAP_KEYS } from './shared/maps.js';
import { PROPS, PROP_KEYS } from './shared/props.js';
import { buildColliders, findFreeSpot } from './shared/physics.js';
import { createBots, BOT_LEVELS } from './bots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
// tiempo que se guarda el sitio de un jugador que pierde la conexión (recargar, cambiar de wifi a datos...)
const RECONNECT_GRACE = Number(process.env.RECONNECT_GRACE_MS) || 60000;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/shared', express.static(path.join(__dirname, 'shared')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three')));
app.get('/health', (_req, res) => res.send('ok'));

// enlace corto para invitar: /ABCD lleva directo a la sala ABCD
app.get('/:code([a-zA-Z]{4})', (req, res) => res.redirect(`/?sala=${req.params.code.toUpperCase()}`));

// direcciones en la red local, para cuando el admin juega desde su propio ordenador
function lanIps() {
  return Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
}
app.get('/api/lan', (req, res) => {
  const local = ['localhost', '127.0.0.1', '::1'].includes(req.hostname);
  res.json({ urls: local ? lanIps().map((ip) => `http://${ip}:${PORT}`) : [] });
});

// código QR del enlace de invitación
app.get('/qr.svg', async (req, res) => {
  const text = String(req.query.text || '');
  if (!/^https?:\/\/\S{1,200}$/.test(text)) return res.status(400).send('Enlace no válido');
  try {
    const svg = await QRCode.toString(text, { type: 'svg', margin: 1, color: { dark: '#1b1f3b', light: '#ffffff' } });
    res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(svg);
  } catch {
    res.status(500).send('No se pudo crear el QR');
  }
});

const server = http.createServer(app);
const io = new Server(server);

const COLLIDERS = Object.fromEntries(MAP_KEYS.map((k) => [k, buildColliders(MAPS[k])]));

const HIDER_HP = 100;
const SEEKER_HP = 100;
const HIT_DAMAGE = 34;
const WRONG_PENALTY = 10;
const ROUND_END_TIME = 9000;
const TAUNT_SOUNDS = 8; // sonidos distintos para hacer ruido (el navegador los sintetiza)
const AUTO_TAUNT_EVERY = 20000; // en el último minuto los escondidos hacen ruido solos cada 20 s
const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#ff6b9d', '#95a5a6', '#34495e'];
const BOT_NAMES = ['Bot Pepe', 'Bot Lola', 'Bot Paco', 'Bot Rosa', 'Bot Toni', 'Bot Luna', 'Bot Max', 'Bot Nora'];

const rooms = new Map();

// ------------------------------------------------------------------ utilidades
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => Date.now();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const newId = () => `p${crypto.randomBytes(6).toString('hex')}`;
// clave secreta que guarda cada navegador para poder volver a su sitio si se corta la conexión
const validKey = (k) => typeof k === 'string' && /^[\w-]{8,64}$/.test(k);

function makeCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function cleanName(name) {
  const n = String(name || '').replace(/[<>]/g, '').trim().slice(0, 16);
  return n || 'Jugador';
}

function uniqueName(room, name) {
  let n = name;
  let i = 2;
  const taken = () => [...room.players.values()].some((p) => norm(p.name) === norm(n));
  while (taken()) n = `${name}${i++}`;
  return n;
}

function findProp(query) {
  const q = norm(query);
  if (!q) return null;
  if (PROPS[q]) return q;
  return PROP_KEYS.find((k) => norm(PROPS[k].name).startsWith(q) || norm(PROPS[k].name).includes(q)) || null;
}

// ------------------------------------------------------------------ salas
function createRoom(name, color) {
  const code = makeCode();
  const room = {
    code,
    hostId: null,
    players: new Map(),
    state: 'lobby',
    round: 0,
    endAt: 0,
    lastPointsAt: 0,
    settings: { map: 'casa', rounds: 3, hideTime: 30, seekTime: 180, seekers: 0, infection: true, botLevel: 'normal', autoTaunt: true },
    mods: { gravity: 1, lightsUntil: 0, partyUntil: 0, radarUntil: 0 },
    lastWinner: null,
    ranking: null,
    summary: null,
  };
  rooms.set(code, room);
  const host = addPlayer(room, newId(), name, color);
  room.hostId = host.id;
  return { room, host };
}

function addPlayer(room, id, name, color, isBot = false) {
  const used = new Set([...room.players.values()].map((p) => p.color));
  const finalColor = color && /^#[0-9a-f]{6}$/i.test(color) && !used.has(color) ? color : COLORS.find((c) => !used.has(c)) || pick(COLORS);
  const p = {
    id,
    name: uniqueName(room, cleanName(name)),
    color: finalColor,
    isBot,
    role: room.state === 'lobby' ? 'lobby' : 'spectator',
    alive: true,
    prop: null,
    propRot: 0,
    pos: [0, 0, 0],
    rot: 0,
    pitch: 0,
    score: 0,
    hp: HIDER_HP,
    seekerCount: 0,
    frozenUntil: 0,
    stunnedUntil: 0,
    speed: 1,
    scale: 1,
    catches: 0,
    lastShot: 0,
    lastTaunt: 0,
    lastDisguise: 0,
    key: null,
    sid: null,
    connected: true,
    disconnectedAt: 0,
  };
  room.players.set(id, p);
  if (room.state !== 'lobby') {
    const map = MAPS[room.settings.map];
    const [x, z] = map.spawns.seeker[0];
    p.pos = [x, 0, z];
  }
  return p;
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    state: room.state,
    round: room.round,
    endAt: room.endAt,
    serverNow: now(),
    settings: room.settings,
    mods: room.mods,
    lastWinner: room.lastWinner,
    ranking: room.ranking,
    summary: room.state === 'roundEnd' ? room.summary : null,
    players: [...room.players.values()].map((p) => ({
      id: p.id, name: p.name, color: p.color, isBot: p.isBot, role: p.role, alive: p.alive,
      prop: p.prop, score: p.score, hp: p.hp, catches: p.catches,
      frozenUntil: p.frozenUntil, stunnedUntil: p.stunnedUntil, speed: p.speed, scale: p.scale,
      connected: p.connected,
    })),
  };
}

function sendRoom(room) {
  io.to(room.code).emit('room', publicRoom(room));
}

function sysChat(room, text, kind = 'system') {
  io.to(room.code).emit('chat', { system: true, kind, text });
}

function fx(room, data) {
  io.to(room.code).emit('fx', data);
}

function feed(room, text, icon = '•') {
  fx(room, { type: 'feed', text, icon });
}

function teleport(room, p, x, y, z, rot) {
  p.pos = [x, y, z];
  if (rot !== undefined) p.rot = rot;
  if (p.isBot) bots.teleported(p);
  else io.to(p.id).emit('spawn', { pos: p.pos, rot: p.rot });
}

function participants(room) {
  return [...room.players.values()].filter((p) => p.role === 'hider' || p.role === 'seeker');
}

function aliveHiders(room) {
  return [...room.players.values()].filter((p) => p.role === 'hider' && p.alive);
}

// ------------------------------------------------------------------ flujo de partida
function startGame(room) {
  for (const p of room.players.values()) {
    p.score = 0; p.catches = 0; p.seekerCount = 0;
  }
  room.round = 0;
  room.ranking = null;
  room.mods = { gravity: room.mods.gravity, lightsUntil: 0, partyUntil: 0, radarUntil: 0 };
  sysChat(room, '¡Empieza la partida!');
  nextRound(room);
}

function nextRound(room) {
  room.round++;
  room.lastWinner = null;
  room.summary = null;
  room.roundCatches = [];
  room.lastMinute = false;
  room.lastOne = false;
  const map = MAPS[room.settings.map];
  const colliders = COLLIDERS[room.settings.map];
  const all = [...room.players.values()];

  let nSeekers = room.settings.seekers > 0 ? room.settings.seekers : Math.max(1, Math.floor(all.length / 4));
  nSeekers = clamp(nSeekers, 1, Math.max(1, all.length - 1));
  // buscan quienes menos veces lo han hecho; a igualdad, antes las personas que los bots.
  // Quien está reconectándose no puede buscar (la ronda se quedaría sin nadie buscando).
  const eligible = all.filter((p) => p.isBot || p.connected);
  const candidates = shuffle(eligible.length ? eligible : all).sort((a, b) => a.seekerCount - b.seekerCount || a.isBot - b.isBot);
  const seekers = new Set(candidates.slice(0, nSeekers).map((p) => p.id));
  if (all.length === 1) seekers.clear(); // un solo jugador: se esconde para probar

  bots.roundStart(room);
  let hi = 0;
  let si = 0;
  for (const p of all) {
    p.alive = true;
    p.prop = null;
    p.propRot = 0;
    p.frozenUntil = 0;
    p.stunnedUntil = 0;
    p.nextAuto = 0;
    p.roundStartScore = p.score;
    if (seekers.has(p.id)) {
      p.role = 'seeker';
      p.hp = SEEKER_HP;
      p.seekerCount++;
      const [x, z] = map.spawns.seeker[si++ % map.spawns.seeker.length];
      const [fx2, fz] = findFreeSpot(colliders, x, z, 0.4, 1.8);
      teleport(room, p, fx2, 0, fz, faceCenter(map, fx2, fz));
    } else {
      // los bots también salen de aquí y van corriendo a esconderse
      p.role = 'hider';
      p.hp = HIDER_HP;
      const [x, z] = map.spawns.hider[hi++ % map.spawns.hider.length];
      const [fx2, fz] = findFreeSpot(colliders, x, z, 0.4, 1.8);
      teleport(room, p, fx2, 0, fz, faceCenter(map, fx2, fz) + (Math.random() - 0.5) * 2);
    }
  }
  room.state = 'hiding';
  room.endAt = now() + room.settings.hideTime * 1000;
  room.lastPointsAt = 0;
  fx(room, { type: 'roundStart', round: room.round, rounds: room.settings.rounds });
  sendRoom(room);
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// orientación para mirar hacia el centro del mapa
function faceCenter(map, x, z) {
  const [x1, z1, x2, z2] = map.bounds;
  return Math.atan2(-((x1 + x2) / 2 - x), -((z1 + z2) / 2 - z));
}

function endRound(room, winner, reason) {
  if (room.state !== 'hiding' && room.state !== 'seeking') return;
  room.lastWinner = winner;
  const survivors = aliveHiders(room);
  if (winner === 'hiders') {
    for (const p of survivors) p.score += 100;
  } else if (winner === 'seekers') {
    for (const p of room.players.values()) if (p.role === 'seeker') p.score += 50;
  }
  room.state = 'roundEnd';
  room.endAt = now() + ROUND_END_TIME;
  const title = winner === 'hiders' ? '¡Ganan los escondidos!' : winner === 'seekers' ? '¡Ganan los buscadores!' : 'Ronda terminada';
  const text = reason || (winner === 'hiders'
    ? `Sobreviven: ${survivors.map((p) => p.name).join(', ')} (+100)`
    : 'No queda nadie escondido (+50 a cada buscador)');
  // resumen de la ronda para la pantalla de fin de ronda
  room.summary = {
    winner,
    title,
    text,
    last: room.round >= room.settings.rounds,
    catches: room.roundCatches || [],
    survivors: survivors.map((p) => ({ id: p.id, name: p.name, color: p.color, prop: p.prop, pos: p.pos })),
    standings: [...room.players.values()]
      .filter((p) => p.role !== 'lobby')
      .map((p) => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot, score: p.score, delta: p.score - (p.roundStartScore ?? p.score) }))
      .sort((a, b) => b.score - a.score),
  };
  sysChat(room, `${title} ${text}`);
  sendRoom(room);
}

function endGame(room) {
  room.state = 'gameEnd';
  room.endAt = 0;
  room.ranking = [...room.players.values()]
    .filter((p) => p.role !== 'spectator' || p.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score, catches: p.catches }));
  const w = room.ranking[0];
  if (w) sysChat(room, `🏆 ¡${w.name} gana la partida con ${w.score} puntos!`, 'win');
  fx(room, { type: 'gameEnd' });
  sendRoom(room);
}

function backToLobby(room) {
  room.state = 'lobby';
  room.round = 0;
  room.endAt = 0;
  room.ranking = null;
  for (const p of room.players.values()) {
    p.role = 'lobby'; p.prop = null; p.alive = true; p.frozenUntil = 0; p.speed = 1; p.scale = 1;
  }
  sendRoom(room);
}

// saca a un jugador de la sala (se va, lo expulsan o no vuelve a tiempo tras perder la conexión)
function removePlayer(room, p, msg) {
  room.players.delete(p.id);
  const humans = [...room.players.values()].filter((q) => !q.isBot);
  if (!humans.length) {
    rooms.delete(room.code);
    return;
  }
  if (msg) sysChat(room, msg);
  if (room.hostId === p.id) {
    const next = humans.find((q) => q.connected) || humans[0];
    room.hostId = next.id;
    sysChat(room, `👑 ${next.name} es ahora el administrador.`);
  }
  if (room.state === 'hiding' || room.state === 'seeking') {
    if (aliveHiders(room).length === 0) endRound(room, 'seekers');
    else if (!participants(room).some((q) => q.role === 'seeker')) endRound(room, 'hiders', 'No quedan buscadores');
  }
  sendRoom(room);
}

function catchHider(room, hider, by) {
  hider.hp = 0;
  if (by) { by.score += 100; by.catches++; }
  room.roundCatches?.push({ by: by?.name || null, byColor: by?.color || null, name: hider.name, color: hider.color, prop: hider.prop });
  feed(room, by ? `${by.name} ha pillado a ${hider.name} (${hider.prop ? PROPS[hider.prop].name : 'sin disfraz'})` : `${hider.name} ha sido eliminado`, '🎯');
  fx(room, { type: 'caught', id: hider.id, by: by?.id || null, pos: hider.pos, prop: hider.prop, name: hider.name });
  if (room.settings.infection) {
    // pillado = pasa a buscar (también los bots, que se ponen a cazar)
    hider.role = 'seeker';
    hider.hp = SEEKER_HP;
    hider.prop = null;
    hider.alive = true;
  } else {
    hider.alive = false;
  }
  sendRoom(room);
  const left = aliveHiders(room);
  if (left.length === 0) endRound(room, 'seekers');
  else if (left.length === 1 && !room.lastOne && room.state === 'seeking') {
    room.lastOne = true;
    fx(room, { type: 'announce', title: '¡Solo queda uno!', text: `${left[0].name} es el último escondido` });
  }
}

// un disparo de buscador (persona o bot) que ya se ha dado por bueno
function applyShot(room, p, kind, targetId) {
  if (kind === 'player') {
    const h = room.players.get(targetId);
    if (!h || h.role !== 'hider' || !h.alive) return;
    h.hp -= HIT_DAMAGE;
    p.score += 10;
    fx(room, { type: 'hit', id: h.id, by: p.id, from: p.pos, hp: Math.max(0, h.hp) });
    if (h.hp <= 0) catchHider(room, h, p);
    else {
      bots.hurt(room, h, p);
      sendRoom(room);
    }
  } else if (kind === 'prop') {
    p.hp -= WRONG_PENALTY;
    if (p.hp <= 0) {
      p.hp = SEEKER_HP;
      p.stunnedUntil = now() + 5000;
      feed(room, `${p.name} ha disparado a demasiados objetos y está mareado`, '💫');
    }
    sendRoom(room);
  }
}

// un escondido hace ruido: suena para todos y los bots buscadores van a mirar
function doTaunt(room, p, forced = false) {
  p.lastTaunt = now();
  if (!forced) p.score += 15;
  fx(room, { type: 'taunt', id: p.id, pos: p.pos, sound: Math.floor(Math.random() * TAUNT_SOUNDS), forced });
  bots.heard(room, p);
  sendRoom(room);
}

const bots = createBots({
  colliders: (mapId) => COLLIDERS[mapId],
  shoot(room, bot, kind, targetId, from, to) {
    bot.lastShot = now();
    fx(room, { type: 'tracer', from: from.map((v) => +v.toFixed(2)), to: to.map((v) => +v.toFixed(2)), color: bot.color, by: bot.id });
    applyShot(room, bot, kind, targetId);
  },
  taunt: (room, bot) => doTaunt(room, bot),
  disguised(room, bot) {
    fx(room, { type: 'disguise', id: bot.id, pos: bot.pos });
    sendRoom(room);
  },
});

function tick() {
  const t = now();
  for (const room of rooms.values()) {
    for (const p of [...room.players.values()]) {
      if (!p.isBot && !p.connected && t - p.disconnectedAt > RECONNECT_GRACE) removePlayer(room, p, `${p.name} se ha ido (no ha vuelto a conectarse).`);
    }
    if (!rooms.has(room.code)) continue;
    if (room.state === 'hiding' && t >= room.endAt) {
      room.state = 'seeking';
      room.endAt = t + room.settings.seekTime * 1000;
      room.lastPointsAt = t;
      bots.seekStart(room);
      fx(room, { type: 'announce', title: '¡Salen los buscadores!', text: 'Escondidos: no os mováis... o sí 😏' });
      sendRoom(room);
    } else if (room.state === 'seeking') {
      if (t - room.lastPointsAt >= 10000) {
        room.lastPointsAt = t;
        for (const p of aliveHiders(room)) p.score += 5;
        sendRoom(room);
      }
      if (room.settings.autoTaunt && room.endAt - t <= 60000) autoTaunt(room, t);
      if (aliveHiders(room).length === 0) endRound(room, 'seekers');
      else if (t >= room.endAt) endRound(room, 'hiders');
    } else if (room.state === 'roundEnd' && t >= room.endAt) {
      if (room.round >= room.settings.rounds) endGame(room);
      else nextRound(room);
    }
  }
}
setInterval(tick, 250);

// último minuto: los escondidos hacen ruido solos cada 20 s (así no se puede acampar para siempre)
function autoTaunt(room, t) {
  if (!room.lastMinute) {
    room.lastMinute = true;
    fx(room, { type: 'announce', title: '⏰ ¡Último minuto!', text: 'Los escondidos hacen ruido solos cada 20 segundos' });
  }
  for (const p of aliveHiders(room)) {
    if (!p.nextAuto) p.nextAuto = t + 1500 + Math.random() * 8000;
    p.nextAuto = Math.max(p.nextAuto, p.lastTaunt + AUTO_TAUNT_EVERY);
    if (t < p.nextAuto) continue;
    p.nextAuto = t + AUTO_TAUNT_EVERY;
    doTaunt(room, p, true);
    if (!p.isBot) io.to(p.id).emit('toast', { text: '📣 ¡Último minuto: has hecho ruido!' });
  }
}

// bots y posiciones a 15 Hz
let lastFrame = now();
setInterval(() => {
  const t = now();
  const dt = Math.min(0.1, (t - lastFrame) / 1000);
  lastFrame = t;
  for (const room of rooms.values()) {
    if (room.state === 'hiding' || room.state === 'seeking') bots.update(room, dt, t);
    if (room.state === 'lobby') continue;
    const list = [];
    for (const p of room.players.values()) {
      if (p.role === 'lobby') continue;
      list.push([p.id, +p.pos[0].toFixed(2), +p.pos[1].toFixed(2), +p.pos[2].toFixed(2), +p.rot.toFixed(2), +p.pitch.toFixed(2), +p.propRot.toFixed(2)]);
    }
    io.to(room.code).volatile.emit('snap', list);
  }
}, 66);

// ------------------------------------------------------------------ comandos de administrador
const HELP = [
  ['/empezar', 'Empieza la partida'],
  ['/terminar', 'Termina la partida y anuncia el ganador'],
  ['/siguiente', 'Salta a la siguiente ronda'],
  ['/sala', 'Vuelve todos a la sala de espera'],
  ['/tiempo +30', 'Suma o resta segundos al reloj'],
  ['/radar [seg]', 'Los buscadores ven a todos los escondidos'],
  ['/sonido <nombre|todos>', 'Obliga a un escondido a hacer ruido'],
  ['/apagarluces [seg]', 'Apaga las luces (los buscadores llevan linterna)'],
  ['/encenderluces', 'Vuelve la luz'],
  ['/fiesta [seg]', 'Modo discoteca'],
  ['/congelar <nombre|todos> [seg]', 'Congela a alguien'],
  ['/descongelar <nombre|todos>', 'Descongela'],
  ['/velocidad <nombre|todos> <x>', 'Cambia la velocidad (0.2 a 4)'],
  ['/tamano <nombre|todos> <x>', 'Cambia el tamaño (0.3 a 3)'],
  ['/gravedad <baja|normal|alta>', 'Cambia la gravedad'],
  ['/disfrazar <nombre> <objeto>', 'Disfraza a un escondido (ej: patito)'],
  ['/buscador <nombre>', 'Convierte a alguien en buscador'],
  ['/escondido <nombre>', 'Convierte a alguien en escondido'],
  ['/pillar <nombre>', 'Elimina a un escondido'],
  ['/revivir <nombre>', 'Revive a un escondido pillado'],
  ['/traer <nombre|todos>', 'Teletransporta a alguien hasta ti'],
  ['/ir <nombre>', 'Te teletransportas hasta alguien'],
  ['/darpuntos <nombre> <n>', 'Da puntos'],
  ['/quitarpuntos <nombre> <n>', 'Quita puntos'],
  ['/expulsar <nombre>', 'Echa a alguien de la sala'],
  ['/mapa <casa|almacen|parque>', 'Cambia el mapa (en la sala de espera)'],
  ['/rondas <n>', 'Número de rondas'],
  ['/bot [n]', 'Añade bots (se esconden y, si les toca, buscan)'],
  ['/quitarbots', 'Quita todos los bots'],
  ['/dificultad <facil|normal|dificil>', 'Lo listos que son los bots'],
  ['/anuncio <texto>', 'Muestra un mensaje gigante a todos'],
  ['/admin <nombre>', 'Pasa el mando de administrador a otro'],
];

function findTargets(room, query, admin) {
  const q = norm(query);
  if (!q) return [];
  if (q === 'todos' || q === 'all') return [...room.players.values()].filter((p) => p.id !== admin.id);
  if (q === 'yo' || q === 'me') return [admin];
  const list = [...room.players.values()];
  const exact = list.filter((p) => norm(p.name) === q);
  if (exact.length) return exact;
  return list.filter((p) => norm(p.name).startsWith(q)).slice(0, 1);
}

function runCommand(room, admin, line) {
  const parts = line.trim().replace(/^\//, '').split(/\s+/);
  const cmd = norm(parts.shift());
  const args = parts;
  const reply = (text) => io.to(admin.id).emit('chat', { system: true, kind: 'admin', text });
  // el objetivo puede tener espacios en el nombre: probamos el nombre más largo posible
  let rest = args.slice(1);
  const needTargets = () => {
    const names = [...room.players.values()].map((p) => norm(p.name));
    for (let n = args.length; n > 1; n--) {
      const cand = norm(args.slice(0, n).join(' '));
      if (names.includes(cand)) {
        rest = args.slice(n);
        return findTargets(room, cand, admin);
      }
    }
    rest = args.slice(1);
    const t = findTargets(room, args[0], admin);
    if (!t.length) reply(`No encuentro a "${args[0] || ''}".`);
    return t;
  };
  const playing = room.state === 'hiding' || room.state === 'seeking';
  const map = MAPS[room.settings.map];

  switch (cmd) {
    case 'ayuda':
    case 'help':
    case 'comandos':
      reply(HELP.map(([c, d]) => `${c} — ${d}`).join('\n'));
      return;
    case 'empezar':
    case 'start':
      if (room.state === 'lobby' || room.state === 'gameEnd') startGame(room);
      else reply('La partida ya está en marcha.');
      return;
    case 'terminar':
    case 'fin':
      if (room.state === 'lobby') return reply('No hay partida en marcha.');
      endGame(room);
      return;
    case 'siguiente':
    case 'saltar':
      if (playing) endRound(room, null, 'El administrador ha saltado la ronda');
      else if (room.state === 'roundEnd') room.endAt = now();
      return;
    case 'sala':
    case 'lobby':
      backToLobby(room);
      return;
    case 'tiempo': {
      const n = parseInt(args[0], 10);
      if (!playing || Number.isNaN(n)) return reply('Uso: /tiempo +30 (durante una ronda)');
      room.endAt = Math.max(now() + 3000, room.endAt + n * 1000);
      feed(room, `El admin ha ${n >= 0 ? 'añadido' : 'quitado'} ${Math.abs(n)} s al reloj`, '⏱️');
      sendRoom(room);
      return;
    }
    case 'radar': {
      const s = clamp(parseFloat(args[0]) || 4, 1, 30);
      room.mods.radarUntil = now() + s * 1000;
      fx(room, { type: 'radar', until: room.mods.radarUntil });
      feed(room, `¡Radar activado ${s} s! Los buscadores ven a todos`, '📡');
      sendRoom(room);
      return;
    }
    case 'sonido':
    case 'ruido': {
      if (room.state !== 'seeking') return reply('Solo mientras se busca.');
      const t = (args[0] ? needTargets() : aliveHiders(room)).filter((p) => p.role === 'hider' && p.alive);
      for (const p of t) doTaunt(room, p, true);
      if (t.length) feed(room, `El admin ha hecho sonar a ${t.length === 1 ? t[0].name : t.length + ' escondidos'}`, '🔊');
      return;
    }
    case 'apagarluces':
    case 'oscuridad': {
      const s = clamp(parseFloat(args[0]) || 20, 3, 120);
      room.mods.lightsUntil = now() + s * 1000;
      feed(room, `¡Se apagan las luces durante ${s} s!`, '🌑');
      sendRoom(room);
      return;
    }
    case 'encenderluces':
      room.mods.lightsUntil = 0;
      sendRoom(room);
      return;
    case 'fiesta':
    case 'disco': {
      const s = clamp(parseFloat(args[0]) || 15, 3, 120);
      room.mods.partyUntil = now() + s * 1000;
      feed(room, '¡Modo fiesta! 🕺', '🎉');
      sendRoom(room);
      return;
    }
    case 'congelar': {
      const t = needTargets();
      const s = clamp(parseFloat(rest[0]) || 5, 1, 120);
      for (const p of t) p.frozenUntil = now() + s * 1000;
      if (t.length) feed(room, `${t.length === 1 ? t[0].name + ' ha sido congelado' : 'Todos congelados'} (${s} s)`, '🧊');
      sendRoom(room);
      return;
    }
    case 'descongelar': {
      for (const p of needTargets()) p.frozenUntil = 0;
      sendRoom(room);
      return;
    }
    case 'velocidad': {
      const t = needTargets();
      const v = clamp(parseFloat(rest[0]) || 1, 0.2, 4);
      for (const p of t) p.speed = v;
      if (t.length) feed(room, `Velocidad x${v} para ${t.length === 1 ? t[0].name : 'todos'}`, '⚡');
      sendRoom(room);
      return;
    }
    case 'tamano':
    case 'tamaño':
    case 'tam': {
      const t = needTargets();
      const v = clamp(parseFloat(rest[0]) || 1, 0.3, 3);
      for (const p of t) p.scale = v;
      if (t.length) feed(room, `Tamaño x${v} para ${t.length === 1 ? t[0].name : 'todos'}`, '📏');
      sendRoom(room);
      return;
    }
    case 'gravedad': {
      const a = norm(args[0]);
      const v = a === 'baja' ? 0.35 : a === 'alta' ? 2 : a === 'normal' || !a ? 1 : clamp(parseFloat(a) || 1, 0.1, 3);
      room.mods.gravity = v;
      feed(room, `Gravedad ${a || 'normal'}`, '🪐');
      sendRoom(room);
      return;
    }
    case 'disfrazar': {
      const t = needTargets().filter((p) => p.role === 'hider');
      const type = findProp(rest.join(' ')) || pick(PROP_KEYS);
      for (const p of t) {
        p.prop = type;
        if (!p.isBot) io.to(p.id).emit('forceProp', { prop: type });
      }
      if (t.length) feed(room, `El admin ha disfrazado a ${t.length === 1 ? t[0].name : 'todos'} de ${PROPS[type].name}`, '🎭');
      sendRoom(room);
      return;
    }
    case 'buscador':
    case 'escondido': {
      if (!playing) return reply('Solo durante una ronda.');
      for (const p of needTargets()) {
        p.role = cmd === 'buscador' ? 'seeker' : 'hider';
        p.alive = true;
        p.hp = 100;
        if (p.role === 'seeker') p.prop = null;
        feed(room, `${p.name} ahora es ${cmd}`, '🔁');
      }
      sendRoom(room);
      if (aliveHiders(room).length === 0) endRound(room, 'seekers');
      return;
    }
    case 'pillar':
    case 'matar':
    case 'eliminar': {
      if (!playing) return reply('Solo durante una ronda.');
      for (const p of needTargets()) {
        if (p.role === 'hider' && p.alive) catchHider(room, p, null);
        else if (p.role === 'seeker') { p.stunnedUntil = now() + 5000; feed(room, `${p.name} está aturdido`, '💫'); sendRoom(room); }
      }
      return;
    }
    case 'revivir': {
      if (!playing) return reply('Solo durante una ronda.');
      for (const p of needTargets()) {
        p.role = 'hider'; p.alive = true; p.hp = HIDER_HP;
        if (p.isBot) p.ai = null; // vuelve a esconderse solo
        else {
          const [x, z] = pick(map.spawns.hider);
          teleport(room, p, x, 0, z);
        }
        feed(room, `${p.name} ha revivido`, '✨');
      }
      sendRoom(room);
      return;
    }
    case 'traer': {
      for (const p of needTargets()) teleport(room, p, admin.pos[0] + (Math.random() - 0.5) * 2, admin.pos[1] + 0.5, admin.pos[2] + (Math.random() - 0.5) * 2);
      return;
    }
    case 'ir': {
      const t = needTargets()[0];
      if (t) teleport(room, admin, t.pos[0] + 1, t.pos[1] + 0.5, t.pos[2] + 1);
      return;
    }
    case 'darpuntos':
    case 'quitarpuntos': {
      const t = needTargets();
      const n = Math.abs(parseInt(rest[0], 10) || 100) * (cmd === 'darpuntos' ? 1 : -1);
      for (const p of t) p.score += n;
      if (t.length) feed(room, `${n > 0 ? '+' : ''}${n} puntos para ${t.length === 1 ? t[0].name : 'todos'}`, '⭐');
      sendRoom(room);
      return;
    }
    case 'expulsar':
    case 'kick': {
      for (const p of needTargets()) {
        if (p.id === admin.id) continue;
        if (!p.isBot) {
          io.to(p.id).emit('kicked');
          const s = p.sid && io.sockets.sockets.get(p.sid);
          if (s) unbindSocket(s, room, p);
        }
        removePlayer(room, p, `${p.name} ha sido expulsado.`);
      }
      return;
    }
    case 'mapa': {
      const m = MAP_KEYS.find((k) => norm(args[0]) && k.startsWith(norm(args[0])));
      if (!m) return reply(`Mapas: ${MAP_KEYS.join(', ')}`);
      if (room.state !== 'lobby' && room.state !== 'gameEnd') return reply('Cambia el mapa desde la sala de espera (/sala).');
      room.settings.map = m;
      sysChat(room, `Mapa: ${MAPS[m].name}`);
      sendRoom(room);
      return;
    }
    case 'rondas': {
      room.settings.rounds = clamp(parseInt(args[0], 10) || 3, 1, 20);
      sysChat(room, `Rondas: ${room.settings.rounds}`);
      sendRoom(room);
      return;
    }
    case 'bot':
    case 'bots': {
      const n = clamp(parseInt(args[0], 10) || 1, 1, 8);
      for (let i = 0; i < n; i++) {
        if (room.players.size >= 16) break;
        const name = BOT_NAMES.find((b) => ![...room.players.values()].some((p) => p.name === b)) || 'Bot';
        const bot = addPlayer(room, `bot-${Math.random().toString(36).slice(2, 9)}`, name, null, true);
        if (playing) { bot.role = 'hider'; bot.hp = HIDER_HP; }
      }
      sysChat(room, `Añadidos ${n} bot(s).`);
      sendRoom(room);
      return;
    }
    case 'quitarbots': {
      for (const p of [...room.players.values()]) if (p.isBot) room.players.delete(p.id);
      sendRoom(room);
      if (playing && aliveHiders(room).length === 0) endRound(room, 'seekers');
      else if (playing && !participants(room).some((q) => q.role === 'seeker')) endRound(room, 'hiders', 'No quedan buscadores');
      return;
    }
    case 'dificultad': {
      const lv = { facil: 'facil', normal: 'normal', dificil: 'dificil', facile: 'facil', easy: 'facil', hard: 'dificil' }[norm(args[0])];
      if (!lv) return reply('Uso: /dificultad facil | normal | dificil');
      room.settings.botLevel = lv;
      sysChat(room, `🤖 Bots en modo ${{ facil: 'fácil', normal: 'normal', dificil: 'difícil' }[lv]}`);
      sendRoom(room);
      return;
    }
    case 'anuncio': {
      const text = args.join(' ').slice(0, 120);
      if (text) fx(room, { type: 'announce', title: '📢 Admin', text, big: true });
      return;
    }
    case 'admin': {
      const t = needTargets()[0];
      if (t && !t.isBot) {
        room.hostId = t.id;
        sysChat(room, `👑 ${t.name} es ahora el administrador.`);
        sendRoom(room);
      }
      return;
    }
    default:
      reply(`Comando desconocido: /${cmd}. Escribe /ayuda para ver la lista.`);
  }
}

// ------------------------------------------------------------------ conexiones
// Cada jugador tiene un id fijo; su conexión puede cambiar si recarga la página o se le corta.
// Cada conexión entra en la sala de socket.io de su sala y en la de su propio id (para mensajes privados).
function bindSocket(socket, room, p) {
  if (p.sid && p.sid !== socket.id) {
    const old = io.sockets.sockets.get(p.sid);
    if (old) unbindSocket(old, room, p);
  }
  p.sid = socket.id;
  p.connected = true;
  p.disconnectedAt = 0;
  socket.join(room.code);
  socket.join(p.id);
  socket.data.room = room.code;
  socket.data.pid = p.id;
}

function unbindSocket(socket, room, p) {
  socket.leave(room.code);
  socket.leave(p.id);
  socket.data.room = null;
  socket.data.pid = null;
}

const findByKey = (room, key) => (validKey(key) ? [...room.players.values()].find((q) => q.key === key) : null);

io.on('connection', (socket) => {
  const getRoom = () => (socket.data.room ? rooms.get(socket.data.room) : null);
  const me = () => getRoom()?.players.get(socket.data.pid);
  const isHost = (room) => room.hostId === socket.data.pid;

  // devuelve a su sitio a un jugador que ya estaba en la sala (misma clave)
  function resume(room, p, cb) {
    if (socket.data.room && (socket.data.room !== room.code || socket.data.pid !== p.id)) leave();
    const wasAway = !p.connected;
    bindSocket(socket, room, p);
    cb?.({ ok: true, code: room.code, id: p.id });
    if (wasAway) sysChat(room, `📶 ${p.name} ha vuelto.`);
    sendRoom(room);
    if (room.state !== 'lobby') socket.emit('spawn', { pos: p.pos, rot: p.rot, propRot: p.propRot });
  }

  socket.on('create', ({ name, color, key } = {}, cb) => {
    leave();
    const { room, host } = createRoom(name, color);
    host.key = validKey(key) ? key : null;
    bindSocket(socket, room, host);
    cb?.({ ok: true, code: room.code, id: host.id });
    sysChat(room, `👑 ${host.name} ha creado la sala.`);
    sendRoom(room);
  });

  socket.on('join', ({ code, name, color, key } = {}, cb) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return cb?.({ ok: false, error: 'No existe ninguna sala con ese código.' });
    const mine = findByKey(room, key);
    if (mine) return resume(room, mine, cb);
    if (room.players.size >= 16) return cb?.({ ok: false, error: 'La sala está llena (máximo 16).' });
    leave();
    const p = addPlayer(room, newId(), name, color);
    p.key = validKey(key) ? key : null;
    bindSocket(socket, room, p);
    // si todavía se están escondiendo, entra directamente como escondido
    if (room.state === 'hiding') {
      const map = MAPS[room.settings.map];
      const [sx, sz] = pick(map.spawns.hider);
      const [x, z] = findFreeSpot(COLLIDERS[room.settings.map], sx, sz, 0.4, 1.8);
      Object.assign(p, { role: 'hider', alive: true, hp: HIDER_HP, pos: [x, 0, z], rot: faceCenter(map, x, z) });
    }
    cb?.({ ok: true, code: room.code, id: p.id });
    const note = p.role === 'hider' ? ' ¡Corre a esconderte!' : p.role === 'spectator' ? ' (jugará la próxima ronda)' : '';
    sysChat(room, `${p.name} se ha unido.${note}`);
    sendRoom(room);
    if (room.state !== 'lobby') socket.emit('spawn', { pos: p.pos, rot: p.rot });
  });

  // al recargar la página o volver la conexión, el navegador pide su sitio con su clave
  socket.on('rejoin', ({ code, key } = {}, cb) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    const p = room && findByKey(room, key);
    if (!p) return cb?.({ ok: false, error: 'Esa partida ya no existe.', roomExists: !!room });
    resume(room, p, cb);
  });

  socket.on('settings', (s = {}) => {
    const room = getRoom();
    if (!room || !isHost(room)) return;
    const st = room.settings;
    if (typeof s.map === 'string' && Object.hasOwn(MAPS, s.map)) st.map = s.map;
    if (s.rounds !== undefined) st.rounds = clamp(parseInt(s.rounds, 10) || 3, 1, 20);
    if (s.hideTime !== undefined) st.hideTime = clamp(parseInt(s.hideTime, 10) || 30, 5, 120);
    if (s.seekTime !== undefined) st.seekTime = clamp(parseInt(s.seekTime, 10) || 180, 30, 900);
    if (s.seekers !== undefined) st.seekers = clamp(parseInt(s.seekers, 10) || 0, 0, 8);
    if (s.infection !== undefined) st.infection = !!s.infection;
    if (typeof s.botLevel === 'string' && Object.hasOwn(BOT_LEVELS, s.botLevel)) st.botLevel = s.botLevel;
    if (s.autoTaunt !== undefined) st.autoTaunt = !!s.autoTaunt;
    sendRoom(room);
  });

  socket.on('start', () => {
    const room = getRoom();
    if (!room || !isHost(room)) return;
    if (room.state === 'lobby' || room.state === 'gameEnd') startGame(room);
  });

  socket.on('backToLobby', () => {
    const room = getRoom();
    if (room && isHost(room)) backToLobby(room);
  });

  socket.on('state', (d) => {
    const p = me();
    if (!p || !d || !Array.isArray(d.p)) return;
    const [x, y, z] = d.p.map(Number);
    if (![x, y, z].every(Number.isFinite)) return;
    p.pos = [x, y, z];
    p.rot = Number(d.r) || 0;
    p.pitch = Number(d.pi) || 0;
    p.propRot = Number(d.pr) || 0;
  });

  socket.on('disguise', ({ type } = {}) => {
    const room = getRoom();
    const p = me();
    if (!room || !p || p.role !== 'hider' || !p.alive) return;
    if (room.state !== 'hiding' && room.state !== 'seeking') return;
    if (type !== null && !PROPS[type]) return;
    if (now() - p.lastDisguise < 500) return;
    p.lastDisguise = now();
    p.prop = type;
    socket.to(room.code).emit('fx', { type: 'disguise', id: p.id, pos: p.pos });
    sendRoom(room);
  });

  socket.on('shoot', ({ kind, target, from, to } = {}) => {
    const room = getRoom();
    const p = me();
    if (!room || !p || p.role !== 'seeker' || room.state !== 'seeking') return;
    const t = now();
    if (t - p.lastShot < 280 || p.frozenUntil > t || p.stunnedUntil > t) return;
    p.lastShot = t;
    const okVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
    if (okVec(from) && okVec(to)) socket.to(room.code).emit('fx', { type: 'tracer', from, to, color: p.color, by: p.id });
    applyShot(room, p, kind, target);
  });

  socket.on('taunt', () => {
    const room = getRoom();
    const p = me();
    if (!room || !p || p.role !== 'hider' || !p.alive || room.state !== 'seeking') return;
    if (now() - p.lastTaunt < 6000) return;
    doTaunt(room, p);
  });

  socket.on('chat', (text) => {
    const room = getRoom();
    const p = me();
    if (!room || !p) return;
    const msg = String(text || '').slice(0, 200).trim();
    if (!msg) return;
    if (msg.startsWith('/')) {
      if (!isHost(room)) {
        socket.emit('chat', { system: true, kind: 'admin', text: 'Solo el administrador puede usar comandos.' });
        return;
      }
      runCommand(room, p, msg);
      return;
    }
    // los buscadores no ven el chat de los escondidos durante la ronda (y viceversa)
    const playing = room.state === 'hiding' || room.state === 'seeking';
    const payload = { from: p.name, color: p.color, text: msg, team: playing ? p.role : null };
    if (playing && (p.role === 'hider' || p.role === 'seeker')) {
      for (const q of room.players.values()) {
        if (q.isBot) continue;
        if (q.role === p.role || q.role === 'spectator' || q.id === room.hostId || !q.alive) io.to(q.id).emit('chat', payload);
      }
    } else io.to(room.code).emit('chat', payload);
  });

  socket.on('leave', () => leave());

  // si se corta la conexión le guardamos el sitio un rato por si vuelve
  socket.on('disconnect', () => {
    const room = getRoom();
    const p = me();
    if (!room || !p || p.sid !== socket.id) return;
    if (!p.key) return leave();
    p.connected = false;
    p.disconnectedAt = now();
    sysChat(room, `📶 ${p.name} ha perdido la conexión… le guardamos el sitio ${Math.round(RECONNECT_GRACE / 1000)} s.`);
    sendRoom(room);
  });

  function leave() {
    const room = getRoom();
    if (!room) return;
    const p = me();
    if (!p) {
      socket.leave(room.code);
      socket.data.room = null;
      return;
    }
    unbindSocket(socket, room, p);
    removePlayer(room, p, `${p.name} se ha ido.`);
  }
});

server.listen(PORT, () => {
  console.log(`\n  🎮 Escondite 3D listo en http://localhost:${PORT}`);
  for (const ip of lanIps()) console.log(`     Tus amigos (misma wifi): http://${ip}:${PORT}`);
  console.log('');
});
