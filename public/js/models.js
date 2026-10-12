// Modelos 3D low-poly hechos con figuras básicas (sin archivos externos).
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  }
  return matCache.get(key);
}

const geoCache = new Map();
function geo(kind, ...a) {
  const key = kind + a.join(',');
  if (!geoCache.has(key)) {
    let g;
    if (kind === 'box') g = new THREE.BoxGeometry(...a);
    else if (kind === 'cyl') g = new THREE.CylinderGeometry(...a);
    else if (kind === 'sph') g = new THREE.SphereGeometry(...a);
    else if (kind === 'cone') g = new THREE.ConeGeometry(...a);
    else if (kind === 'torus') g = new THREE.TorusGeometry(...a);
    else if (kind === 'ico') g = new THREE.IcosahedronGeometry(...a);
    else if (kind === 'dod') g = new THREE.DodecahedronGeometry(...a);
    geoCache.set(key, g);
  }
  return geoCache.get(key);
}

function part(group, g, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(g, mat(color));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

const B = (w, h, d) => geo('box', w, h, d);
const C = (rt, rb, h, s = 12) => geo('cyl', rt, rb, h, s);

const builders = {
  crate(g) {
    part(g, B(1, 1, 1), '#b5843f', 0, 0.5, 0);
    for (const y of [0.08, 0.92]) for (const z of [-0.51, 0.51]) part(g, B(1.02, 0.12, 0.02), '#7d5a2b', 0, y, z);
    for (const x of [-0.51, 0.51]) for (const y of [0.08, 0.92]) part(g, B(0.02, 0.12, 1.02), '#7d5a2b', x, y, 0);
    part(g, B(0.02, 1.1, 0.12), '#7d5a2b', 0.51, 0.5, 0, 0.78, 0, 0);
    part(g, B(0.02, 1.1, 0.12), '#7d5a2b', -0.51, 0.5, 0, -0.78, 0, 0);
  },
  smallbox(g) {
    part(g, B(0.6, 0.5, 0.6), '#c69c6d', 0, 0.25, 0);
    part(g, B(0.62, 0.04, 0.12), '#d9c27c', 0, 0.5, 0);
  },
  barrel(g) {
    part(g, C(0.38, 0.38, 1.1, 14), '#2f6db5', 0, 0.55, 0);
    for (const y of [0.15, 0.55, 0.95]) part(g, C(0.4, 0.4, 0.06, 14), '#1d4a80', 0, y, 0);
  },
  chair(g) {
    part(g, B(0.55, 0.08, 0.55), '#a0522d', 0, 0.48, 0);
    for (const [x, z] of [[-0.23, -0.23], [0.23, -0.23], [-0.23, 0.23], [0.23, 0.23]]) part(g, B(0.06, 0.48, 0.06), '#7b3f1f', x, 0.24, z);
    part(g, B(0.55, 0.5, 0.06), '#a0522d', 0, 0.77, -0.25);
  },
  table(g) {
    part(g, B(1.6, 0.08, 1.0), '#c08a5a', 0, 0.76, 0);
    for (const [x, z] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) part(g, B(0.08, 0.72, 0.08), '#8a5a33', x, 0.36, z);
  },
  plant(g) {
    part(g, C(0.22, 0.17, 0.4, 10), '#c0582b', 0, 0.2, 0);
    part(g, geo('ico', 0.32, 0), '#3d9b46', 0, 0.68, 0);
    part(g, geo('ico', 0.24, 0), '#56b85f', 0.1, 0.95, 0.05);
    part(g, geo('ico', 0.2, 0), '#2e7d32', -0.1, 0.88, -0.08);
  },
  lamp(g) {
    part(g, C(0.2, 0.22, 0.06, 12), '#333333', 0, 0.03, 0);
    part(g, C(0.03, 0.03, 1.35, 8), '#555555', 0, 0.7, 0);
    part(g, C(0.15, 0.25, 0.3, 12), '#f7e7a1', 0, 1.5, 0);
  },
  sofa(g) {
    part(g, B(2.0, 0.4, 0.9), '#5d7ea8', 0, 0.25, 0);
    part(g, B(2.0, 0.55, 0.22), '#4a6890', 0, 0.62, -0.34);
    part(g, B(0.2, 0.35, 0.9), '#4a6890', -0.9, 0.55, 0);
    part(g, B(0.2, 0.35, 0.9), '#4a6890', 0.9, 0.55, 0);
    part(g, B(0.8, 0.12, 0.65), '#6d8fbb', -0.42, 0.5, 0.08);
    part(g, B(0.8, 0.12, 0.65), '#6d8fbb', 0.42, 0.5, 0.08);
  },
  tv(g) {
    part(g, B(1.1, 0.45, 0.45), '#3b2f2f', 0, 0.225, 0);
    part(g, B(1.2, 0.62, 0.06), '#111111', 0, 0.78, 0);
    part(g, B(1.1, 0.53, 0.01), '#1f4f7a', 0, 0.78, 0.035);
  },
  bookshelf(g) {
    part(g, B(1.2, 2.0, 0.4), '#8b5a2b', 0, 1.0, 0);
    const colors = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#16a085'];
    for (let r = 0; r < 4; r++) {
      part(g, B(1.1, 0.04, 0.02), '#6b4420', 0, 0.1 + r * 0.48, 0.2);
      for (let i = 0; i < 6; i++) part(g, B(0.12, 0.32, 0.04), colors[(i + r) % 6], -0.4 + i * 0.16, 0.3 + r * 0.48, 0.2);
    }
  },
  trash(g) {
    part(g, C(0.25, 0.2, 0.75, 12), '#7f8c8d', 0, 0.375, 0);
    part(g, C(0.27, 0.27, 0.06, 12), '#596566', 0, 0.77, 0);
  },
  cone(g) {
    part(g, B(0.5, 0.05, 0.5), '#e2581d', 0, 0.025, 0);
    part(g, geo('cone', 0.2, 0.65, 12), '#ff7a2f', 0, 0.37, 0);
    part(g, C(0.12, 0.15, 0.1, 12), '#ffffff', 0, 0.36, 0);
  },
  tire(g) {
    part(g, geo('torus', 0.28, 0.12, 8, 16), '#222222', 0, 0.175, 0, Math.PI / 2, 0, 0);
  },
  bench(g) {
    for (const z of [-0.18, 0, 0.18]) part(g, B(1.8, 0.05, 0.15), '#b5651d', 0, 0.45, z);
    for (const y of [0.62, 0.78]) part(g, B(1.8, 0.12, 0.04), '#b5651d', 0, y, -0.28);
    for (const x of [-0.75, 0.75]) part(g, B(0.08, 0.45, 0.5), '#333333', x, 0.22, 0);
  },
  fridge(g) {
    part(g, B(0.8, 1.9, 0.7), '#eef2f3', 0, 0.95, 0);
    part(g, B(0.81, 0.02, 0.71), '#b0b6b8', 0, 1.25, 0);
    part(g, B(0.04, 0.4, 0.04), '#999999', 0.3, 1.5, 0.37);
    part(g, B(0.04, 0.3, 0.04), '#999999', 0.3, 1.0, 0.37);
  },
  washer(g) {
    part(g, B(0.7, 0.9, 0.7), '#f5f5f5', 0, 0.45, 0);
    part(g, C(0.22, 0.22, 0.04, 16), '#5d6d7e', 0, 0.45, 0.35, Math.PI / 2, 0, 0);
    part(g, C(0.16, 0.16, 0.05, 16), '#85c1e9', 0, 0.45, 0.36, Math.PI / 2, 0, 0);
  },
  toilet(g) {
    part(g, B(0.4, 0.4, 0.5), '#ffffff', 0, 0.2, 0.05);
    part(g, C(0.22, 0.2, 0.08, 14), '#f2f2f2', 0, 0.44, 0.08);
    part(g, B(0.45, 0.45, 0.18), '#ffffff', 0, 0.6, -0.26);
  },
  bed(g) {
    part(g, B(1.6, 0.35, 2.1), '#7b4f2a', 0, 0.175, 0);
    part(g, B(1.5, 0.2, 2.0), '#ffffff', 0, 0.45, 0);
    part(g, B(1.52, 0.08, 1.4), '#3c78d8', 0, 0.56, 0.3);
    part(g, B(0.6, 0.12, 0.35), '#fafafa', -0.35, 0.6, -0.75);
    part(g, B(0.6, 0.12, 0.35), '#fafafa', 0.35, 0.6, -0.75);
    part(g, B(1.6, 0.9, 0.08), '#6b4420', 0, 0.45, -1.05);
  },
  pallet(g) {
    for (const x of [-0.45, -0.15, 0.15, 0.45]) part(g, B(0.22, 0.03, 1.0), '#c9a26b', x, 0.135, 0);
    for (const z of [-0.42, 0, 0.42]) part(g, B(1.2, 0.12, 0.12), '#a67c45', 0, 0.06, z);
  },
  tree(g) {
    part(g, C(0.18, 0.25, 1.8, 8), '#7a4b25', 0, 0.9, 0);
    part(g, geo('ico', 0.95, 0), '#2f8f3a', 0, 2.3, 0);
    part(g, geo('ico', 0.75, 0), '#3aa848', 0.3, 2.9, 0.1);
    part(g, geo('ico', 0.6, 0), '#2a7a33', -0.3, 3.3, -0.1);
  },
  bush(g) {
    part(g, geo('ico', 0.55, 1), '#3c9a3f', 0, 0.5, 0);
    part(g, geo('ico', 0.4, 1), '#4cb050', 0.3, 0.6, 0.15);
    part(g, geo('ico', 0.35, 1), '#2f8034', -0.3, 0.45, -0.1);
  },
  rock(g) {
    const m = part(g, geo('dod', 0.5, 0), '#8d8d8d', 0, 0.32, 0);
    m.scale.set(1, 0.7, 0.9);
    part(g, geo('dod', 0.22, 0), '#a3a3a3', 0.35, 0.15, 0.2);
  },
  mailbox(g) {
    part(g, B(0.08, 0.9, 0.08), '#555555', 0, 0.45, 0);
    part(g, B(0.35, 0.3, 0.4), '#c0392b', 0, 1.05, 0);
    part(g, C(0.175, 0.175, 0.4, 12, 1), '#c0392b', 0, 1.2, 0, Math.PI / 2, 0, 0);
    part(g, B(0.03, 0.15, 0.08), '#f1c40f', 0.19, 1.15, 0.1);
  },
  computer(g) {
    part(g, B(0.5, 0.32, 0.04), '#222222', 0, 0.3, 0);
    part(g, B(0.45, 0.27, 0.01), '#4aa3df', 0, 0.3, 0.025);
    part(g, B(0.06, 0.14, 0.06), '#444444', 0, 0.07, -0.02);
    part(g, B(0.3, 0.02, 0.18), '#333333', 0, 0.01, 0.12);
  },
  ball(g) {
    part(g, geo('sph', 0.25, 16, 12), '#e74c3c', 0, 0.25, 0);
    part(g, geo('torus', 0.25, 0.03, 6, 20), '#ffffff', 0, 0.25, 0, Math.PI / 2, 0, 0);
  },
  duck(g) {
    part(g, geo('sph', 0.18, 12, 10), '#f7d21e', 0, 0.16, 0).scale.set(1, 0.85, 1.3);
    part(g, geo('sph', 0.11, 12, 10), '#f7d21e', 0, 0.33, 0.12);
    part(g, B(0.08, 0.04, 0.1), '#f39c12', 0, 0.32, 0.25);
    part(g, geo('sph', 0.02, 6, 6), '#111111', 0.06, 0.37, 0.2);
    part(g, geo('sph', 0.02, 6, 6), '#111111', -0.06, 0.37, 0.2);
  },
};

export function buildProp(type) {
  const g = new THREE.Group();
  (builders[type] || builders.crate)(g);
  g.userData.propType = type;
  return g;
}

// Personaje: cuerpo redondeado con ojos y gorra, del color del jugador.
export function buildCharacter(color, seeker = false) {
  const g = new THREE.Group();
  const body = part(g, C(0.32, 0.36, 1.0, 14), color, 0, 0.75, 0);
  part(g, geo('sph', 0.32, 14, 10), color, 0, 1.25, 0);
  part(g, geo('sph', 0.36, 14, 10), color, 0, 0.27, 0).scale.set(1, 0.6, 1);
  // visor
  part(g, B(0.42, 0.16, 0.12), '#1b2631', 0, 1.3, 0.27);
  part(g, B(0.36, 0.08, 0.02), '#5dade2', 0, 1.32, 0.335);
  // pies
  part(g, B(0.16, 0.12, 0.26), '#2c3e50', -0.14, 0.06, 0.05);
  part(g, B(0.16, 0.12, 0.26), '#2c3e50', 0.14, 0.06, 0.05);
  if (seeker) {
    // gorra de buscador y pistola de agua
    part(g, C(0.33, 0.33, 0.12, 14), '#c0392b', 0, 1.5, 0);
    part(g, B(0.3, 0.04, 0.25), '#c0392b', 0, 1.46, 0.25);
    const gun = new THREE.Group();
    part(gun, B(0.1, 0.12, 0.45), '#f39c12', 0, 0, 0.15);
    part(gun, B(0.08, 0.18, 0.08), '#e67e22', 0, -0.1, 0);
    part(gun, geo('sph', 0.08, 8, 8), '#3498db', 0, 0.09, 0.05);
    gun.position.set(0.38, 0.9, 0.2);
    g.add(gun);
  }
  body.userData.isBody = true;
  return g;
}

// Arma en primera persona para el buscador.
export function buildViewGun() {
  const g = new THREE.Group();
  part(g, B(0.08, 0.1, 0.4), '#f39c12', 0, 0, -0.2);
  part(g, B(0.07, 0.15, 0.07), '#e67e22', 0, -0.1, -0.05);
  part(g, geo('sph', 0.07, 10, 8), '#3498db', 0, 0.08, -0.15);
  part(g, C(0.02, 0.02, 0.1, 8), '#d35400', 0, 0, -0.44, Math.PI / 2, 0, 0);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
  return g;
}
