// Interfaz, red y pegamento entre pantallas y el motor 3D.
import { MAPS, MAP_KEYS } from '/shared/maps.js';
import { Game } from './game.js';
import { Input, isTouch } from './input.js';
import { sfx, unlockAudio, setMuted, isMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#ff6b9d'];
const MAP_ICONS = { casa: ['🏠', 'linear-gradient(135deg,#6fbf5a,#c8935b)'], almacen: ['📦', 'linear-gradient(135deg,#5d6d7e,#e67e22)'], parque: ['🌳', 'linear-gradient(135deg,#58b14c,#2e86c1)'] };

if (isTouch) document.body.classList.add('touch');

const socket = io();
const input = new Input($('game'));
let myId = null;
let room = null;
let prevRoom = null;
let myColor = localStorage.getItem('color') || COLORS[Math.floor(Math.random() * COLORS.length)];
let lastCountdown = null;

// sessionStorage es de esta pestaña: si recarga sigue siendo el mismo jugador, otra pestaña es otro jugador
const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* modo privado */ } },
  del: (k) => { try { sessionStorage.removeItem(k); } catch { /* modo privado */ } },
};
// clave secreta para recuperar tu sitio si recargas la página o se corta la conexión
const KEY = store.get('key') || [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
store.set('key', KEY);

const game = new Game($('game'), input, {
  sendState: (s) => socket.volatile.emit('state', s),
  shoot: (d) => socket.emit('shoot', d),
  disguise: (type) => socket.emit('disguise', { type }),
  taunt: () => socket.emit('taunt'),
  hint: (h) => { if ($('hint').innerHTML !== h) $('hint').innerHTML = h; },
  toast: (t, bad) => toast(t, bad),
  onLocalHit: () => { $('hurt').classList.add('on'); setTimeout(() => $('hurt').classList.remove('on'), 60); },
});

// ------------------------------------------------------------ menú
const FUN_NOUNS = ['Pingüino', 'Mapache', 'Calcetín', 'Pepino', 'Churro', 'Panda', 'Gnomo', 'Bigote', 'Pato', 'Erizo', 'Koala', 'Dragón', 'Ratón', 'Plátano', 'Fantasma', 'Cactus'];
const FUN_ADJS = ['Ninja', 'Veloz', 'Loco', 'Feliz', 'Sigiloso', 'Valiente', 'Dormilón', 'Saltarín', 'Secreto', 'Turbo', 'Molón', 'Invisible'];
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
function funName() {
  for (;;) {
    const n = `${pickOne(FUN_NOUNS)} ${pickOne(FUN_ADJS)}`;
    if (n.length <= 16) return n;
  }
}

$('in-name').value = localStorage.getItem('name') || '';
const params = new URLSearchParams(location.search);
let inviteCode = (params.get('sala') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
// si esta pestaña ya estaba en esa sala (ha recargado la página), vuelve a entrar sola
let rejoining = inviteCode.length === 4 && store.get('sala') === inviteCode;

// normal: crear o unirse · invite: llegó con un enlace de invitación · rejoin: volviendo a su partida
function menuMode(mode, code) {
  if (code) inviteCode = code;
  $('menu-status').classList.toggle('hidden', mode !== 'rejoin');
  $('menu-form').classList.toggle('hidden', mode === 'rejoin');
  $('invite-banner').classList.toggle('hidden', mode !== 'invite');
  $('menu-invite').classList.toggle('hidden', mode !== 'invite');
  $('menu-normal').classList.toggle('hidden', mode === 'invite');
  if (mode === 'invite') {
    $('invite-code').textContent = inviteCode;
    $('in-code').value = inviteCode;
    if (!$('in-name').value) $('in-name').value = funName();
  }
}
menuMode(rejoining ? 'rejoin' : inviteCode.length === 4 ? 'invite' : 'normal');
$('btn-own-room').onclick = () => {
  menuMode('normal');
  $('in-code').value = '';
  history.replaceState(null, '', '/');
};

function renderColors() {
  $('color-picker').innerHTML = COLORS.map((c) => `<button style="background:${c}" data-c="${c}" class="${c === myColor ? 'sel' : ''}" aria-label="color"></button>`).join('');
}
renderColors();
$('color-picker').addEventListener('click', (e) => {
  const c = e.target.dataset.c;
  if (!c) return;
  myColor = c;
  localStorage.setItem('color', c);
  renderColors();
});

function getName() {
  const n = $('in-name').value.trim();
  if (!n) { $('menu-error').textContent = 'Escribe tu nombre primero 😉'; $('in-name').focus(); return null; }
  localStorage.setItem('name', n);
  return n;
}

function entered(res) {
  if (!res.ok) { $('menu-error').textContent = res.error; return; }
  myId = res.id;
  store.set('sala', res.code);
  history.replaceState(null, '', `?sala=${res.code}`);
  $('menu-error').textContent = '';
}
$('btn-create').onclick = () => {
  unlockAudio();
  const name = getName();
  if (!name) return;
  socket.emit('create', { name, color: myColor, key: KEY }, entered);
};
function join(code) {
  unlockAudio();
  const name = getName();
  if (!name) return;
  if (code.length !== 4) { $('menu-error').textContent = 'El código tiene 4 letras.'; return; }
  socket.emit('join', { code, name, color: myColor, key: KEY }, entered);
}
$('btn-join').onclick = () => join($('in-code').value.trim().toUpperCase());
$('btn-enter').onclick = () => join(inviteCode);
$('in-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });
$('in-name').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (!$('menu-invite').classList.contains('hidden')) $('btn-enter').click();
  else ($('in-code').value ? $('btn-join') : $('btn-create')).click();
});

// ------------------------------------------------------------ sala de espera
const isHost = () => room && room.hostId === myId;

function fillSelect(el, options, value) {
  el.innerHTML = options.map(([v, label]) => `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${label}</option>`).join('');
}

function renderLobby() {
  $('lobby-code').textContent = room.code;
  $('lobby-count').textContent = room.players.length;
  $('lobby-players').innerHTML = room.players.map((p) => `
    <li class="${p.id === myId ? 'me' : ''} ${p.connected === false ? 'away' : ''}">
      <span class="dot" style="background:${p.color}"></span>
      <span class="name">${esc(p.name)}</span>
      ${p.id === room.hostId ? '<span class="tag">👑 Admin</span>' : ''}
      ${p.isBot ? '<span class="tag">🤖</span>' : ''}
      ${p.connected === false ? '<span class="tag">📶 reconectando…</span>' : ''}
      ${p.id === myId ? '<span class="tag">Tú</span>' : ''}
    </li>`).join('');
  const host = isHost();
  renderInvite();
  $('lobby-alone').classList.toggle('hidden', room.players.filter((p) => !p.isBot).length > 1);
  $('host-tools').classList.toggle('hidden', !host);
  $('btn-remove-bots').classList.toggle('hidden', !room.players.some((p) => p.isBot));
  $('map-cards').innerHTML = MAP_KEYS.map((k) => {
    const [icon, bg] = MAP_ICONS[k];
    return `<button class="map-card ${room.settings.map === k ? 'sel' : ''}" data-map="${k}" ${host ? '' : 'disabled'}>
      <div class="thumb" style="background:${bg}">${icon}</div><div><b>${MAPS[k].name}</b><small>${MAPS[k].desc}</small></div></button>`;
  }).join('');
  const s = room.settings;
  fillSelect($('set-rounds'), [1, 2, 3, 4, 5, 6, 8, 10].map((n) => [n, `${n}`]), s.rounds);
  fillSelect($('set-hide'), [15, 20, 30, 45, 60, 90].map((n) => [n, `${n} s`]), s.hideTime);
  fillSelect($('set-seek'), [60, 90, 120, 180, 240, 300, 420, 600].map((n) => [n, n >= 60 ? `${n / 60} min` : `${n} s`]), s.seekTime);
  fillSelect($('set-seekers'), [[0, 'Automático'], [1, '1'], [2, '2'], [3, '3'], [4, '4']], s.seekers);
  $('set-infection').checked = s.infection;
  for (const id of ['set-rounds', 'set-hide', 'set-seek', 'set-seekers', 'set-infection']) $(id).disabled = !host;
  $('btn-start').classList.toggle('hidden', !host);
  $('lobby-wait').classList.toggle('hidden', host);
}

$('map-cards').addEventListener('click', (e) => {
  const b = e.target.closest('[data-map]');
  if (b && isHost()) socket.emit('settings', { map: b.dataset.map });
});
$('set-rounds').onchange = (e) => socket.emit('settings', { rounds: e.target.value });
$('set-hide').onchange = (e) => socket.emit('settings', { hideTime: e.target.value });
$('set-seek').onchange = (e) => socket.emit('settings', { seekTime: e.target.value });
$('set-seekers').onchange = (e) => socket.emit('settings', { seekers: e.target.value });
$('set-infection').onchange = (e) => socket.emit('settings', { infection: e.target.checked });
$('btn-start').onclick = () => { unlockAudio(); socket.emit('start'); };
$('btn-add-bot').onclick = () => socket.emit('chat', '/bot 1');
$('btn-remove-bots').onclick = () => socket.emit('chat', '/quitarbots');

// ------------------------------------------------------------ invitar amigos
// enlace corto tipo https://escondite-3d.onrender.com/ABCD (el servidor lo lleva a la sala)
const onMyComputer = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
let shareBase = location.origin;
if (onMyComputer) {
  // "localhost" solo funciona en tu ordenador: para los amigos usamos la IP de tu wifi
  fetch('/api/lan').then((r) => r.json()).then(({ urls }) => {
    if (urls?.length) { shareBase = urls[0]; if (room) renderInvite(); }
  }).catch(() => {});
}
const inviteUrl = () => `${shareBase}/${room.code}`;
const inviteText = () => `¡Vente a jugar al Escondite 3D conmigo! 🙈 Entra aquí: ${inviteUrl()}`;

let invitedFor = '';
function renderInvite() {
  const url = inviteUrl();
  if (invitedFor === url) return;
  invitedFor = url;
  $('invite-url').value = url;
  $('invite-qr').src = `/qr.svg?text=${encodeURIComponent(url)}`;
  $('btn-whatsapp').href = `https://wa.me/?text=${encodeURIComponent(inviteText())}`;
  $('btn-share').classList.toggle('hidden', !navigator.share);
  let note = '';
  if (onMyComputer) {
    note = shareBase === location.origin
      ? 'Estás jugando desde tu ordenador sin conexión a una red: tus amigos no podrán entrar.'
      : 'Este enlace solo funciona con amigos conectados a tu misma wifi. Para jugar cada uno desde su casa, publica el juego en internet (mira el README).';
  }
  $('invite-note').textContent = note;
  $('invite-note').classList.toggle('hidden', !note);
}

async function copyInvite(btn) {
  const url = inviteUrl();
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // sin https el portapapeles no está disponible: probamos a la antigua o lo mostramos
    $('invite-url').select();
    if (!document.execCommand?.('copy')) { prompt('Copia este enlace y pásaselo a tus amigos:', url); return; }
  }
  const old = btn.textContent;
  btn.textContent = '✅ ¡Copiado!';
  setTimeout(() => { btn.textContent = old; }, 1500);
}
const shareInvite = () => navigator.share({ title: 'Escondite 3D', text: inviteText(), url: inviteUrl() }).catch(() => {});
$('btn-copy').onclick = () => copyInvite($('btn-copy'));
$('btn-share').onclick = shareInvite;
$('invite-url').onclick = (e) => e.target.select();
$('btn-invite-game').onclick = () => (navigator.share && isTouch ? shareInvite() : copyInvite($('btn-invite-game')));

