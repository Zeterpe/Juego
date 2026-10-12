// Interfaz, red y pegamento entre pantallas y el motor 3D.
import { MAPS, MAP_KEYS } from '/shared/maps.js';
import { Game } from './game.js';
import { Input, isTouch } from './input.js';
import { sfx, unlockAudio, setMuted, isMuted, setVolume, getVolume } from './audio.js';
import { PROPS } from '/shared/props.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#ff6b9d'];
const MAP_ICONS = { casa: ['🏠', 'linear-gradient(135deg,#6fbf5a,#c8935b)'], almacen: ['📦', 'linear-gradient(135deg,#5d6d7e,#e67e22)'], parque: ['🌳', 'linear-gradient(135deg,#58b14c,#2e86c1)'] };
const BOT_LEVELS = [['facil', '🙂 Fácil'], ['normal', '😐 Normal'], ['dificil', '😈 Difícil']];

if (isTouch) {
  document.body.classList.add('touch');
  // en el móvil la pista y el chat van en la columna de la izquierda, debajo de la vida, para no pisarse con nada
  document.querySelector('.hud-left').append($('hint'), $('chat-box'));
}

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
  onLocalHit: (from) => {
    $('hurt').classList.add('on');
    setTimeout(() => $('hurt').classList.remove('on'), 60);
    if (Array.isArray(from)) damageFrom(from);
  },
  hitMarker: (kill) => hitMarker(kill),
  caughtByMe: (e) => {
    sfx.kill();
    bigMsg(`🎯 ¡Pillado${e.name ? ': ' + e.name : ''}!`);
  },
  caughtMe: () => bigMsg('😵 ¡Te han pillado!', room?.settings?.infection ? 'Ahora eres buscador: ¡caza a los demás!' : 'Ahora miras como espectador'),
});

// ------------------------------------------------------------ ajustes guardados en este navegador
const prefs = { fov: 75, invertY: false, quality: isTouch ? 'media' : 'alta', showFps: false };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('prefs') || '{}')); } catch { /* ajustes corruptos: valores por defecto */ }
const savePrefs = () => { try { localStorage.setItem('prefs', JSON.stringify(prefs)); } catch { /* modo privado */ } };
game.applyPrefs(prefs);

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
  fillSelect($('set-bots'), BOT_LEVELS, s.botLevel || 'normal');
  $('set-infection').checked = s.infection;
  $('set-autotaunt').checked = s.autoTaunt !== false;
  for (const id of ['set-rounds', 'set-hide', 'set-seek', 'set-seekers', 'set-bots', 'set-infection', 'set-autotaunt']) $(id).disabled = !host;
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
$('set-bots').onchange = (e) => socket.emit('settings', { botLevel: e.target.value });
$('set-autotaunt').onchange = (e) => socket.emit('settings', { autoTaunt: e.target.checked });
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
  // lo mismo en la pestaña «Invitar» del menú de pausa
  $('pause-url').value = url;
  $('pause-qr').src = $('invite-qr').src;
  $('pause-whatsapp').href = $('btn-whatsapp').href;
  $('pause-share').classList.toggle('hidden', !navigator.share);
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
$('btn-invite-game').onclick = () => copyInvite($('btn-invite-game'));
$('pause-share').onclick = shareInvite;
$('pause-url').onclick = (e) => e.target.select();

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
// salir pide confirmación con un segundo toque (sin ventanas que bloqueen el juego)
let quitArmed = 0;
$('btn-quit').onclick = () => {
  if (Date.now() - quitArmed > 3000) {
    quitArmed = Date.now();
    $('btn-quit').textContent = '¿Seguro? Pulsa otra vez para salir';
    setTimeout(() => { if (Date.now() - quitArmed >= 3000) $('btn-quit').textContent = '🚪 Salir de la sala'; }, 3100);
    return;
  }
  quitArmed = 0;
  $('btn-quit').textContent = '🚪 Salir de la sala';
  $('pause').classList.add('hidden');
  leaveRoom();
};

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
  updateClickToPlay();
}
const chatOpen = () => $('chat-box').classList.contains('open');
$('game-chat-in').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeChat(); } });
$('btn-chat').onclick = () => (chatOpen() ? closeChat() : openChat());

