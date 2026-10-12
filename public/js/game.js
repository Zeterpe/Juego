// Motor 3D del juego: escena, mapa, jugadores, cámara, disparos y efectos.
import * as THREE from 'three';
import { MAPS } from '/shared/maps.js';
import { PROPS, propFootprint } from '/shared/props.js';
import { buildColliders, moveBody, collidesAny, bodyBox, findFreeSpot } from '/shared/physics.js';
import { buildProp, buildCharacter, buildViewGun, mat } from './models.js';
import { sfx } from './audio.js';
import { isTouch } from './input.js';

const EYE = 1.6;
const CHAR_R = 0.35;
const CHAR_H = 1.8;
const DISGUISE_RANGE = 4.5;
const SHOOT_RANGE = 60;

export class Game {
  constructor(canvas, input, net) {
    this.canvas = canvas;
    this.input = input;
    this.net = net; // { sendState, shoot, disguise, taunt, hint, toast, onLocalHit }
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 400);
    this.scene.add(this.camera);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x556644, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.flashlight = new THREE.SpotLight(0xfff4d6, 0, 35, Math.PI / 7, 0.4, 1.2);
    this.flashlight.position.set(0, 0, 0);
    this.camera.add(this.flashlight);
    this.flashlight.target.position.set(0, 0, -1);
    this.camera.add(this.flashlight.target);

    this.partyLights = [0xff3366, 0x33ff99, 0x3399ff, 0xffcc00].map((c) => {
      const l = new THREE.PointLight(c, 0, 30, 1.5);
      this.scene.add(l);
      return l;
    });