const leaveRoom = () => {
  socket.emit('leave');
  room = null;
  myId = null;
  store.del('sala');
  history.replaceState(null, '', '/');
  menuMode('normal');
  showScreen('menu');
  game.stop();
};
$('btn-leave').onclick = leaveRoom;
$('btn-quit').onclick = () => { $('pause').classList.add('hidden'); leaveRoom(); };

// ------------------------------------------------------------ chat
function addChat(m) {
  const html = m.system
    ? `<div class="msg ${m.kind === 'admin' ? 'sys adm' : m.kind === 'win' ? 'win' : 'sys'}">${esc(m.text)}</div>`
    : `<div class="msg"><b style="color:${m.color}">${esc(m.from)}${m.team === 'hider' ? ' 🙈' : m.team === 'seeker' ? ' 🔫' : ''}:</b> ${esc(m.text)}</div>`;
  for (const id of ['lobby-chat', 'game-chat']) {
    const log = $(id);
    log.insertAdjacentHTML('beforeend', html);
    const el = log.lastElementChild;
    if (id === 'game-chat') setTimeout(() => el.classList.add('old'), m.kind === 'admin' ? 20000 : 8000);
    while (log.children.length > 80) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }
}
socket.on('chat', addChat);

function sendChat(inputEl) {
  const t = inputEl.value.trim();
  if (t) socket.emit('chat', t);
  inputEl.value = '';
}
$('lobby-chat-form').onsubmit = (e) => { e.preventDefault(); sendChat($('lobby-chat-in')); };
$('game-chat-form').onsubmit = (e) => { e.preventDefault(); sendChat($('game-chat-in')); closeChat(); };