let lastUnlock = 0;
window.addEventListener('keydown', (e) => {
  if (!inGame()) return;
  const typing = document.activeElement === $('game-chat-in');
  if (e.key === 'Escape' && !typing) {
    // con el ratón capturado el navegador usa Esc para soltarlo (y eso ya abre el menú)
    if (input.locked || performance.now() - lastUnlock < 400) return;
    e.preventDefault();
    if (!$('pause').classList.contains('hidden')) closePause(false);
    else if (anyOverlay()) { closeOverlays(); updateClickToPlay(); }
    else openPause();
  } else if (e.key === 'Enter' && !typing) { e.preventDefault(); openChat(); }
  else if (e.key === '/' && !typing && isHost()) { e.preventDefault(); openChat('/'); }
  else if (e.code === 'Tab' && !typing) { e.preventDefault(); renderScores($('score-body')); $('scoreboard').classList.remove('hidden'); }
  else if (e.code === 'KeyP' && !typing && isHost()) toggleOverlay('admin-panel');
});
window.addEventListener('keyup', (e) => { if (e.code === 'Tab') $('scoreboard').classList.add('hidden'); });

// ------------------------------------------------------------ overlays y menú de pausa
const OVERLAYS = ['admin-panel', 'pause', 'scoreboard'];
const anyOverlay = () => OVERLAYS.some((o) => !$(o).classList.contains('hidden'));
function closeOverlays() { for (const o of OVERLAYS) $(o).classList.add('hidden'); }

function toggleOverlay(id) {
  const el = $(id);
  const open = el.classList.contains('hidden');
  closeOverlays();
  if (open) {
    el.classList.remove('hidden');
    document.exitPointerLock?.();
    input.keys.clear();
    if (id === 'admin-panel') renderAdminTargets();
    if (id === 'scoreboard') renderScores($('score-body'));
  }
  updateClickToPlay();
}
document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => { $(b.dataset.close).classList.add('hidden'); updateClickToPlay(); }; });
document.querySelectorAll('.overlay').forEach((o) => o.addEventListener('click', (e) => { if (e.target === o) { o.classList.add('hidden'); updateClickToPlay(); } }));
$('btn-admin').onclick = () => toggleOverlay('admin-panel');
$('btn-menu').onclick = () => ($('pause').classList.contains('hidden') ? openPause() : closePause(false));
$('btn-scores').onclick = () => toggleOverlay('scoreboard');

function openPause(tab) {
  if (!inGame()) return;
  closeChat();
  closeOverlays();
  $('pause').classList.remove('hidden');
  document.exitPointerLock?.();
  input.keys.clear();
  input.clearPressed();
  if (tab) selectTab(tab);
  renderPause();
  updateClickToPlay();
}
function closePause(resume) {
  $('pause').classList.add('hidden');
  if (resume && !isTouch) lockPointer();
  updateClickToPlay();
}
function lockPointer() {
  try {
    const r = $('game').requestPointerLock?.();
    // justo después de soltarlo con Esc el navegador no deja capturarlo otra vez: entonces, clic para jugar
    if (r?.catch) r.catch(() => updateClickToPlay());
  } catch { updateClickToPlay(); }
}
$('btn-resume').onclick = () => closePause(true);
$('btn-pause-admin').onclick = () => { $('pause').classList.add('hidden'); toggleOverlay('admin-panel'); };

function selectTab(id) {
  document.querySelectorAll('#pause .tab').forEach((t) => t.classList.toggle('sel', t.dataset.tab === id));
  document.querySelectorAll('#pause .tab-body').forEach((b) => b.classList.toggle('hidden', b.id !== id));
  if (id === 'tab-invite' && room) renderInvite();
}
document.querySelectorAll('#pause .tab').forEach((t) => { t.onclick = () => { sfx.click(); selectTab(t.dataset.tab); }; });

const ROLE_LABEL = { hider: '🙈 Escondido', seeker: '🔫 Buscador', spectator: '👀 Espectador' };
function renderPause() {
  if (!room || $('pause').classList.contains('hidden')) return;
  const left = Math.max(0, room.endAt - game.serverNow());
  const phase = { hiding: 'Escondiéndose', seeking: 'Buscando', roundEnd: 'Fin de ronda' }[room.state] || '';
  const info = `Sala <b>${room.code}</b> · ${esc(MAPS[room.settings.map].name)} · Ronda ${room.round}/${room.settings.rounds} · ${phase} ${fmt(left)} · ${ROLE_LABEL[game.myRole()]}`;
  if ($('pause-info').innerHTML !== info) $('pause-info').innerHTML = info;
  renderScores($('pause-scores'));
  $('btn-pause-admin').classList.toggle('hidden', !isHost());
}