    this.viewGun = buildViewGun();
    this.viewGun.position.set(0.3, -0.27, -0.55);
    this.viewGun.scale.setScalar(0.75);
    this.camera.add(this.viewGun);
    this.viewGun.visible = false;

    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);
    this.fxGroup = new THREE.Group();
    this.scene.add(this.fxGroup);

    this.raycaster = new THREE.Raycaster();
    this.remotes = new Map();
    this.effects = [];
    this.mapId = null;
    this.colliders = [];
    this.propMeshes = [];
    this.staticMeshes = [];

    this.me = { x: 0, y: 0, z: 0, vy: 0, r: CHAR_R, h: CHAR_H, onGround: true };
    this.yaw = 0;
    this.pitch = 0;
    this.propRot = 0;
    this.rotLocked = false;
    this.localModel = null;
    this.localModelKey = '';
    this.myId = null;
    this.room = null;
    this.myInfo = null;
    this.clockOffset = 0;
    this.lastSend = 0;
    this.lastFire = 0;
    this.running = false;
    this.camDist = 4;
    this.aimTarget = null;
    this.hitFlash = 0;
    this.lastRadarState = false;

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  serverNow() { return Date.now() + this.clockOffset; }

  // ------------------------------------------------------------ mapa
  loadMap(id) {
    if (this.mapId === id) return;
    this.mapId = id;
    const map = MAPS[id];
    this.map = map;
    this.mapGroup.clear();
    this.propMeshes = [];
    this.staticMeshes = [];
    this.colliders = buildColliders(map);

    const [bx1, bz1, bx2, bz2] = map.bounds;
    const cx = (bx1 + bx2) / 2;
    const cz = (bz1 + bz2) / 2;
    const size = Math.max(bx2 - bx1, bz2 - bz1);

    this.scene.background = new THREE.Color(map.sky);
    this.scene.fog = new THREE.Fog(map.sky, size * 0.9, size * 2.6);
    this.baseSky = new THREE.Color(map.sky);

    // suelo
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size * 4, size * 4), mat(map.ground));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cx, 0, cz);
    ground.receiveShadow = true;
    ground.userData.kind = 'static';
    this.mapGroup.add(ground);
    this.staticMeshes.push(ground);

    // geometría fija
    for (const s of map.statics) {
      let m;
      if (s.box) {
        const [x1, y1, z1, x2, y2, z2] = s.box;
        m = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, Math.max(0.01, y2 - y1), z2 - z1), mat(s.color));
        m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      } else if (s.cyl) {
        const [x, z, r, y1, y2] = s.cyl;
        m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y2 - y1, 24), mat(s.color));
        m.position.set(x, (y1 + y2) / 2, z);
      }
      if (!m) continue;
      m.castShadow = !s.floor;
      m.receiveShadow = true;
      m.userData.kind = 'static';
      this.mapGroup.add(m);
      this.staticMeshes.push(m);
    }
    // fuente: agua
    if (id === 'parque') {
      const water = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.05, 24), mat('#5dade2', { transparent: true, opacity: 0.85 }));
      water.position.set(0, 0.55, 0);
      this.mapGroup.add(water);
    }

    // objetos-disfraz
    for (const p of map.props) {
      const g = buildProp(p.t);
      g.position.set(p.p[0], p.p[1], p.p[2]);
      g.rotation.y = p.r;
      g.traverse((o) => { if (o.isMesh) { o.userData.kind = 'prop'; o.userData.propType = p.t; this.propMeshes.push(o); } });
      this.mapGroup.add(g);
    }

    // sol y sombras ajustados al tamaño del mapa
    this.sun.position.set(cx + size * 0.35, size * 0.8, cz + size * 0.25);
    this.sun.target.position.set(cx, 0, cz);
    const sc = this.sun.shadow.camera;
    sc.left = -size * 0.75; sc.right = size * 0.75; sc.top = size * 0.75; sc.bottom = -size * 0.75;
    sc.near = 1; sc.far = size * 3;
    sc.updateProjectionMatrix();
    this.hemi.intensity = map.indoor ? 1.25 : 1.1;
    this.sun.intensity = map.indoor ? 1.0 : 1.6;
    this.baseHemi = this.hemi.intensity;
    this.baseSun = this.sun.intensity;
  }

  // ------------------------------------------------------------ estado de la sala
  setRoom(room, myId) {
    this.room = room;
    this.myId = myId;
    this.clockOffset = room.serverNow - Date.now();
    this.loadMap(room.settings.map);
    const ids = new Set(room.players.map((p) => p.id));
    for (const [id, r] of this.remotes) {
      if (!ids.has(id)) { this.scene.remove(r.group); this.remotes.delete(id); }
    }
    this.byId = new Map(room.players.map((p) => [p.id, p]));
    this.myInfo = this.byId.get(myId);
    for (const p of room.players) {
      if (p.id === myId) continue;
      let r = this.remotes.get(p.id);
      if (!r) {
        r = { group: new THREE.Group(), modelKey: '', tag: null, target: null, pos: new THREE.Vector3(), rot: 0, propRot: 0 };
        this.scene.add(r.group);
        this.remotes.set(p.id, r);
      }
      r.info = p;
      this.refreshRemoteModel(r);
    }
    this.refreshLocalModel();
  }

  myRole() {
    if (!this.myInfo) return 'spectator';
    const { role, alive } = this.myInfo;
    if ((role === 'hider' || role === 'seeker') && alive) return role;
    return 'spectator';
  }

  bodySize(prop, scale = 1) {
    if (!prop) return { r: CHAR_R * scale, h: CHAR_H * scale };
    const [w, h, d] = propFootprint(prop, 0);
    return { r: Math.max(0.15, Math.min(0.6, Math.min(w, d) / 2)) * scale, h: Math.max(0.3, Math.min(h, 2.2)) * scale };
  }

  refreshLocalModel() {
    const info = this.myInfo;
    const role = this.myRole();
    const playing = this.room && (this.room.state === 'hiding' || this.room.state === 'seeking' || this.room.state === 'roundEnd');
    if (role !== this.lastRole) {
      if (role === 'spectator' && this.lastRole) { this.me.y = Math.max(this.me.y + 3, 4); }
      this.lastRole = role;
    }
    const key = playing ? `${role}|${info?.prop || ''}|${info?.color}|${info?.scale}` : 'none';
    // tamaño del cuerpo
    const size = this.bodySize(role === 'hider' ? info?.prop : null, info?.scale || 1);
    if (size.r !== this.me.r || size.h !== this.me.h) {
      const box = bodyBox(this.me.x, this.me.y + 0.01, this.me.z, size.r, size.h);
      if (collidesAny(this.colliders, box)) {
        const [nx, nz] = findFreeSpot(this.colliders, this.me.x, this.me.z, size.r, size.h);
        this.me.x = nx; this.me.z = nz;
      }
      this.me.r = size.r; this.me.h = size.h;
    }
    if (key === this.localModelKey) return;
    this.localModelKey = key;
    if (this.localModel) this.scene.remove(this.localModel);
    this.localModel = null;
    if (!playing || role === 'spectator') return;
    this.localModel = role === 'hider' && info.prop ? buildProp(info.prop) : buildCharacter(info.color, role === 'seeker');
    this.localModel.scale.setScalar(info.scale || 1);
    this.scene.add(this.localModel);
  }

  refreshRemoteModel(r) {
    const p = r.info;
    const playing = this.room.state === 'hiding' || this.room.state === 'seeking' || this.room.state === 'roundEnd';
    const visible = playing && (p.role === 'hider' || p.role === 'seeker') && p.alive;
    const key = visible ? `${p.role}|${p.prop || ''}|${p.color}|${p.scale}` : 'none';
    if (key !== r.modelKey) {
      r.modelKey = key;
      r.group.clear();
      r.model = null;
      r.tag = null;
      r.ice = null;
      r.frozenShown = false;
      if (visible) {
        r.model = p.role === 'hider' && p.prop ? buildProp(p.prop) : buildCharacter(p.color, p.role === 'seeker');
        r.model.scale.setScalar(p.scale || 1);
        r.model.traverse((o) => { if (o.isMesh) o.userData.playerId = p.id; });
        r.group.add(r.model);
        r.tag = makeTag(p.name, p.color);
        r.tag.position.y = (p.role === 'hider' && p.prop ? PROPS[p.prop].size[1] : CHAR_H) * (p.scale || 1) + 0.45;
        r.group.add(r.tag);
        r.marker = makeMarker();
        r.marker.position.y = r.tag.position.y + 0.5;
        r.marker.visible = false;
        r.group.add(r.marker);
      }
    }
    r.group.visible = visible;
  }

  // posiciones recibidas del servidor
  applySnapshot(list) {
    for (const [id, x, y, z, rot, , pr] of list) {
      if (id === this.myId) continue;
      const r = this.remotes.get(id);
      if (!r) continue;
      if (!r.target) { r.pos.set(x, y, z); r.rot = rot; r.propRot = pr; }
      r.target = { x, y, z, rot, pr };
    }
  }

  spawn(pos, rot, propRot) {
    this.me.x = pos[0]; this.me.y = pos[1]; this.me.z = pos[2]; this.me.vy = 0;
    if (rot !== undefined) { this.yaw = rot; this.propRot = rot; }
    if (propRot !== undefined) this.propRot = propRot;
    this.pitch = 0;
    this.rotLocked = false;
  }

  // ------------------------------------------------------------ bucle
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.update(dt, t / 1000);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }

  update(dt, time) {
    if (!this.room || !this.map) return;
    const role = this.myRole();
    const now = this.serverNow();
    const info = this.myInfo || {};
    const state = this.room.state;
    const blind = role === 'seeker' && state === 'hiding';
    const frozen = (info.frozenUntil || 0) > now || (info.stunnedUntil || 0) > now || blind || state === 'roundEnd';
    const gravity = this.room.mods?.gravity || 1;

    // mirar
    const [lx, ly] = this.input.consumeLook();
    this.yaw -= lx;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - ly));
    if (role === 'hider' && !this.rotLocked) this.propRot = this.yaw;

    // movimiento
    const mv = this.input.move();
    const speedMul = (info.speed || 1) * (this.input.sprint() ? 1.45 : 1);
    if (role === 'spectator') {
      const sp = 12 * dt * (this.input.sprint() ? 2 : 1);
      const fwd = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      this.me.x += (fwd.x * mv.y + right.x * mv.x) * sp;
      this.me.y += (fwd.y * mv.y) * sp;
      this.me.z += (fwd.z * mv.y + right.z * mv.x) * sp;
      if (this.input.keys.has('Space')) this.me.y += sp;
      if (this.input.down()) this.me.y -= sp;
      this.me.y = Math.max(0.5, Math.min(40, this.me.y));
      this.input.take('jump');
    } else if (state !== 'lobby' && state !== 'gameEnd') {
      const base = role === 'seeker' ? 5.2 : 5.6;
      const sp = frozen ? 0 : base * speedMul * dt;
      const dx = (Math.cos(this.yaw) * mv.x - Math.sin(this.yaw) * mv.y) * sp;
      const dz = (-Math.sin(this.yaw) * mv.x - Math.cos(this.yaw) * mv.y) * sp;
      if (this.input.take('jump') && this.me.onGround && !frozen) this.me.vy = 7.2 * Math.sqrt(1 / Math.max(0.3, gravity)) * Math.min(1.3, Math.max(0.8, info.scale || 1));
      moveBody(this.colliders, this.me, dx, dz, dt, gravity);
      if (this.me.y < -5) this.me.y = 1;
    }

    // acciones
    this.aimTarget = null;
    if (role === 'hider' && (state === 'hiding' || state === 'seeking')) {
      this.updateHiderAim();
      if (this.input.take('action') && this.aimTarget) this.tryDisguise(this.aimTarget.type);
      if (this.input.take('undisguise') && info.prop) this.net.disguise(null);
      if (this.input.take('lock')) { this.rotLocked = !this.rotLocked; this.net.toast(this.rotLocked ? 'Rotación bloqueada: puedes mirar alrededor sin girar el objeto' : 'Rotación desbloqueada'); }
      if (this.input.take('taunt')) this.net.taunt();
      this.input.take('fire');
    } else if (role === 'seeker' && state === 'seeking') {
      const wantFire = this.input.take('fire') || this.input.firing();
      if (wantFire && !frozen && performance.now() - this.lastFire > 300) {
        this.lastFire = performance.now();
        this.fire();
      }
      this.input.take('action'); this.input.take('taunt'); this.input.take('lock'); this.input.take('undisguise');
    } else {
      this.input.clearPressed();
    }
    this.updateHint(role, state, info, frozen);

    // cámara
    this.updateCamera(role, dt);

    // modelo local
    if (this.localModel) {
      this.localModel.position.set(this.me.x, this.me.y, this.me.z);
      this.localModel.rotation.y = role === 'hider' && info.prop ? this.propRot : this.yaw + Math.PI;
      this.localModel.visible = role !== 'seeker';
      if (this.localModel.visible && role === 'hider' && !info.prop) bob(this.localModel, mv, time);
    }
    this.viewGun.visible = role === 'seeker' && (state === 'seeking' || state === 'hiding');
    if (this.viewGun.visible) {
      const moving = Math.hypot(mv.x, mv.y) > 0.1 && this.me.onGround;
      this.viewGun.position.y = -0.27 + (moving ? Math.sin(time * 10) * 0.012 : 0);
      this.viewGun.position.z = THREE.MathUtils.lerp(this.viewGun.position.z, -0.55, 0.2);
    }

    // jugadores remotos
    const radar = role === 'seeker' && (this.room.mods?.radarUntil || 0) > now;
    const seeAllTags = role !== 'seeker';
    for (const r of this.remotes.values()) {
      if (!r.target || !r.model) continue;
      const k = Math.min(1, dt * 14);
      r.pos.x += (r.target.x - r.pos.x) * k;
      r.pos.y += (r.target.y - r.pos.y) * k;
      r.pos.z += (r.target.z - r.pos.z) * k;
      r.rot = lerpAngle(r.rot, r.target.rot, k);
      r.propRot = lerpAngle(r.propRot, r.target.pr, k);
      r.group.position.copy(r.pos);
      const p = r.info;
      r.model.rotation.y = p.role === 'hider' && p.prop ? r.propRot : r.rot + Math.PI;
      if (r.tag) r.tag.visible = seeAllTags || p.role === 'seeker';
      if (r.marker) r.marker.visible = radar && p.role === 'hider';
      if (p.role === 'seeker' || (p.role === 'hider' && !p.prop)) {
        const moving = Math.abs(r.target.x - r.pos.x) + Math.abs(r.target.z - r.pos.z) > 0.02;
        bob(r.model, { x: 0, y: moving ? 1 : 0 }, time + r.pos.x);
      }
      // congelados en azul
      const fz = (p.frozenUntil || 0) > now;
      if (fz !== r.frozenShown) {
        r.frozenShown = fz;
        if (fz) { r.ice = makeIce(r.model); r.group.add(r.ice); } else if (r.ice) { r.group.remove(r.ice); r.ice = null; }
      }
    }

    // luces: apagón y fiesta
    const dark = (this.room.mods?.lightsUntil || 0) > now;
    const party = (this.room.mods?.partyUntil || 0) > now;
    const targetHemi = dark ? 0.08 : party ? 0.35 : this.baseHemi;
    const targetSun = dark ? 0.0 : party ? 0.3 : this.baseSun;
    this.hemi.intensity += (targetHemi - this.hemi.intensity) * Math.min(1, dt * 3);
    this.sun.intensity += (targetSun - this.sun.intensity) * Math.min(1, dt * 3);
    const skyTarget = dark ? new THREE.Color('#05070d') : party ? new THREE.Color().setHSL((time * 0.2) % 1, 0.6, 0.15) : this.baseSky;
    this.scene.background.lerp(skyTarget, Math.min(1, dt * 3));
    this.scene.fog.color.copy(this.scene.background);
    this.flashlight.intensity = dark && (role === 'seeker') ? 60 : dark ? 6 : 0;
    this.flashlight.angle = role === 'seeker' ? Math.PI / 7 : Math.PI / 3;
    const [bx1, bz1, bx2, bz2] = this.map.bounds;
    this.partyLights.forEach((l, i) => {
      l.intensity = party ? 80 : 0;
      if (party) {
        const a = time * 1.3 + (i * Math.PI) / 2;
        l.position.set((bx1 + bx2) / 2 + Math.cos(a) * (bx2 - bx1) * 0.3, 4, (bz1 + bz2) / 2 + Math.sin(a) * (bz2 - bz1) * 0.3);
      }
    });

    // efectos temporales
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      e.update?.(e, dt);
      if (e.t >= e.life) { this.fxGroup.remove(e.obj); this.effects.splice(i, 1); }
    }

    // enviar mi estado
    if (performance.now() - this.lastSend > 66 && (state === 'hiding' || state === 'seeking' || state === 'roundEnd')) {
      this.lastSend = performance.now();
      this.net.sendState({ p: [round(this.me.x), round(this.me.y), round(this.me.z)], r: round(this.yaw), pi: round(this.pitch), pr: round(this.propRot) });
    }
  }

  updateCamera(role, dt) {
    const info = this.myInfo || {};
    const scale = info.scale || 1;
    if (role === 'seeker') {
      this.camera.position.set(this.me.x, this.me.y + EYE * scale, this.me.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.camera.fov = 75;
    } else if (role === 'hider') {
      const h = this.me.h;
      const target = new THREE.Vector3(this.me.x, this.me.y + Math.max(0.6, h * 0.8), this.me.z);
      const want = 2.4 + h * 1.2;
      const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      // que la cámara no atraviese paredes
      let dist = want;
      for (const c of this.colliders) {
        const t = rayBox(target, dir, c);
        if (t !== null && t < dist) dist = Math.max(0.4, t - 0.2);
      }
      this.camDist += (dist - this.camDist) * Math.min(1, dt * (dist < this.camDist ? 20 : 4));
      const pos = target.clone().addScaledVector(dir, this.camDist);
      if (pos.y < 0.2) pos.y = 0.2;
      this.camera.position.copy(pos);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.camera.fov = 72;
    } else {
      this.camera.position.set(this.me.x, this.me.y, this.me.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.camera.fov = 72;
    }
    this.camera.updateProjectionMatrix();
  }

  updateHiderAim() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 30;
    const hits = this.raycaster.intersectObjects([...this.propMeshes, ...this.staticMeshes, ...this.remoteMeshes()], false);
    for (const h of hits) {
      if (h.object.userData.kind === 'static') return;
      const type = h.object.userData.kind === 'prop' ? h.object.userData.propType : this.disguiseOfMesh(h.object);
      if (!type) continue;
      const d = Math.hypot(h.point.x - this.me.x, h.point.z - this.me.z);
      if (d > DISGUISE_RANGE) return;
      this.aimTarget = { type, point: h.point };
      return;
    }
  }

  disguiseOfMesh(mesh) {
    const id = mesh.userData.playerId;
    const p = id && this.byId?.get(id);
    return p && p.role === 'hider' && p.prop ? p.prop : null;
  }

  remoteMeshes() {
    const out = [];
    for (const r of this.remotes.values()) {
      if (!r.model || !r.group.visible) continue;
      r.model.traverse((o) => { if (o.isMesh) out.push(o); });
    }
    return out;
  }

  tryDisguise(type) {
    if (this.myInfo?.prop === type) return;
    const size = this.bodySize(type, this.myInfo?.scale || 1);
    const box = bodyBox(this.me.x, this.me.y + 0.01, this.me.z, size.r, size.h);
    if (collidesAny(this.colliders, box)) {
      const [nx, nz] = findFreeSpot(this.colliders, this.me.x, this.me.z, size.r, size.h);
      if (collidesAny(this.colliders, bodyBox(nx, this.me.y + 0.01, nz, size.r, size.h))) {
        this.net.toast('Aquí no cabe ese objeto, apártate un poco');
        return;
      }
    }
    sfx.disguise();
    this.puff(new THREE.Vector3(this.me.x, this.me.y + 0.5, this.me.z), '#ffffff');
    this.net.disguise(type);
  }

  fire() {
    sfx.shoot();
    this.viewGun.position.z = -0.47;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = SHOOT_RANGE;
    const hits = this.raycaster.intersectObjects([...this.remoteMeshes(), ...this.propMeshes, ...this.staticMeshes], false);
    const from = this.camera.localToWorld(new THREE.Vector3(0.28, -0.2, -0.8));
    let to = this.raycaster.ray.origin.clone().addScaledVector(this.raycaster.ray.direction, SHOOT_RANGE);
    let kind = 'none';
    let target = null;
    for (const h of hits) {
      const pid = h.object.userData.playerId;
      if (pid) {
        const p = this.byId.get(pid);
        if (p && p.role === 'seeker') continue; // atraviesa a compañeros
        to = h.point;
        if (p && p.role === 'hider' && p.alive) { kind = 'player'; target = pid; }
        break;
      }
      to = h.point;
      if (h.object.userData.kind === 'prop') kind = 'prop';
      break;
    }
    this.tracer(from, to, this.myInfo?.color || '#3498db');
    this.splash(to);
    if (kind === 'player') sfx.hit();
    else if (kind === 'prop') { sfx.wrong(); this.net.toast('¡Era un objeto de verdad! -10 de vida', true); }
    this.net.shoot({ kind, target, from: vec(from), to: vec(to) });
  }

  updateHint(role, state, info, frozen) {
    const now = this.serverNow();
    let hint = '';
    if (state === 'lobby' || state === 'gameEnd') hint = '';
    else if ((info.frozenUntil || 0) > now) hint = '🧊 ¡Estás congelado!';
    else if ((info.stunnedUntil || 0) > now) hint = '💫 Estás mareado...';
    else if (role === 'hider') {
      if (this.aimTarget && this.aimTarget.type !== info.prop) hint = `<b>${isTouch ? 'Toca 🎭' : 'E / clic derecho'}</b> → disfrazarte de <b>${PROPS[this.aimTarget.type].name}</b>`;
      else if (!info.prop) hint = 'Apunta a un objeto cercano para disfrazarte de él';
      else hint = `Eres: <b>${PROPS[info.prop].name}</b> · ${this.rotLocked ? '🔒' : ''} R bloquear giro · T hacer ruido (+15) · Q quitar disfraz`;
    } else if (role === 'seeker') {
      if (state === 'hiding') hint = '';
      else hint = 'Dispara a los objetos sospechosos. ¡Cuidado, fallar con un objeto real te quita vida!';
    } else if (state === 'hiding' || state === 'seeking') hint = 'Modo espectador: vuela libremente (Espacio sube, C baja)';
    if (frozen && !hint) hint = '';
    this.net.hint(hint);
  }

  // ------------------------------------------------------------ efectos
  handleFx(e) {
    const role = this.myRole();
    if (e.type === 'tracer') {
      this.tracer(arr(e.from), arr(e.to), e.color);
      this.splash(arr(e.to));
      const d = Math.hypot(e.from[0] - this.me.x, e.from[2] - this.me.z);
      sfx.shootFar(Math.max(0.05, 1 - d / 40));
    } else if (e.type === 'hit') {
      const r = this.remotes.get(e.id);
      if (e.id === this.myId) { sfx.hurt(); this.net.onLocalHit(); }
      else if (r) flashModel(r.model);
    } else if (e.type === 'taunt') {
      const pos = e.id === this.myId ? new THREE.Vector3(this.me.x, this.me.y, this.me.z) : this.remotes.get(e.id)?.pos || arr(e.pos);
      const d = Math.hypot(pos.x - this.me.x, pos.z - this.me.z);
      sfx.taunt(e.sound, 1 - d / 45);
      this.note(pos);
    } else if (e.type === 'caught') {
      const pos = e.id === this.myId ? new THREE.Vector3(this.me.x, this.me.y, this.me.z) : this.remotes.get(e.id)?.pos || arr(e.pos);
      sfx.caught();
      this.confetti(pos.clone().add(new THREE.Vector3(0, 0.6, 0)));
    } else if (e.type === 'radar' && role === 'seeker') {
      sfx.beep(true);
    }
  }

  tracer(from, to, color) {
    const g = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    this.fxGroup.add(line);
    this.effects.push({ obj: line, t: 0, life: 0.15, update: (e) => { line.material.opacity = 0.9 * (1 - e.t / e.life); } });
  }

  particles(pos, colors, count, speed, life, gravity = 9, size = 0.08) {
    const group = new THREE.Group();
    const parts = [];
    const geom = new THREE.BoxGeometry(size, size, size);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true }));
      m.position.copy(pos);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5 + 0.3, (Math.random() - 0.5) * 2).multiplyScalar(speed);
      parts.push({ m, v });
      group.add(m);
    }
    this.fxGroup.add(group);
    this.effects.push({
      obj: group, t: 0, life,
      update: (e, dt) => {
        for (const p of parts) {
          p.v.y -= gravity * dt;
          p.m.position.addScaledVector(p.v, dt);
          p.m.rotation.x += dt * 5;
          p.m.material.opacity = 1 - e.t / e.life;
        }
      },
    });
  }

  splash(pos) { this.particles(pos, ['#5dade2', '#aed6f1', '#ffffff'], 8, 2, 0.4, 9, 0.06); }
  puff(pos, color) { this.particles(pos, [color, '#dddddd'], 14, 2.5, 0.5, 2, 0.15); }
  confetti(pos) { this.particles(pos, ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'], 40, 4, 1.4, 6, 0.1); }

  note(pos) {
    const s = makeTag('♪ ♫', '#f1c40f', 64);
    s.position.copy(pos).add(new THREE.Vector3(0, 1.5, 0));
    this.fxGroup.add(s);
    this.effects.push({ obj: s, t: 0, life: 2, update: (e, dt) => { s.position.y += dt * 0.8; s.material.opacity = 1 - e.t / e.life; } });
  }
}

// ------------------------------------------------------------ utilidades
const round = (v) => Math.round(v * 100) / 100;
const vec = (v) => [round(v.x), round(v.y), round(v.z)];
const arr = (a) => new THREE.Vector3(a[0], a[1], a[2]);

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function bob(model, mv, time) {
  const moving = Math.hypot(mv.x, mv.y) > 0.1;
  const target = moving ? Math.abs(Math.sin(time * 11)) * 0.08 : 0;
  model.children.forEach((c) => {
    if (c.userData.baseY === undefined) c.userData.baseY = c.position.y;
    c.position.y = c.userData.baseY + target;
  });
  model.rotation.z = moving ? Math.sin(time * 11) * 0.05 : 0;
}

function rayBox(o, d, b) {
  let tmin = 0;
  let tmax = Infinity;
  const os = [o.x, o.y, o.z];
  const ds = [d.x, d.y, d.z];
  for (let i = 0; i < 3; i++) {
    const lo = b[i];
    const hi = b[i + 3];
    if (Math.abs(ds[i]) < 1e-8) {
      if (os[i] < lo || os[i] > hi) return null;
    } else {
      let t1 = (lo - os[i]) / ds[i];
      let t2 = (hi - os[i]) / ds[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin > 0 ? tmin : null;
}

function makeTag(text, color, fontSize = 40) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `bold ${fontSize}px Fredoka, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  c.width = w;
  c.height = fontSize + 20;
  ctx.font = `bold ${fontSize}px Fredoka, sans-serif`;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 0, 0, w, c.height, 14);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  const k = 0.006;
  s.scale.set(w * k, c.height * k, 1);
  s.renderOrder = 10;
  return s;
}

function makeMarker() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ff2d55';
  ctx.beginPath(); ctx.moveTo(32, 60); ctx.lineTo(8, 16); ctx.lineTo(56, 16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('!', 32, 40);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(0.8, 0.8, 1);
  s.renderOrder = 11;
  return s;
}

function makeIce(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(size.x + 0.2, size.y + 0.2, size.z + 0.2),
    new THREE.MeshLambertMaterial({ color: '#aee9ff', transparent: true, opacity: 0.45 }),
  );
  m.position.y = size.y / 2;
  return m;
}

function flashModel(model) {
  if (!model) return;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const orig = o.material;
    o.material = mat('#ffffff', { emissive: '#ff4444' });
    setTimeout(() => { o.material = orig; }, 120);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