function openChat(prefill = '') {
  $('chat-box').classList.add('open');
  $('game-chat-form').classList.remove('hidden');
  document.exitPointerLock?.();
  input.keys.clear();
  $('game-chat-in').value = prefill;
  $('game-chat-in').focus();
}
function closeChat() {
  $('chat-box').classList.remove('open');
  $('game-chat-form').classList.add('hidden');
  $('game-chat-in').blur();
}
$('game-chat-in').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeChat(); } });
$('btn-chat').onclick = () => ($('chat-box').classList.contains('open') ? closeChat() : openChat());

window.addEventListener('keydown', (e) => {
  if (!inGame()) return;
  const typing = document.activeElement === $('game-chat-in');
  if (e.key === 'Enter' && !typing) { e.preventDefault(); openChat(); }
  else if (e.key === '/' && !typing && isHost()) { e.preventDefault(); openChat('/'); }
  else if (e.code === 'Tab' && !typing) { e.preventDefault(); renderScoreboard(); $('scoreboard').classList.remove('hidden'); }
  else if (e.code === 'KeyP' && !typing && isHost()) toggleOverlay('admin-panel');
});
window.addEventListener('keyup', (e) => { if (e.code === 'Tab') $('scoreboard').classList.add('hidden'); });

// ------------------------------------------------------------ overlays
function toggleOverlay(id) {
  const el = $(id);
  const open = el.classList.contains('hidden');
  for (const o of ['admin-panel', 'pause', 'scoreboard']) $(o).classList.add('hidden');
  if (open) { el.classList.remove('hidden'); document.exitPointerLock?.(); if (id === 'admin-panel') renderAdminTargets(); if (id === 'scoreboard') renderScoreboard(); }
}
document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => $(b.dataset.close).classList.add('hidden'); });
document.querySelectorAll('.overlay').forEach((o) => o.addEventListener('click', (e) => { if (e.target === o) o.classList.add('hidden'); }));
$('btn-admin').onclick = () => toggleOverlay('admin-panel');
$('btn-menu').onclick = () => toggleOverlay('pause');
$('btn-scores').onclick = () => toggleOverlay('scoreboard');
$('sens').value = input.sensitivity;
$('sens').oninput = (e) => input.setSensitivity(parseFloat(e.target.value));
$('mute').checked = isMuted();
$('mute').onchange = (e) => setMuted(e.target.checked);