// ajustes
const showVal = () => {
  $('sens-val').textContent = `${(+input.sensitivity).toFixed(1)}`;
  $('vol-val').textContent = `${Math.round(getVolume() * 100)}%`;
  $('fov-val').textContent = `${prefs.fov}°`;
};
$('sens').value = input.sensitivity;
$('sens').oninput = (e) => { input.setSensitivity(parseFloat(e.target.value)); showVal(); };
$('vol').value = getVolume();
$('vol').oninput = (e) => { setVolume(parseFloat(e.target.value)); showVal(); };
$('vol').onchange = () => { unlockAudio(); sfx.click(); };
$('fov').value = prefs.fov;
$('fov').oninput = (e) => { prefs.fov = parseInt(e.target.value, 10); game.applyPrefs({ fov: prefs.fov }); savePrefs(); showVal(); };
$('quality').value = prefs.quality;
$('quality').onchange = (e) => { prefs.quality = e.target.value; game.applyPrefs({ quality: prefs.quality }); savePrefs(); };
$('mute').checked = isMuted();
$('mute').onchange = (e) => setMuted(e.target.checked);
$('invert-y').checked = prefs.invertY;
$('invert-y').onchange = (e) => { prefs.invertY = e.target.checked; game.applyPrefs({ invertY: prefs.invertY }); savePrefs(); };
$('show-fps').checked = prefs.showFps;
$('show-fps').onchange = (e) => { prefs.showFps = e.target.checked; savePrefs(); };
showVal();

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

function renderScores(tbody) {
  if (!room) return;
  const list = [...room.players].sort((a, b) => b.score - a.score);
  const html = list.map((p, i) => `<tr class="${p.id === myId ? 'me' : ''}">
    <td>${i + 1}</td>
    <td><span class="dot" style="background:${p.color}"></span>${p.isBot ? '🤖 ' : ''}${esc(p.name)}${p.id === room.hostId ? ' 👑' : ''}${p.id === myId ? ' (tú)' : ''}${p.connected === false ? ' 📶' : ''}</td>
    <td class="role-${p.role}">${roleName(p)}</td>
    <td>${p.catches}</td>
    <td><b>${p.score}</b></td></tr>`).join('');
  if (tbody.innerHTML !== html) tbody.innerHTML = html;
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
    closeOverlays();
    closeChat();
    for (const o of ['intro', 'summary', 'click-to-play']) $(o).classList.add('hidden');
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
  if (!$('scoreboard').classList.contains('hidden')) renderScores($('score-body'));
  renderPause();
  // puntos ganados o perdidos
  const before = prevRoom?.players.find((p) => p.id === myId);
  if (before && prevRoom.state !== 'lobby' && r.state !== 'lobby' && me.score !== before.score) popup(me.score - before.score);

  if (r.state === 'lobby') {
    showScreen('lobby');
    renderLobby();
    game.stop();
  } else if (r.state === 'gameEnd') {
    if (prevRoom?.state !== 'gameEnd') { showEnd(); sfx.win(); }
    else renderEndButtons();
  } else {
    showScreen('game');
    game.start();
    const changed = prevRoom?.state !== r.state;
    if (changed && r.state === 'seeking') sfx.start();
    if (r.state === 'hiding' && (changed || prevRoom?.round !== r.round)) showIntro(r, me);
    if (r.state !== 'hiding') { $('intro').classList.add('hidden'); $('hud').classList.remove('intro-on'); }
    if (r.state === 'roundEnd' && r.summary) showSummary(r, me, changed);
    else $('summary').classList.add('hidden');
    const prevMe = prevRoom?.players.find((p) => p.id === myId);
    if (prevMe && prevMe.frozenUntil < me.frozenUntil) sfx.freeze();
    updateClickToPlay();
  }
});

