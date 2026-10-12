// Prueba automática: arranca el servidor y simula varios jugadores conectados.
// Uso: npm test
import { spawn } from 'child_process';
import { io } from 'socket.io-client';
import assert from 'assert/strict';

const PORT = 3999;
const URL = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// el sitio de quien pierde la conexión se guarda 1,5 s en las pruebas (60 s en el juego de verdad)
const GRACE = 1500;
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT, RECONNECT_GRACE_MS: GRACE }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve) => server.stdout.on('data', (d) => d.toString().includes('listo') && resolve()));

// cada cliente es como una pestaña del navegador, con su clave secreta para reconectar
function client(name, key = `clave-${name}-${Math.random().toString(36).slice(2)}`) {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  const c = { s, name, key, id: null, room: null, chat: [], fx: [], spawns: [] };
  s.on('room', (r) => { c.room = r; });
  s.on('chat', (m) => c.chat.push(m));
  s.on('fx', (e) => c.fx.push(e));
  s.on('spawn', (d) => c.spawns.push(d));
  c.emit = (ev, data) => new Promise((res) => {
    const payload = ['create', 'join', 'rejoin'].includes(ev) ? { key: c.key, ...data } : data;
    s.emit(ev, payload, (r) => { if (r?.ok && r.id) c.id = r.id; res(r); });
  });
  c.me = () => c.room.players.find((p) => p.id === c.id);
  c.player = (n) => c.room.players.find((p) => p.name === n);
  return c;
}

let failed = false;
const step = async (label, fn) => {
  try { await fn(); console.log(`  ✓ ${label}`); } catch (e) { failed = true; console.log(`  ✗ ${label}\n    ${e.message}`); }
};