function renderAdminTargets() {
  if (!room) return;
  const cur = $('admin-target').value;
  $('admin-target').innerHTML = room.players.map((p) => `<option value="${esc(p.name)}">${p.isBot ? '🤖 ' : ''}${esc(p.name)} — ${roleName(p)}</option>`).join('');
  if (cur) $('admin-target').value = cur;
}
$('admin-panel').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.cmd) socket.emit('chat', b.dataset.cmd);
  else if (b.dataset.pcmd) {
    const name = $('admin-target').value;
    if (!name) return;
    if (b.dataset.pcmd === '/expulsar' && !confirm(`¿Expulsar a ${name}?`)) return;
    socket.emit('chat', `${b.dataset.pcmd} ${name}${b.dataset.extra ? ' ' + b.dataset.extra : ''}`);
  } else return;
  sfx.click();
});

function roleName(p) {
  if (p.role === 'seeker') return 'Buscador';
  if (p.role === 'hider') return p.alive ? 'Escondido' : 'Pillado';
  if (p.role === 'spectator') return 'Espectador';
  return 'En la sala';
}

function renderScoreboard() {
  if (!room) return;
  const list = [...room.players].sort((a, b) => b.score - a.score);
  $('score-body').innerHTML = list.map((p, i) => `<tr>
    <td>${i + 1}</td>
    <td><span class="dot" style="background:${p.color}"></span>${esc(p.name)}${p.id === room.hostId ? ' 👑' : ''}${p.id === myId ? ' (tú)' : ''}${p.connected === false ? ' 📶' : ''}</td>
    <td class="role-${p.role}">${roleName(p)}</td>
    <td>${p.catches}</td>
    <td><b>${p.score}</b></td></tr>`).join('');
}

