// Inteligencia de los bots.
// Escondidos: se esconden junto a objetos iguales para pasar desapercibidos, huyen si les disparan
// y hacen ruido de vez en cuando. Buscadores: patrullan, sospechan de lo que se mueve o desentona,
// van hacia los ruidos, persiguen y disparan. Si los pillan con el modo infección, pasan a buscar.
import { MAPS } from './shared/maps.js';
import { PROPS, propFootprint } from './shared/props.js';
import { moveBody } from './shared/physics.js';
import { buildNav, findPath, nearestWalkable, randomWalkable, cellCenter, lineOfSight, boxBlocked, segBox } from './shared/nav.js';

// see: lo rápido que sospechan · aim: puntería · speed: m/s · react: s hasta el primer disparo
// gap: s entre disparos · range: hasta dónde ven · guess: probabilidad de disparar «a ver si es alguien»
export const BOT_LEVELS = {
  facil: { see: 0.5, aim: 0.4, speed: 3.9, react: 1.2, gap: 1.0, range: 15, guess: 0.4 },
  normal: { see: 1, aim: 0.58, speed: 4.5, react: 0.75, gap: 0.8, range: 21, guess: 0.35 },
  dificil: { see: 1.7, aim: 0.74, speed: 5.1, react: 0.45, gap: 0.62, range: 27, guess: 0.3 },
};

const EYE = 1.6;
const HALF_FOV = 1.2; // radianes a cada lado (unos 70°)
const HEAR = 45; // distancia a la que se oye un ruido
const HIDE_SPEED = 4.3;
const FLEE_SPEED = 5;
const SHOOT_RANGE = 13; // a esta distancia se paran a disparar

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const overlap2 = (a, b, m) => a[0] - m < b[3] && a[3] + m > b[0] && a[2] - m < b[5] && a[5] + m > b[2];

// tamaño del cuerpo, igual que en el navegador (un poco más estrecho para que quepan por las puertas)
function bodySize(prop, scale = 1) {
  if (!prop) return { r: 0.3 * scale, h: 1.8 * scale };
  const [w, h, d] = propFootprint(prop, 0);
  return { r: Math.max(0.15, Math.min(0.45, Math.min(w, d) / 2)) * scale, h: Math.max(0.3, Math.min(h, 2.2)) * scale };
}