// Esc (o cambiar de ventana) suelta el ratón: entonces sale el menú de pausa
input.onLockChange = (locked) => {
  if (!locked) lastUnlock = performance.now();
  if (!locked && inGame() && !isTouch && !anyOverlay() && !chatOpen()) openPause();
  updateClickToPlay();
};
function updateClickToPlay() {
  const show = inGame() && !isTouch && !input.locked && !anyOverlay() && !chatOpen();
  $('click-to-play').classList.toggle('hidden', !show);
}

// ------------------------------------------------------------ inicio y fin de ronda
let introTimer = null;
function showIntro(r, me) {
  const role = game.myRole();
  const hideTime = r.settings.hideTime;
  const card = {
    hider: ['🙈', 'Eres ESCONDIDO', `Apunta a un objeto y ${isTouch ? 'toca 🎭' : 'pulsa <kbd>E</kbd>'} para convertirte en él. Escóndete junto a objetos iguales: tienes <b>${hideTime} s</b> antes de que salgan a buscarte.`],
    seeker: ['🔫', 'Eres BUSCADOR', `Espera <b>${hideTime} s</b> con los ojos tapados. Luego dispara a los objetos sospechosos… ¡pero si fallas con uno de verdad pierdes vida!`],
    spectator: ['👀', 'Miras esta ronda', me.role === 'spectator' ? 'Entrarás a jugar en la siguiente ronda.' : 'Vuela libremente por el mapa.'],
  }[role];
  $('intro-round').textContent = `Ronda ${r.round} de ${r.settings.rounds}`;
  $('intro-icon').textContent = card[0];
  $('intro-role').textContent = card[1];
  $('intro-role').className = `intro-role ${role}`;
  $('intro-text').innerHTML = card[2];
  $('intro-map').textContent = `Mapa: ${MAPS[r.settings.map].name}`;
  const el = $('intro');
  el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  $('hud').classList.add('intro-on');
  sfx.roundStart();
  clearTimeout(introTimer);
  introTimer = setTimeout(() => { el.classList.add('hidden'); $('hud').classList.remove('intro-on'); }, 5000);
}

function showSummary(r, me, fresh) {
  const s = r.summary;
  const winClass = s.winner === 'hiders' ? 'hider' : s.winner === 'seekers' ? 'seeker' : '';
  $('sum-title').textContent = s.title;
  $('sum-title').className = `sum-title ${winClass}`;
  $('sum-text').textContent = s.text;
  const who = (n, c) => `<b style="color:${c}">${esc(n)}</b>`;
  $('sum-catches').innerHTML = s.catches.length
    ? s.catches.map((c) => `<li>${c.by ? who(c.by, c.byColor) + ' → ' : ''}${who(c.name, c.color)} <small>${c.prop ? '(' + esc(PROPS[c.prop]?.name || c.prop) + ')' : '(sin disfraz)'}</small></li>`).join('')
    : '<li class="muted">Nadie</li>';
  $('sum-survivors').innerHTML = s.survivors.length
    ? s.survivors.map((p) => `<li>${who(p.name, p.color)} <small>${p.prop ? '(' + esc(PROPS[p.prop]?.name || p.prop) + ')' : ''}</small></li>`).join('')
    : '<li class="muted">Nadie</li>';
  $('sum-standings').innerHTML = s.standings.slice(0, 6).map((p) => `<li class="${p.id === myId ? 'me' : ''}">
    <span><span class="dot" style="background:${p.color}"></span>${p.isBot ? '🤖 ' : ''}${esc(p.name)}</span>
    <span><b>${p.score}</b> ${p.delta ? `<small class="${p.delta > 0 ? 'up' : 'down'}">${p.delta > 0 ? '+' : ''}${p.delta}</small>` : ''}</span></li>`).join('');
  $('summary').classList.remove('hidden');
  $('announce').classList.add('hidden');
  $('hud').classList.remove('announcing');
  if (fresh) {
    // ¿ha ganado mi equipo?
    const mine = me.role === 'seeker' ? 'seekers' : me.role === 'hider' && me.alive ? 'hiders' : null;
    if (mine && mine === s.winner) sfx.win(); else sfx.lose();
  }
}

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