// ------------------------------------------------------------ pantallas
function showScreen(name) {
  $('screen-menu').classList.toggle('hidden', name !== 'menu');
  $('screen-lobby').classList.toggle('hidden', name !== 'lobby');
  $('screen-end').classList.toggle('hidden', name !== 'end');
  $('hud').classList.toggle('hidden', name !== 'game');
  $('touch-zone').classList.toggle('hidden', !(name === 'game' && isTouch));
  $('touch-ui').classList.toggle('hidden', !(name === 'game' && isTouch));
  if (name !== 'game') {
    document.exitPointerLock?.();
    for (const o of ['admin-panel', 'pause', 'scoreboard']) $(o).classList.add('hidden');
  }
}
const inGame = () => room && ['hiding', 'seeking', 'roundEnd'].includes(room.state);

socket.on('room', (r) => {
  if (!myId) return;
  prevRoom = room;
  room = r;
  const me = r.players.find((p) => p.id === myId);
  if (!me) return;
  game.setRoom(r, myId);
  $('btn-admin').classList.toggle('hidden', r.hostId !== myId);
  if (!$('admin-panel').classList.contains('hidden')) renderAdminTargets();
  if (!$('scoreboard').classList.contains('hidden')) renderScoreboard();

  if (r.state === 'lobby') {
    showScreen('lobby');
    renderLobby();
    game.stop();
  } else if (r.state === 'gameEnd') {
    if (prevRoom?.state !== 'gameEnd') { showEnd(); sfx.win(); }
    else renderEndButtons();
  } else {
    const wasGame = prevRoom && ['hiding', 'seeking', 'roundEnd'].includes(prevRoom.state);
    showScreen('game');
    game.start();
    if (!wasGame && !isTouch) $('click-to-play').classList.toggle('hidden', input.locked);
    if (prevRoom?.state !== r.state && r.state === 'seeking') sfx.start();
    const prevMe = prevRoom?.players.find((p) => p.id === myId);
    if (prevMe && prevMe.frozenUntil < me.frozenUntil) sfx.freeze();
  }
});

input.onLockChange = (locked) => {
  if (inGame() && !isTouch) $('click-to-play').classList.toggle('hidden', locked);
};