try {
  const admin = client('Pablo');
  const ana = client('Ana');
  const luis = client('Luis');
  await sleep(300);

  let code;
  await step('el admin crea una sala', async () => {
    const r = await admin.emit('create', { name: 'Pablo', color: '#e74c3c' });
    assert.ok(r.ok);
    code = r.code;
    assert.match(code, /^[A-Z]{4}$/);
  });

  await step('los amigos se unen con el código', async () => {
    assert.ok((await ana.emit('join', { code, name: 'Ana' })).ok);
    assert.ok((await luis.emit('join', { code: code.toLowerCase(), name: 'Luis' })).ok);
    const bad = await luis.emit('join', { code: 'ZZZZ', name: 'X' });
    assert.equal(bad.ok, false);
    await sleep(200);
    assert.equal(admin.room.players.length, 3);
    assert.equal(admin.room.hostId, admin.id);
  });

  await step('solo el admin puede usar comandos', async () => {
    ana.s.emit('chat', '/darpuntos Ana 1000');
    await sleep(200);
    assert.equal(ana.me().score, 0);
    assert.ok(ana.chat.some((m) => m.text.includes('Solo el administrador')));
  });

  await step('el admin cambia ajustes y añade bots', async () => {
    admin.s.emit('settings', { map: 'almacen', hideTime: 5, seekTime: 60, rounds: 2, seekers: 1, infection: true });
    admin.s.emit('chat', '/bot 2');
    await sleep(200);
    assert.equal(admin.room.settings.map, 'almacen');
    assert.equal(admin.room.players.filter((p) => p.isBot).length, 2);
  });

  let seeker;
  let hiders;
  await step('empieza la partida y se reparten los roles', async () => {
    admin.s.emit('start');
    await sleep(300);
    assert.equal(admin.room.state, 'hiding');
    const roles = admin.room.players.map((p) => p.role);
    assert.equal(roles.filter((r) => r === 'seeker').length, 1);
    assert.ok(admin.room.players.filter((p) => p.isBot).every((p) => p.role === 'hider' && p.prop));
    const all = [admin, ana, luis];
    seeker = all.find((c) => c.me().role === 'seeker');
    hiders = all.filter((c) => c !== seeker);
  });

  await step('los escondidos se disfrazan', async () => {
    hiders[0].s.emit('disguise', { type: 'barrel' });
    hiders[1].s.emit('disguise', { type: 'duck' });
    await sleep(200);
    assert.equal(hiders[0].me().prop, 'barrel');
    assert.equal(hiders[1].me().prop, 'duck');
  });

  await step('el buscador no puede disparar mientras se esconden', async () => {
    seeker.s.emit('shoot', { kind: 'player', target: hiders[0].id });
    await sleep(200);
    assert.equal(seeker.player(hiders[0].name).hp, 100);
  });

  await step('pasa a la fase de búsqueda', async () => {
    await sleep(5200);
    assert.equal(admin.room.state, 'seeking');
  });

  await step('disparar a un objeto real quita vida al buscador', async () => {
    seeker.s.emit('shoot', { kind: 'prop' });
    await sleep(350);
    assert.equal(seeker.me().hp, 90);
  });

  await step('3 disparos pillan a un escondido y se convierte en buscador', async () => {
    for (let i = 0; i < 3; i++) {
      seeker.s.emit('shoot', { kind: 'player', target: hiders[0].id, from: [0, 1, 0], to: [1, 1, 1] });
      await sleep(320);
    }
    await sleep(100);
    const h = seeker.player(hiders[0].name);
    assert.equal(h.role, 'seeker');
    assert.ok(seeker.me().score >= 130, `puntos del buscador: ${seeker.me().score}`);
    assert.equal(seeker.me().catches, 1);
  });

  await step('comandos de admin: puntos, congelar, velocidad, radar, luces', async () => {
    admin.s.emit('chat', '/darpuntos Ana 250');
    admin.s.emit('chat', '/congelar Luis 10');
    admin.s.emit('chat', '/velocidad todos 2');
    admin.s.emit('chat', '/radar 3');
    admin.s.emit('chat', '/apagarluces 10');
    admin.s.emit('chat', '/tiempo +30');
    admin.s.emit('chat', '/disfrazar Bot Pepe patito');
    await sleep(300);
    assert.ok(admin.player('Ana').score >= 250);
    assert.ok(admin.player('Luis').frozenUntil > Date.now());
    assert.equal(admin.player('Ana').speed, 2);
    assert.ok(admin.room.mods.radarUntil > Date.now());
    assert.ok(admin.room.mods.lightsUntil > Date.now());
    const pepe = admin.player('Bot Pepe');
    if (pepe && pepe.role === 'hider') assert.equal(pepe.prop, 'duck');
  });

  await step('pillar a todos termina la ronda con victoria de los buscadores', async () => {
    for (const p of admin.room.players.filter((q) => q.role === 'hider' && q.alive)) admin.s.emit('chat', `/pillar ${p.name}`);
    await sleep(400);
    assert.equal(admin.room.state, 'roundEnd');
    assert.equal(admin.room.lastWinner, 'seekers');
  });

  await step('/terminar acaba la partida con ranking y ganador', async () => {
    admin.s.emit('chat', '/terminar');
    await sleep(300);
    assert.equal(admin.room.state, 'gameEnd');
    assert.ok(admin.room.ranking.length >= 3);
    const scores = admin.room.ranking.map((r) => r.score);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  });

  await step('expulsar a un jugador', async () => {
    let kicked = false;
    luis.s.on('kicked', () => { kicked = true; });
    admin.s.emit('chat', '/expulsar Luis');
    await sleep(300);
    assert.ok(kicked);
    assert.ok(!admin.player('Luis'));
  });

  let ana2;
  await step('si se le corta la conexión vuelve a su sitio con sus puntos', async () => {
    const before = admin.player('Ana');
    ana.s.disconnect();
    await sleep(250);
    assert.equal(admin.player('Ana')?.connected, false, 'se le guarda el sitio');
    ana2 = client('Ana', ana.key); // misma pestaña, conexión nueva
    const r = await ana2.emit('rejoin', { code });
    assert.ok(r.ok);
    assert.equal(r.id, before.id);
    await sleep(200);
    assert.equal(admin.player('Ana').connected, true);
    assert.equal(admin.player('Ana').score, before.score);
    // volver a pulsar "Entrar" con la misma clave no duplica al jugador
    const n = admin.room.players.length;
    assert.ok((await ana2.emit('join', { code, name: 'Ana' })).ok);
    await sleep(150);
    assert.equal(admin.room.players.length, n);
    const bad = await client('Nadie').emit('rejoin', { code, key: 'clave-que-no-existe' });
    assert.equal(bad.ok, false);
  });

  await step('salir con el botón quita al jugador al momento', async () => {
    const eva = client('Eva');
    assert.ok((await eva.emit('join', { code, name: 'Eva' })).ok);
    await sleep(150);
    assert.ok(admin.player('Eva'));
    eva.s.emit('leave');
    await sleep(200);
    assert.ok(!admin.player('Eva'));
    eva.s.disconnect();
  });

  await step('si el admin no vuelve a tiempo, otro jugador pasa a ser admin', async () => {
    const adminId = admin.id;
    admin.s.disconnect();
    await sleep(300);
    assert.equal(ana2.room.hostId, adminId, 'mientras se le espera sigue siendo admin');
    await sleep(GRACE + 600);
    assert.equal(ana2.room.hostId, ana2.id);
    assert.ok(!ana2.room.players.some((p) => p.id === adminId));
  });

  await step('quien entra mientras se esconden juega ya como escondido', async () => {
    const sara = client('Sara');
    const r = await sara.emit('create', { name: 'Sara' });
    sara.s.emit('settings', { hideTime: 30 });
    sara.s.emit('start');
    await sleep(250);
    assert.equal(sara.room.state, 'hiding');
    const marta = client('Marta');
    assert.ok((await marta.emit('join', { code: r.code, name: 'Marta' })).ok);
    await sleep(200);
    assert.equal(marta.me().role, 'hider');
    assert.equal(marta.spawns.length, 1, 'recibe dónde aparecer');
    sara.s.disconnect();
    marta.s.disconnect();
  });

  await step('enlace corto, código QR y dirección de la red local', async () => {
    const short = await fetch(`${URL}/abcd`, { redirect: 'manual' });
    assert.equal(short.status, 302);
    assert.equal(short.headers.get('location'), '/?sala=ABCD');
    const qr = await fetch(`${URL}/qr.svg?text=${encodeURIComponent('https://escondite-3d.onrender.com/ABCD')}`);
    assert.equal(qr.status, 200);
    assert.match(qr.headers.get('content-type'), /image\/svg\+xml/);
    assert.match(await qr.text(), /<svg/);
    assert.equal((await fetch(`${URL}/qr.svg?text=hola`)).status, 400);
    const lan = await (await fetch(`${URL}/api/lan`)).json();
    assert.ok(Array.isArray(lan.urls));
  });

  await step('la web y los archivos 3D se sirven', async () => {
    for (const path of ['/', '/js/main.js', '/js/game.js', '/shared/maps.js', '/vendor/three/build/three.module.js', '/health']) {
      const r = await fetch(URL + path);
      assert.equal(r.status, 200, path);
    }
  });

  ana2.s.disconnect();
  luis.s.disconnect();
} finally {
  server.kill();
}

console.log(failed ? '\nHay pruebas que fallan.' : '\nTodas las pruebas pasan ✅');
process.exit(failed ? 1 : 0);