// api: { colliders(mapId), shoot(room, bot, kind, targetId, from, to), taunt(room, bot), disguised(room, bot) }
export function createBots(api) {
  const cache = {};

  // datos de cada mapa que necesitan los bots (se calculan una vez)
  function mapData(mapId) {
    if (cache[mapId]) return cache[mapId];
    const map = MAPS[mapId];
    const nav = buildNav(map, api.colliders(mapId));
    const floor = map.props.filter((q) => q.p[1] === 0 && q.t !== 'tree');
    const props = map.props.map((q) => {
      const [w, h, d] = propFootprint(q.t, q.r);
      return { t: q.t, x: q.p[0], z: q.p[2], box: [q.p[0] - w / 2, q.p[1], q.p[2] - d / 2, q.p[0] + w / 2, q.p[1] + h, q.p[2] + d / 2] };
    });
    const byType = {};
    for (const q of map.props) (byType[q.t] ||= []).push([q.p[0], q.p[2]]);
    // sitios que merece la pena revisar: junto a los muebles y por donde salen los escondidos
    const poi = [];
    for (const q of floor) {
      const c = nearestWalkable(nav, q.p[0], q.p[2], 5);
      if (c >= 0) poi.push(cellCenter(nav, c));
    }
    for (const [x, z] of map.spawns.hider) poi.push([x, z]);
    cache[mapId] = { map, nav, floor, props, byType, poi };
    return cache[mapId];
  }

  const level = (room) => (Object.hasOwn(BOT_LEVELS, room.settings.botLevel) ? BOT_LEVELS[room.settings.botLevel] : BOT_LEVELS.normal);
  const sync = (p) => { p.pos = [p.ai.body.x, p.ai.body.y, p.ai.body.z]; };

  // ------------------------------------------------------------ cerebro
  function init(room, p, md, t) {
    const size = bodySize(p.role === 'hider' ? p.prop : null, p.scale || 1);
    p.ai = {
      role: p.role,
      body: { x: p.pos[0], y: p.pos[1], z: p.pos[2], vy: 0, r: size.r, h: size.h, onGround: true },
      mode: 'idle', path: null, wait: 0, until: 0, think: 0,
      susp: new Map(), last: new Map(), moved: new Map(), vis: new Set(),
      target: null, lastSeen: null, lastSeenAt: 0, repath: 0,
      nextShot: 0, nextTaunt: 0, pending: null, wakeAt: 0,
      spot: null, recent: [], stuck: 0, prog: [p.pos[0], p.pos[2]], progT: t + 700,
      lookYaw: p.rot, lookSwitch: 0,
    };
    if (p.role === 'hider') {
      release(room, p);
      hide(room, p, md, t, room.state !== 'hiding');
    } else if (room.state === 'seeking') {
      // recién convertido en buscador (o recién llegado): un momento para situarse
      p.ai.wakeAt = t + 1800;
      startLook(p, t, 600);
    }
  }

  // ------------------------------------------------------------ esconderse
  function chooseSpot(room, p, md, near = null, min = 0, max = Infinity, away = null) {
    room.botSpots ||= [];
    const others = [...room.players.values()].filter((q) => q.id !== p.id && q.role === 'hider' && q.alive);
    for (let k = 0; k < 80; k++) {
      const a = pick(md.floor);
      if (near) {
        const d = Math.hypot(a.p[0] - near[0], a.p[2] - near[1]);
        if (d < min || d > max) continue;
        // no huir hacia quien dispara
        if (away && Math.hypot(a.p[0] - away[0], a.p[2] - away[1]) < d * 0.7) continue;
      }
      // casi siempre se disfraza del mismo objeto que tiene al lado: así no desentona
      let type = a.t;
      if (Math.random() < 0.3) type = pick(md.floor.filter((q) => Math.abs(q.p[0] - a.p[0]) < 6 && Math.abs(q.p[2] - a.p[2]) < 6)).t;
      const rot = a.r + (Math.random() < 0.75 ? 0 : (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2);
      const [w, h, d] = propFootprint(type, rot);
      const [aw, , ad] = propFootprint(a.t, a.r);
      const gap = rnd(0.06, 0.45);
      const ox = aw / 2 + w / 2 + gap;
      const oz = ad / 2 + d / 2 + gap;
      const offsets = shuffle([[ox, 0], [-ox, 0], [0, oz], [0, -oz], [ox, oz * 0.5], [-ox, -oz * 0.5], [ox * 0.5, -oz], [-ox * 0.5, oz]]);
      for (const [dx, dz] of offsets) {
        const x = a.p[0] + dx;
        const z = a.p[2] + dz;
        const box = [x - w / 2, 0.02, z - d / 2, x + w / 2, Math.max(0.3, h), z + d / 2];
        if (boxBlocked(md.nav, box)) continue;
        if (room.botSpots.some((s) => s.owner !== p.id && overlap2(s.box, box, 0.25))) continue;
        if (others.some((q) => Math.hypot(q.pos[0] - x, q.pos[2] - z) < 1.2)) continue;
        const c = nearestWalkable(md.nav, x, z, 4);
        if (c < 0) continue;
        const appr = cellCenter(md.nav, c);
        if (Math.hypot(appr[0] - x, appr[1] - z) > 2.2) continue;
        return { x, z, type, rot, box, appr, owner: p.id };
      }
    }
    return null;
  }

  function fallbackSpot(p, md) {
    const [x, z] = cellCenter(md.nav, randomWalkable(md.nav));
    return { x, z, type: 'smallbox', rot: 0, box: [x - 0.3, 0, z - 0.3, x + 0.3, 0.5, z + 0.3], appr: [x, z], owner: p.id };
  }

  function claim(room, s) {
    room.botSpots ||= [];
    room.botSpots = room.botSpots.filter((q) => q.owner !== s.owner);
    room.botSpots.push(s);
  }
  function release(room, p) {
    if (room.botSpots) room.botSpots = room.botSpots.filter((q) => q.owner !== p.id);
  }

  function hide(room, p, md, t, instant) {
    const ai = p.ai;
    ai.spot = chooseSpot(room, p, md) || fallbackSpot(p, md);
    claim(room, ai.spot);
    if (instant) return settle(room, p, md, t);
    ai.path = findPath(md.nav, ai.body.x, ai.body.z, ai.spot.appr[0], ai.spot.appr[1]);
    ai.mode = 'goHide';
    ai.wait = t + rnd(300, 1600); // un momento antes de salir corriendo
    if (!ai.path) settle(room, p, md, t);
  }

  // llega a su sitio y se disfraza
  function settle(room, p, md, t) {
    const ai = p.ai;
    const s = ai.spot;
    const size = bodySize(s.type, p.scale || 1);
    Object.assign(ai.body, { x: s.x, z: s.z, y: 0, vy: 0, r: size.r, h: size.h });
    ai.path = null;
    ai.mode = 'hidden';
    ai.nextTaunt = t + rnd(18000, 45000);
    const changed = p.prop !== s.type;
    p.prop = s.type;
    p.propRot = s.rot;
    sync(p);
    if (changed) api.disguised(room, p);
  }

  function flee(room, p, md, t, from) {
    const ai = p.ai;
    const spot = chooseSpot(room, p, md, [ai.body.x, ai.body.z], 6, 18, from);
    if (!spot) return;
    const path = findPath(md.nav, ai.body.x, ai.body.z, spot.appr[0], spot.appr[1]);
    if (!path) return;
    ai.spot = spot;
    claim(room, spot);
    ai.path = path;
    ai.mode = 'flee';
    ai.wait = t + rnd(80, 350);
    ai.stuck = 0;
  }

  function hiderUpdate(room, p, md, dt, t) {
    const ai = p.ai;
    const frozen = p.frozenUntil > t || p.stunnedUntil > t;
    if (ai.mode === 'goHide' || ai.mode === 'flee') {
      if (t < ai.wait || frozen) return;
      const fleeing = ai.mode === 'flee';
      const arrived = follow(room, p, md, (fleeing ? FLEE_SPEED : HIDE_SPEED) * (p.speed || 1), dt, t);
      if (fleeing) p.propRot = p.rot;
      if (arrived) settle(room, p, md, t);
      else if (ai.stuck >= 4) {
        if (fleeing) { ai.mode = 'hidden'; ai.path = null; } else settle(room, p, md, t);
      }
      return;
    }
    if (room.state !== 'seeking' || frozen) return;
    // ruido de vez en cuando (da puntos), salvo con un buscador encima
    if (t >= ai.nextTaunt) {
      ai.nextTaunt = t + rnd(22000, 50000);
      if (!seekerNear(room, p, 6)) api.taunt(room, p);
    }
    // si un buscador se le planta delante mirándole, a veces se pone nervioso y huye
    if (t >= ai.think) {
      ai.think = t + 400;
      for (const s of room.players.values()) {
        if (s.role !== 'seeker' || !s.alive) continue;
        const dx = p.pos[0] - s.pos[0];
        const dz = p.pos[2] - s.pos[2];
        if (Math.hypot(dx, dz) < 2.6 && Math.abs(angDiff(yawTo(dx, dz), s.rot)) < 0.5 && Math.random() < 0.04) {
          flee(room, p, md, t, [s.pos[0], s.pos[2]]);
          break;
        }
      }
    }
  }

  function seekerNear(room, p, dist) {
    for (const s of room.players.values()) {
      if (s.role === 'seeker' && s.alive && Math.hypot(s.pos[0] - p.pos[0], s.pos[2] - p.pos[2]) < dist) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ buscar
  function seekerUpdate(room, p, md, dt, t) {
    const ai = p.ai;
    if (room.state !== 'seeking') return; // con los ojos tapados
    if (p.frozenUntil > t || p.stunnedUntil > t || t < ai.wakeAt) { fall(room, p, md, dt); return; }
    const L = level(room);
    if (t >= ai.think) {
      ai.think = t + 250;
      think(room, p, md, t, L);
    }
    if (ai.mode === 'chase') chase(room, p, md, dt, t, L);
    else if (ai.mode === 'look') look(room, p, md, dt, t, L);
    else if (ai.mode === 'patrol' || ai.mode === 'investigate') {
      const arrived = follow(room, p, md, L.speed * (ai.mode === 'investigate' ? 1.05 : 0.85) * (p.speed || 1), dt, t);
      if (arrived || ai.stuck >= 4) startLook(p, t, ai.mode === 'investigate' ? rnd(1800, 2800) : rnd(1000, 2400), ai.mode === 'investigate' ? 0.85 : L.guess);
    } else startLook(p, t, 500);
  }

  // mira a su alrededor y va acumulando sospechas
  function think(room, p, md, t, L) {
    const ai = p.ai;
    const eye = [ai.body.x, ai.body.y + EYE * (p.scale || 1), ai.body.z];
    ai.vis.clear();
    let best = null;
    for (const h of room.players.values()) {
      if (h.role !== 'hider' || !h.alive || h.id === p.id) continue;
      const prev = ai.last.get(h.id);
      ai.moved.set(h.id, prev ? Math.hypot(h.pos[0] - prev[0], h.pos[2] - prev[1]) : 0);
      ai.last.set(h.id, [h.pos[0], h.pos[2]]);
      const dx = h.pos[0] - eye[0];
      const dz = h.pos[2] - eye[2];
      const dist = Math.hypot(dx, dz);
      let s = ai.susp.get(h.id) || 0;
      let visible = false;
      if (dist < L.range && (dist < 2.5 || Math.abs(angDiff(yawTo(dx, dz), p.rot)) < HALF_FOV)) {
        visible = lineOfSight(md.nav, eye, centerOf(h));
      }
      if (visible) {
        ai.vis.add(h.id);
        const near = dist < 4 ? 2.2 : dist < 9 ? 1.2 : 0.7;
        let gain = 0.01;
        if (!h.prop) gain += 0.5; // sin disfraz se le ve a la legua
        if (ai.moved.get(h.id) > 0.1) gain += 0.3; // un objeto que se mueve...
        if (h.prop && outOfPlace(md, h)) gain += 0.035; // ¿una nevera en medio del parque?
        if (t - h.lastTaunt < 3500) gain += 0.55; // acaba de hacer ruido delante de sus narices
        s += gain * near * L.see;
        if (!best || s > best.s) best = { h, s };
      } else s = Math.max(0, s - 0.015);
      ai.susp.set(h.id, s);
    }
    if (ai.target) {
      const h = room.players.get(ai.target);
      if (!h || h.role !== 'hider' || !h.alive) { ai.target = null; startLook(p, t, 1200, 0); return; }
      if (ai.vis.has(h.id)) { ai.lastSeen = [h.pos[0], h.pos[2]]; ai.lastSeenAt = t; }
      else if (t - ai.lastSeenAt > 4000) {
        // se le ha escapado: va a donde lo vio por última vez
        ai.susp.set(h.id, 0.5);
        ai.target = null;
        investigate(p, md, ai.lastSeen, t);
      }
      return;
    }
    if (best && best.s >= 1) engage(p, best.h, t, L);
  }

  function engage(p, h, t, L) {
    const ai = p.ai;
    ai.target = h.id;
    ai.mode = 'chase';
    ai.path = null;
    ai.pending = null;
    ai.lastSeen = [h.pos[0], h.pos[2]];
    ai.lastSeenAt = t;
    ai.nextShot = Math.max(ai.nextShot, t + L.react * 1000 * rnd(0.8, 1.3));
  }

  function chase(room, p, md, dt, t, L) {
    const ai = p.ai;
    const h = room.players.get(ai.target);
    if (!h || h.role !== 'hider' || !h.alive) { ai.target = null; startLook(p, t, 1200, 0); return; }
    const dx = h.pos[0] - ai.body.x;
    const dz = h.pos[2] - ai.body.z;
    const dist = Math.hypot(dx, dz);
    if (ai.vis.has(h.id) && dist < SHOOT_RANGE) {
      const want = yawTo(dx, dz);
      turnTo(p, want, dt, 10);
      ai.path = null;
      // se acerca un poco si está lejos
      if (dist > 6) {
        const sp = L.speed * 0.5 * (p.speed || 1) * dt;
        moveBody(local(md, ai.body), ai.body, (dx / dist) * sp, (dz / dist) * sp, dt, room.mods.gravity || 1);
        sync(p);
      } else fall(room, p, md, dt);
      if (t >= ai.nextShot && Math.abs(angDiff(p.rot, want)) < 0.3) fire(room, p, md, h, t, L, dist);
      return;
    }
    if (!ai.path || t >= ai.repath) {
      ai.path = findPath(md.nav, ai.body.x, ai.body.z, ai.lastSeen[0], ai.lastSeen[1]);
      ai.repath = t + 900;
    }
    const arrived = follow(room, p, md, L.speed * 1.1 * (p.speed || 1), dt, t);
    if (arrived) turnTo(p, yawTo(dx, dz), dt, 6);
  }

  function fire(room, p, md, h, t, L, dist) {
    const ai = p.ai;
    ai.nextShot = t + L.gap * 1000 * rnd(0.8, 1.3);
    const moving = (ai.moved.get(h.id) || 0) > 0.1;
    const chance = L.aim * (moving ? 0.55 : 1) * (dist > 10 ? 0.75 : dist < 4 ? 1.2 : 1);
    const hit = Math.random() < Math.min(0.95, chance);
    const from = gunPos(p);
    const c = centerOf(h);
    api.shoot(room, p, hit ? 'player' : 'none', h.id, from, hit ? c : missPoint(md, from, c));
  }

  // tras llegar a un sitio: echa un vistazo y a veces dispara a algo sospechoso
  function startLook(p, t, ms, guess = 0) {
    const ai = p.ai;
    ai.mode = 'look';
    ai.path = null;
    ai.until = t + ms;
    ai.lookYaw = p.rot + rnd(-1.8, 1.8);
    ai.lookSwitch = t + ms * rnd(0.35, 0.6);
    ai.wantGuess = Math.random() < guess ? t + rnd(300, ms * 0.8) : 0;
  }

  function look(room, p, md, dt, t, L) {
    const ai = p.ai;
    fall(room, p, md, dt);
    if (ai.pending) {
      turnTo(p, ai.pending.yaw, dt, 9);
      if (t >= ai.pending.at) {
        const s = ai.pending;
        ai.pending = null;
        if (s.kind === 'prop') api.shoot(room, p, 'prop', null, gunPos(p), s.to);
        else {
          const h = room.players.get(s.id);
          if (h && h.role === 'hider' && h.alive) {
            engage(p, h, t, L);
            ai.nextShot = 0;
            fire(room, p, md, h, t, L, Math.hypot(h.pos[0] - ai.body.x, h.pos[2] - ai.body.z));
          }
        }
      }
      return;
    }
    if (ai.wantGuess && t >= ai.wantGuess) {
      ai.wantGuess = 0;
      guess(room, p, md, t);
      if (ai.pending) return;
    }
    turnTo(p, ai.lookYaw, dt, 3);
    if (t >= ai.lookSwitch) { ai.lookYaw = p.rot + rnd(-2.2, 2.2); ai.lookSwitch = ai.until + 1; }
    if (t >= ai.until) patrol(p, md);
  }

  // «¿y si ese barril es alguien?»: elige un objeto a la vista (de verdad o disfrazado) y apunta
  function guess(room, p, md, t) {
    const ai = p.ai;
    const eye = [ai.body.x, ai.body.y + EYE, ai.body.z];
    const cands = [];
    for (const q of md.props) {
      const dx = q.x - eye[0];
      const dz = q.z - eye[2];
      const d = Math.hypot(dx, dz);
      if (d > 10 || d < 1.2 || Math.abs(angDiff(yawTo(dx, dz), p.rot)) > 1.0) continue;
      const c = [(q.box[0] + q.box[3]) / 2, (q.box[1] + q.box[4]) / 2, (q.box[2] + q.box[5]) / 2];
      const dir = [c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]];
      const enter = segBox(eye, dir, q.box);
      if (enter === null) continue;
      const to = [eye[0] + dir[0] * enter, eye[1] + dir[1] * enter, eye[2] + dir[2] * enter];
      if (!lineOfSight(md.nav, eye, to)) continue;
      cands.push({ kind: 'prop', w: 1, yaw: yawTo(dx, dz), to });
    }
    for (const id of ai.vis) {
      const h = room.players.get(id);
      if (!h) continue;
      const dx = h.pos[0] - eye[0];
      const dz = h.pos[2] - eye[2];
      if (Math.hypot(dx, dz) > 11) continue;
      cands.push({ kind: 'player', id, w: 1 + 4 * (ai.susp.get(id) || 0), yaw: yawTo(dx, dz) });
    }
    if (!cands.length) return;
    let r = Math.random() * cands.reduce((a, c) => a + c.w, 0);
    let choice = cands[0];
    for (const c of cands) { r -= c.w; if (r <= 0) { choice = c; break; } }
    ai.pending = { ...choice, at: t + rnd(350, 700) };
  }

  function patrol(p, md) {
    const ai = p.ai;
    for (let k = 0; k < 14; k++) {
      const [x, z] = pick(md.poi);
      const d = Math.hypot(x - ai.body.x, z - ai.body.z);
      if (d < 4 || d > 30) continue;
      if (ai.recent.some(([rx, rz]) => Math.hypot(rx - x, rz - z) < 5)) continue;
      const path = findPath(md.nav, ai.body.x, ai.body.z, x, z);
      if (!path) continue;
      ai.path = path;
      ai.mode = 'patrol';
      ai.stuck = 0;
      ai.recent.push([x, z]);
      if (ai.recent.length > 6) ai.recent.shift();
      return;
    }
    const [x, z] = cellCenter(md.nav, randomWalkable(md.nav));
    ai.path = findPath(md.nav, ai.body.x, ai.body.z, x, z);
    ai.mode = 'patrol';
    ai.stuck = 0;
  }

  function investigate(p, md, at, t) {
    const ai = p.ai;
    if (!at) return startLook(p, t, 1000, 0);
    ai.path = findPath(md.nav, ai.body.x, ai.body.z, at[0], at[1]);
    ai.mode = ai.path ? 'investigate' : 'look';
    ai.stuck = 0;
    if (!ai.path) startLook(p, t, 1500, 0.8);
  }

  // ------------------------------------------------------------ moverse
  // obstáculos cerca del cuerpo (las casillas gruesas ya tienen margen de sobra)
  function local(md, b) {
    const nav = md.nav;
    const i = Math.max(0, Math.min(nav.bw - 1, Math.floor((b.x - nav.x1) / 4)));
    const j = Math.max(0, Math.min(nav.bh - 1, Math.floor((b.z - nav.z1) / 4)));
    return nav.buckets[j * nav.bw + i];
  }

  function fall(room, p, md, dt) {
    const b = p.ai.body;
    if (b.onGround && b.vy === 0 && b.y === 0) return;
    moveBody(local(md, b), b, 0, 0, dt, room.mods.gravity || 1);
    sync(p);
  }

  // sigue su camino; devuelve true al llegar
  function follow(room, p, md, speed, dt, t) {
    const ai = p.ai;
    const b = ai.body;
    if (!ai.path || !ai.path.length) { fall(room, p, md, dt); return true; }
    let [wx, wz] = ai.path[0];
    let dx = wx - b.x;
    let dz = wz - b.z;
    let d = Math.hypot(dx, dz);
    while (d < 0.3) {
      ai.path.shift();
      if (!ai.path.length) { fall(room, p, md, dt); return true; }
      [wx, wz] = ai.path[0];
      dx = wx - b.x; dz = wz - b.z; d = Math.hypot(dx, dz);
    }
    const len = Math.min(d, speed * dt);
    moveBody(local(md, b), b, (dx / d) * len, (dz / d) * len, dt, room.mods.gravity || 1);
    turnTo(p, yawTo(dx, dz), dt, 8);
    sync(p);
    // ¿atascado? salta, recalcula y si no hay manera se da por vencido
    if (t >= ai.progT) {
      const moved = Math.hypot(b.x - ai.prog[0], b.z - ai.prog[1]);
      ai.stuck = moved < speed * 0.7 * 0.3 ? ai.stuck + 1 : 0;
      ai.prog = [b.x, b.z];
      ai.progT = t + 700;
      if (ai.stuck && b.onGround) b.vy = 6;
      if (ai.stuck === 2) {
        const goal = ai.path[ai.path.length - 1];
        ai.path = findPath(md.nav, b.x, b.z, goal[0], goal[1]);
      }
    }
    return false;
  }

  function turnTo(p, yaw, dt, rate) {
    const d = angDiff(yaw, p.rot);
    const max = rate * dt;
    p.rot = angDiff(p.rot + Math.max(-max, Math.min(max, d)), 0);
  }

  function gunPos(p) {
    const b = p.ai.body;
    const s = p.scale || 1;
    const fx = -Math.sin(p.rot);
    const fz = -Math.cos(p.rot);
    return [b.x + fx * 0.5 + fz * -0.25, b.y + 1.35 * s, b.z + fz * 0.5 - fx * -0.25];
  }

  function centerOf(h) {
    const hh = h.prop ? Math.min(PROPS[h.prop].size[1], 2.2) : 1.8;
    return [h.pos[0], h.pos[1] + hh * (h.scale || 1) * 0.55, h.pos[2]];
  }

  function outOfPlace(md, h) {
    const list = md.byType[h.prop];
    return !list || !list.some(([x, z]) => Math.hypot(x - h.pos[0], z - h.pos[2]) < 7);
  }

  // un fallo: el chorro pasa cerca y se estrella contra lo que haya detrás
  function missPoint(md, from, aim) {
    const off = [rnd(-1, 1), rnd(-0.5, 0.8), rnd(-1, 1)];
    const k = rnd(0.6, 1.4) / (Math.hypot(off[0], off[1], off[2]) || 1);
    const d = [(aim[0] + off[0] * k - from[0]) * 2.5, (aim[1] + off[1] * k - from[1]) * 2.5, (aim[2] + off[2] * k - from[2]) * 2.5];
    let best = 1;
    if (d[1] < 0) best = Math.min(best, -from[1] / d[1]);
    for (const c of md.nav.all) {
      const tt = segBox(from, d, c);
      if (tt !== null && tt > 0.001 && tt < best) best = tt;
    }
    return [from[0] + d[0] * best, Math.max(0, from[1] + d[1] * best), from[2] + d[2] * best];
  }

  // ------------------------------------------------------------ lo que usa el servidor
  return {
    mapData,

    // cada 66 ms mientras se esconden o buscan
    update(room, dt, t) {
      const md = mapData(room.settings.map);
      for (const p of [...room.players.values()]) {
        if (room.state !== 'hiding' && room.state !== 'seeking') return;
        if (!p.isBot || !room.players.has(p.id)) continue;
        if ((p.role !== 'hider' && p.role !== 'seeker') || !p.alive) { p.ai = null; continue; }
        if (!p.ai || p.ai.role !== p.role) init(room, p, md, t);
        const ai = p.ai;
        if (ai.teleported) {
          // el admin lo ha movido con /traer: empieza desde ahí
          ai.teleported = false;
          Object.assign(ai.body, { x: p.pos[0], y: p.pos[1], z: p.pos[2], vy: 0 });
          ai.path = null;
          if (ai.mode === 'goHide' || ai.mode === 'flee') ai.mode = 'hidden';
        }
        const size = bodySize(p.role === 'hider' ? p.prop : null, p.scale || 1);
        ai.body.r = size.r;
        ai.body.h = size.h;
        if (p.role === 'seeker') seekerUpdate(room, p, md, dt, t);
        else hiderUpdate(room, p, md, dt, t);
      }
    },

    // se acaba el tiempo de esconderse: quien no ha llegado aparece ya escondido
    seekStart(room) {
      const md = mapData(room.settings.map);
      const t = Date.now();
      for (const p of room.players.values()) {
        if (!p.isBot || !p.ai) continue;
        if (p.role === 'hider' && p.ai.mode === 'goHide') settle(room, p, md, t);
        if (p.role === 'seeker') startLook(p, t, rnd(200, 900), 0);
      }
    },

    // alguien ha hecho ruido: los bots buscadores lo oyen y van a mirar
    heard(room, who) {
      if (room.state !== 'seeking') return;
      const md = mapData(room.settings.map);
      const t = Date.now();
      for (const p of room.players.values()) {
        if (!p.isBot || p.role !== 'seeker' || !p.alive || !p.ai || p.id === who.id) continue;
        const ai = p.ai;
        const d = Math.hypot(who.pos[0] - ai.body.x, who.pos[2] - ai.body.z);
        if (d > HEAR) continue;
        ai.susp.set(who.id, (ai.susp.get(who.id) || 0) + 0.25);
        if (ai.mode === 'chase' && ai.vis.has(ai.target)) continue; // ya tiene a quien perseguir
        if (Math.random() > 1.15 - d / HEAR) continue;
        const err = d * 0.12;
        ai.target = null;
        investigate(p, md, [who.pos[0] + rnd(-err, err), who.pos[2] + rnd(-err, err)], t);
      }
    },

    // a un bot escondido le han dado: a veces aguanta quieto, a veces huye
    hurt(room, p, by) {
      if (!p.isBot || !p.ai || p.role !== 'hider' || p.ai.mode === 'flee') return;
      const chance = p.hp < 50 ? 0.85 : 0.55;
      if (Math.random() < chance) flee(room, p, mapData(room.settings.map), Date.now(), [by.pos[0], by.pos[2]]);
    },

    // el admin lo ha movido
    teleported(p) { if (p.ai) p.ai.teleported = true; },

    // nueva ronda: cada bot empieza de cero
    roundStart(room) {
      room.botSpots = [];
      for (const p of room.players.values()) if (p.isBot) p.ai = null;
    },
  };
}