socket.on('snap', (list) => game.applySnapshot(list));
socket.on('spawn', ({ pos, rot, propRot }) => game.spawn(pos, rot, propRot));
socket.on('fx', (e) => {
  game.handleFx(e);
  if (e.type === 'announce') announce(e.title, e.text, e.big ? 4000 : 3000);
  else if (e.type === 'feed') feed(`${e.icon} ${e.text}`);
});
socket.on('toast', ({ text }) => toast(text));
socket.on('forceProp', ({ prop }) => toast(`El admin te ha disfrazado de ${prop} 😂`));
socket.on('kicked', () => {
  room = null;
  myId = null;
  store.del('sala');
  menuMode('normal');
  showScreen('menu');
  game.stop();
  $('menu-error').textContent = 'Te han expulsado de la sala.';
  history.replaceState(null, '', '/');
});

// ------------------------------------------------------------ reconexión
// socket.io reconecta solo; al volver pedimos nuestro sitio con la clave de esta pestaña
socket.on('disconnect', () => { if (room) $('net-banner').classList.remove('hidden'); });
socket.on('connect', () => {
  const code = store.get('sala');
  if (!code || (!room && !rejoining)) return;
  socket.emit('rejoin', { code, key: KEY }, (res) => {
    const wasLost = !$('net-banner').classList.contains('hidden');
    $('net-banner').classList.add('hidden');
    rejoining = false;
    if (res.ok) {
      myId = res.id;
      if (wasLost) toast('¡Reconectado! 🎉');
      return;
    }
    store.del('sala');
    room = null;
    myId = null;
    game.stop();
    showScreen('menu');
    if (res.roomExists) {
      // la sala sigue, pero estuvo fuera demasiado rato: un toque y vuelve a entrar
      menuMode('invite', code);
      $('menu-error').textContent = 'Has estado fuera un buen rato. Pulsa «¡Entrar a jugar!» para volver.';
    } else {
      menuMode('normal');
      history.replaceState(null, '', '/');
      $('menu-error').textContent = 'Esa partida ya no existe (puede que el servidor se haya reiniciado). Crea una sala nueva 🙂';
    }
  });
});