// el servidor gratis de Render se duerme tras 15 min sin visitas: mientras haya alguien en una sala, lo mantenemos despierto
setInterval(() => { if (room) fetch('/health', { cache: 'no-store' }).catch(() => {}); }, 4 * 60 * 1000);

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
  if (room?.state === 'roundEnd' && !$('summary').classList.contains('hidden')) return;
  $('announce-title').textContent = title;
  $('announce-text').textContent = text || '';
  const el = $('announce');
  el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  $('hud').classList.add('announcing');
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { el.classList.add('hidden'); $('hud').classList.remove('announcing'); }, ms);
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

let lastPauseRender = 0;

// de dónde viene cada ruido: flechas alrededor de la mira
const pingEls = [];
function renderPings() {
  const now = performance.now();
  game.pings.forEach((p, i) => {
    let el = pingEls[i];
    if (!el) { el = document.createElement('div'); el.className = 'ping'; el.innerHTML = '<span>♪</span>'; $('pings').appendChild(el); pingEls[i] = el; }
    const deg = (game.angleTo(p.x, p.z) * 180) / Math.PI;
    el.style.transform = `rotate(${deg}deg)`;
    el.style.opacity = Math.min(1, (p.until - now) / 800);
    el.firstChild.style.transform = `rotate(${-deg}deg)`;
    el.classList.remove('hidden');
  });
  for (let i = game.pings.length; i < pingEls.length; i++) pingEls[i].classList.add('hidden');
}

// te han dado: marca roja hacia el que dispara
function damageFrom(from) {
  const el = document.createElement('div');
  el.className = 'dmg-arc';
  el.style.transform = `rotate(${(game.angleTo(from[0], from[2]) * 180) / Math.PI}deg)`;
  $('dmg').appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

let hitTimer = null;
function hitMarker(kill) {
  sfx.hitmark();
  const el = $('hitmarker');
  el.classList.toggle('kill', !!kill);
  el.classList.add('on');
  clearTimeout(hitTimer);
  hitTimer = setTimeout(() => el.classList.remove('on'), kill ? 400 : 180);
}

function popup(delta) {
  const el = document.createElement('div');
  el.className = `popup ${delta > 0 ? 'up' : 'down'}`;
  el.textContent = `${delta > 0 ? '+' : ''}${delta}`;
  $('popups').appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

let bigTimer = null;
function bigMsg(text, sub = '') {
  const el = $('big-msg');
  el.textContent = text;
  if (sub) {
    const s = document.createElement('small');
    s.textContent = sub;
    el.appendChild(s);
  }
  el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  $('toast').classList.add('hidden'); // en el móvil ocupan el mismo sitio
  clearTimeout(bigTimer);
  bigTimer = setTimeout(() => el.classList.add('hidden'), sub ? 2600 : 1600);
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
  const seekers = room.players.filter((p) => p.role === 'seeker').length;
  // con «los pillados buscan» los pillados dejan de ser escondidos: basta con decir cuántos quedan
  const aliveTxt = room.settings.infection ? alive : `${alive}/${hiders.length}`;
  const aliveHtml = `🙈 <span class="lbl">Escondidos: </span>${aliveTxt} · 🔫 ${seekers}`;
  if ($('alive-count').innerHTML !== aliveHtml) $('alive-count').innerHTML = aliveHtml;
  $('alive-count').classList.toggle('hidden', room.state === 'roundEnd');

  const top = [...room.players].sort((a, b) => b.score - a.score).slice(0, 5);
  const html = top.map((p, i) => `<div><span>${['🥇', '🥈', '🥉', '4.', '5.'][i]} <span style="color:${p.color}">${esc(p.name)}</span></span><b>${p.score}</b></div>`).join('');
  if ($('mini-score').innerHTML !== html) $('mini-score').innerHTML = html;

  // siguiente ronda
  if (room.state === 'roundEnd' && room.summary) {
    const txt = room.summary.last ? `Resultados finales en ${Math.max(0, sec)} s…` : `Siguiente ronda en ${Math.max(0, sec)} s…`;
    if ($('sum-next').textContent !== txt) $('sum-next').textContent = txt;
  }
  renderPings();
  if (prefs.showFps) $('fps').textContent = `${game.fps} FPS`;
  $('fps').classList.toggle('hidden', !prefs.showFps);
  if (!$('pause').classList.contains('hidden') && performance.now() - lastPauseRender > 500) { lastPauseRender = performance.now(); renderPause(); }

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
window.socket = socket;