// ------------------------------------------------------------ HUD
let announceTimer = null;
function announce(title, text, ms = 3000) {
  $('announce-title').textContent = title;
  $('announce-text').textContent = text || '';
  const el = $('announce');
  el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => el.classList.add('hidden'), ms);
}
function feed(text) {
  const d = document.createElement('div');
  d.textContent = text;
  $('feed').prepend(d);
  setTimeout(() => d.remove(), 6000);
  while ($('feed').children.length > 5) $('feed').lastElementChild.remove();
}
let toastTimer = null;
function toast(text, bad = false) {
  $('toast').textContent = text;
  $('toast').classList.toggle('bad', !!bad);
  $('toast').classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 2600);
}

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function hudLoop() {
  requestAnimationFrame(hudLoop);
  if (!room || !inGame()) return;
  const me = room.players.find((p) => p.id === myId);
  if (!me) return;
  const now = game.serverNow();
  const left = room.endAt - now;
  const role = game.myRole();
  const labels = { hiding: '¡A esconderse!', seeking: 'Buscando', roundEnd: 'Fin de ronda' };
  $('phase-label').textContent = labels[room.state] || '';
  $('timer').textContent = fmt(left);
  $('timer').classList.toggle('urgent', room.state !== 'roundEnd' && left < 10000);
  $('round-label').textContent = `Ronda ${room.round}/${room.settings.rounds}`;

  // cuenta atrás con pitidos
  const sec = Math.ceil(left / 1000);
  if (room.state !== 'roundEnd' && sec <= 5 && sec > 0 && sec !== lastCountdown) { lastCountdown = sec; sfx.beep(sec === 1); }
  if (sec > 5) lastCountdown = null;

  const badge = $('role-badge');
  badge.className = `badge ${role === 'spectator' ? '' : role}`;
  badge.textContent = role === 'hider' ? '🙈 Escondido' : role === 'seeker' ? '🔫 Buscador' : me.role === 'hider' ? '💀 Pillado' : '👀 Espectador';

  const blind = role === 'seeker' && room.state === 'hiding';
  $('blind').classList.toggle('hidden', !blind);
  if (blind) $('blind-timer').textContent = Math.max(0, sec);
  $('crosshair').classList.toggle('hidden', !(role === 'seeker' || role === 'hider') || blind);
  $('crosshair').classList.toggle('dot', role === 'hider');
  $('dark-vignette').classList.toggle('hidden', !((room.mods?.lightsUntil || 0) > now));
  $('hud').classList.toggle('frozen', (me.frozenUntil || 0) > now);

  const showHp = role === 'hider' || role === 'seeker';
  $('hp-wrap').classList.toggle('hidden', !showHp);
  if (showHp) {
    const hp = Math.max(0, me.hp);
    $('hp-bar').style.width = `${hp}%`;
    $('hp-bar').style.background = hp > 50 ? 'linear-gradient(90deg,#3ddc84,#a6f05a)' : hp > 25 ? 'linear-gradient(90deg,#f1c40f,#f39c12)' : 'linear-gradient(90deg,#ff4d5e,#ff7a59)';
    $('hp-text').textContent = `❤ ${hp}`;
  }
  const hiders = room.players.filter((p) => p.role === 'hider');
  const alive = hiders.filter((p) => p.alive).length;
  $('alive-count').textContent = `🙈 Escondidos: ${alive}/${hiders.length}`;

  const top = [...room.players].sort((a, b) => b.score - a.score).slice(0, 5);
  const html = top.map((p, i) => `<div><span>${['🥇', '🥈', '🥉', '4.', '5.'][i]} <span style="color:${p.color}">${esc(p.name)}</span></span><b>${p.score}</b></div>`).join('');
  if ($('mini-score').innerHTML !== html) $('mini-score').innerHTML = html;

  // botones táctiles según el rol
  if (isTouch) {
    $('btn-fire').classList.toggle('hidden', role !== 'seeker');
    for (const id of ['btn-action', 'btn-taunt', 'btn-lock', 'btn-undisguise']) $(id).classList.toggle('hidden', role !== 'hider');
  }
}
hudLoop();

// ------------------------------------------------------------ fin de partida
function showEnd() {
  showScreen('end');
  game.stop();
  const r = room.ranking || [];
  const order = [r[1], r[0], r[2]];
  const cls = ['p2', 'p1', 'p3'];
  const medal = ['2', '1', '3'];
  $('podium').innerHTML = order.map((p, i) => (p ? `<div class="step ${cls[i]}">
    <div class="avatar" style="background:${p.color}">${i === 1 ? '👑' : ''}</div>
    <div class="pname">${esc(p.name)}</div><div class="pscore">${p.score} pts · ${p.catches} pillados</div>
    <div class="block">${medal[i]}</div></div>` : '<div class="step"></div>')).join('');
  $('end-rest').innerHTML = r.slice(3).map((p) => `<li><b style="color:${p.color}">${esc(p.name)}</b> — ${p.score} pts</li>`).join('');
  document.querySelector('.win-title').textContent = r[0] ? `🏆 ¡${r[0].name} gana!` : '🏆 Fin de la partida';
  renderEndButtons();
  confetti();
}
function renderEndButtons() {
  const host = isHost();
  $('btn-again').classList.toggle('hidden', !host);
  $('btn-to-lobby').classList.toggle('hidden', !host);
  $('end-wait').classList.toggle('hidden', host);
}
$('btn-again').onclick = () => socket.emit('start');
$('btn-to-lobby').onclick = () => socket.emit('backToLobby');

function confetti() {
  const box = $('confetti');
  box.innerHTML = '';
  const colors = ['#ffcc33', '#ff5e7e', '#4fa3ff', '#3ddc84', '#b06bff'];
  for (let i = 0; i < 120; i++) {
    const c = document.createElement('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = `${2.5 + Math.random() * 3}s`;
    c.style.animationDelay = `${Math.random() * 2}s`;
    box.appendChild(c);
  }
}

// acceso para depurar desde la consola del navegador
window.game = game;
