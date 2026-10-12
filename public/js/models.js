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
// media esfera (cúpula) y medio cilindro (tapa de cofre)
const DOME = (r, s = 14) => geo('sph', r, s, Math.max(6, s / 2), 0, Math.PI * 2, 0, Math.PI / 2);
const HALFCYL = (r, h, s = 14) => geo('cyl', r, r, h, s, 1, false, 0, Math.PI);

// pantallas y bombillas que brillan un poco
function lit(mesh, color, intensity = 0.6) {
  mesh.material = mat(color, { emissive: color, emissiveIntensity: intensity });
  return mesh;
}
function glass(mesh, color, opacity = 0.5) {
  mesh.material = mat(color, { transparent: true, opacity });
  mesh.castShadow = false;
  return mesh;
}

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
    part(g, geo('torus', 0.27, 0.15, 8, 16), '#222222', 0, 0.15, 0, Math.PI / 2, 0, 0);
    part(g, C(0.14, 0.14, 0.2, 12), '#9aa0a6', 0, 0.15, 0);
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

  // ------------------------------------------------------------ casa
  microwave(g) {
    part(g, B(0.6, 0.35, 0.4), '#dfe6e9', 0, 0.175, 0);
    part(g, B(0.38, 0.25, 0.01), '#2d3436', -0.08, 0.175, 0.2);
    part(g, B(0.12, 0.25, 0.01), '#636e72', 0.22, 0.175, 0.2);
    lit(part(g, B(0.06, 0.03, 0.01), '#00b894', 0.22, 0.26, 0.206), '#00b894');
  },
  stove(g) {
    part(g, B(0.7, 0.86, 0.64), '#f5f6fa', 0, 0.43, 0);
    part(g, B(0.7, 0.04, 0.64), '#2d3436', 0, 0.88, 0);
    for (const [x, z] of [[-0.17, -0.15], [0.17, -0.15], [-0.17, 0.15], [0.17, 0.15]]) part(g, C(0.09, 0.09, 0.02, 12), '#636e72', x, 0.91, z);
    part(g, B(0.5, 0.3, 0.01), '#2d3436', 0, 0.4, 0.325);
    part(g, B(0.5, 0.03, 0.03), '#b2bec3', 0, 0.62, 0.335);
    for (const x of [-0.2, -0.07, 0.07, 0.2]) part(g, C(0.025, 0.025, 0.02, 8), '#2d3436', x, 0.78, 0.33, Math.PI / 2, 0, 0);
  },
  toaster(g) {
    part(g, B(0.3, 0.2, 0.18), '#d63031', 0, 0.1, 0);
    part(g, B(0.3, 0.02, 0.18), '#b2bec3', 0, 0.21, 0);
    for (const z of [-0.04, 0.04]) part(g, B(0.2, 0.012, 0.03), '#2d3436', 0, 0.221, z);
    part(g, B(0.03, 0.06, 0.03), '#2d3436', 0.165, 0.14, 0);
    part(g, B(0.16, 0.06, 0.02), '#e1b12c', 0, 0.25, 0.04);
  },
  teddy(g) {
    const fur = '#a0522d';
    part(g, geo('sph', 0.17, 12, 10), fur, 0, 0.21, 0).scale.set(1, 1.1, 0.9);
    part(g, geo('sph', 0.13, 12, 10), fur, 0, 0.45, 0);
    for (const x of [-0.1, 0.1]) part(g, geo('sph', 0.05, 8, 6), fur, x, 0.56, 0);
    part(g, geo('sph', 0.05, 8, 6), '#deb887', 0, 0.43, 0.11);
    part(g, geo('sph', 0.02, 6, 6), '#111111', 0, 0.45, 0.155);
    for (const x of [-0.05, 0.05]) part(g, geo('sph', 0.018, 6, 6), '#111111', x, 0.49, 0.115);
    for (const x of [-0.17, 0.17]) part(g, geo('sph', 0.07, 8, 6), fur, x, 0.26, 0.04);
    for (const x of [-0.09, 0.09]) part(g, geo('sph', 0.075, 8, 6), fur, x, 0.075, 0.1);
    part(g, geo('sph', 0.08, 8, 6), '#deb887', 0, 0.21, 0.1).scale.set(1, 1, 0.5);
  },
  guitar(g) {
    const st = '#2d3436';
    part(g, B(0.04, 0.3, 0.04), st, 0, 0.15, -0.1, -0.3, 0, 0);
    part(g, B(0.3, 0.03, 0.04), st, 0, 0.015, 0.06);
    part(g, B(0.04, 0.03, 0.25), st, 0, 0.015, -0.04);
    const body = '#d35400';
    part(g, geo('sph', 0.18, 14, 10), body, 0, 0.24, 0.02).scale.set(1, 1, 0.3);
    part(g, geo('sph', 0.13, 14, 10), body, 0, 0.45, 0.02).scale.set(1, 1, 0.3);
    part(g, C(0.05, 0.05, 0.01, 12), '#2d3436', 0, 0.33, 0.075, Math.PI / 2, 0, 0);
    part(g, B(0.1, 0.02, 0.02), '#f5f5f5', 0, 0.17, 0.078);
    part(g, B(0.05, 0.42, 0.03), '#6d4c41', 0, 0.76, 0.02);
    part(g, B(0.08, 0.1, 0.03), '#3e2723', 0, 1.0, 0.02);
  },
  piano(g) {
    const w = '#1e272e';
    part(g, B(1.5, 1.25, 0.38), w, 0, 0.625, -0.11);
    part(g, B(1.4, 0.06, 0.26), w, 0, 0.74, 0.17);
    part(g, B(1.36, 0.03, 0.17), '#ffffff', 0, 0.785, 0.2);
    for (let i = 0; i < 18; i++) {
      if (i % 7 === 2 || i % 7 === 6) continue;
      part(g, B(0.035, 0.03, 0.1), '#111111', -0.63 + i * 0.075, 0.81, 0.16);
    }
    for (const x of [-0.68, 0.68]) part(g, B(0.08, 0.74, 0.08), w, x, 0.37, 0.24);
    part(g, B(0.5, 0.25, 0.02), '#f5f6fa', 0, 1.0, 0.09);
    part(g, B(0.1, 0.02, 0.1), '#c8a165', -0.4, 0.01, 0.24);
  },
  clock(g) {
    part(g, B(0.5, 1.58, 0.35), '#8b4513', 0, 0.79, 0);
    part(g, B(0.55, 0.42, 0.38), '#7b3f1f', 0, 1.79, 0);
    part(g, C(0.16, 0.16, 0.02, 20), '#fdf5e6', 0, 1.79, 0.19, Math.PI / 2, 0, 0);
    part(g, B(0.015, 0.12, 0.01), '#111111', 0, 1.83, 0.205);
    part(g, B(0.09, 0.015, 0.01), '#111111', 0.035, 1.79, 0.205);
    part(g, B(0.24, 0.9, 0.01), '#f7dc6f', 0, 0.85, 0.176);
    part(g, C(0.07, 0.07, 0.02, 16), '#d4ac0d', 0, 0.55, 0.19, Math.PI / 2, 0, 0);
  },
  vase(g) {
    const c = '#2e86de';
    part(g, C(0.1, 0.12, 0.08, 14), c, 0, 0.04, 0);
    part(g, geo('sph', 0.17, 14, 10), c, 0, 0.27, 0).scale.set(1, 1.1, 1);
    part(g, C(0.08, 0.1, 0.18, 14), c, 0, 0.5, 0);
    part(g, C(0.1, 0.08, 0.04, 14), c, 0, 0.6, 0);
    part(g, geo('torus', 0.17, 0.015, 6, 20), '#ffffff', 0, 0.27, 0, Math.PI / 2, 0, 0);
  },
  armchair(g) {
    const d = '#922b21';
    part(g, B(0.7, 0.3, 0.7), '#c0392b', 0, 0.3, 0.05);
    part(g, B(0.66, 0.12, 0.62), '#e74c3c', 0, 0.5, 0.08);
    part(g, B(0.8, 0.7, 0.18), d, 0, 0.6, -0.33);
    for (const x of [-0.41, 0.41]) part(g, B(0.14, 0.5, 0.78), d, x, 0.4, 0.01);
    for (const [x, z] of [[-0.38, -0.35], [0.38, -0.35], [-0.38, 0.35], [0.38, 0.35]]) part(g, B(0.06, 0.15, 0.06), '#3e2723', x, 0.075, z);
  },
  nightstand(g) {
    part(g, B(0.5, 0.5, 0.4), '#a0522d', 0, 0.25, 0);
    for (const y of [0.14, 0.36]) {
      part(g, B(0.42, 0.17, 0.01), '#cd853f', 0, y, 0.2);
      part(g, geo('sph', 0.02, 6, 6), '#f1c40f', 0, y, 0.21);
    }
  },
  coatrack(g) {
    const w = '#5d4037';
    part(g, C(0.2, 0.24, 0.05, 14), w, 0, 0.025, 0);
    part(g, C(0.03, 0.03, 1.7, 8), w, 0, 0.9, 0);
    part(g, geo('sph', 0.05, 8, 6), w, 0, 1.76, 0);
    part(g, B(0.32, 0.03, 0.03), w, 0, 1.65, 0);
    part(g, B(0.03, 0.03, 0.32), w, 0, 1.65, 0);
    part(g, B(0.36, 0.62, 0.14), '#2980b9', 0, 1.3, 0.1);
    part(g, B(0.1, 0.12, 0.02), '#2471a3', 0.1, 1.2, 0.18);
    part(g, B(0.3, 0.5, 0.1), '#c0392b', 0, 1.35, -0.1);
  },
  globe(g) {
    part(g, C(0.13, 0.16, 0.05, 14), '#8b5a2b', 0, 0.025, 0);
    part(g, C(0.02, 0.02, 0.16, 8), '#8b5a2b', 0, 0.13, 0);
    part(g, geo('sph', 0.17, 16, 12), '#3498db', 0, 0.39, 0);
    for (const [x, y, z, r] of [[0.6, 0.4, 0.6, 0.08], [-0.8, -0.2, 0.5, 0.07], [0.1, -0.5, -0.8, 0.06], [-0.4, 0.6, -0.6, 0.06]]) {
      const n = Math.hypot(x, y, z);
      const k = (0.17 - r * 0.45) / n;
      part(g, geo('ico', r, 0), '#27ae60', x * k, 0.39 + y * k, z * k);
    }
    part(g, geo('torus', 0.19, 0.012, 6, 24), '#b7950b', 0, 0.39, 0, 0, 0, 0.4);
  },
  trophy(g) {
    const gold = '#f1c40f';
    part(g, B(0.24, 0.08, 0.24), '#2d3436', 0, 0.04, 0);
    part(g, C(0.03, 0.05, 0.1, 10), gold, 0, 0.13, 0);
    part(g, C(0.13, 0.05, 0.2, 14), gold, 0, 0.28, 0);
    for (const x of [-0.14, 0.14]) part(g, geo('torus', 0.05, 0.015, 6, 12), gold, x, 0.3, 0);
  },
  radio(g) {
    part(g, B(0.5, 0.26, 0.16), '#16a085', 0, 0.13, 0);
    part(g, C(0.08, 0.08, 0.02, 16), '#2d3436', -0.13, 0.13, 0.08, Math.PI / 2, 0, 0);
    part(g, B(0.16, 0.06, 0.01), '#ecf0f1', 0.12, 0.17, 0.085);
    for (const x of [0.08, 0.17]) part(g, C(0.025, 0.025, 0.02, 10), '#e67e22', x, 0.08, 0.085, Math.PI / 2, 0, 0);
    part(g, B(0.3, 0.03, 0.03), '#2d3436', 0, 0.3, 0);
    for (const x of [-0.14, 0.14]) part(g, B(0.03, 0.05, 0.03), '#2d3436', x, 0.275, 0);
  },
  speaker(g) {
    part(g, B(0.5, 1.0, 0.45), '#2d3436', 0, 0.5, 0);
    part(g, C(0.17, 0.17, 0.02, 20), '#636e72', 0, 0.32, 0.225, Math.PI / 2, 0, 0);
    part(g, C(0.07, 0.07, 0.03, 16), '#1e272e', 0, 0.32, 0.23, Math.PI / 2, 0, 0);
    part(g, C(0.08, 0.08, 0.02, 16), '#636e72', 0, 0.75, 0.225, Math.PI / 2, 0, 0);
    lit(part(g, B(0.06, 0.03, 0.01), '#00b894', 0.15, 0.92, 0.226), '#00b894');
  },
  suitcase(g) {
    part(g, B(0.55, 0.62, 0.25), '#0984e3', 0, 0.36, 0);
    for (const x of [-0.15, 0, 0.15]) part(g, B(0.02, 0.6, 0.255), '#0a6ebd', x, 0.36, 0);
    part(g, B(0.2, 0.04, 0.04), '#2d3436', 0, 0.71, 0);
    for (const x of [-0.12, 0.12]) part(g, B(0.03, 0.05, 0.03), '#2d3436', x, 0.68, 0);
    for (const x of [-0.22, 0.22]) part(g, C(0.03, 0.03, 0.03, 10), '#111111', x, 0.03, -0.09, 0, 0, Math.PI / 2);
  },
  backpack(g) {
    const c = '#e17055';
    part(g, B(0.38, 0.42, 0.2), c, 0, 0.21, 0);
    part(g, DOME(0.19, 12), c, 0, 0.42, 0).scale.set(1, 0.55, 0.53);
    part(g, B(0.28, 0.16, 0.06), '#d35400', 0, 0.14, 0.12);
    for (const x of [-0.11, 0.11]) part(g, B(0.05, 0.38, 0.03), '#2d3436', x, 0.25, -0.115);
    part(g, B(0.08, 0.06, 0.02), '#2d3436', 0, 0.5, -0.02);
  },
  gift(g) {
    part(g, B(0.5, 0.5, 0.5), '#e84393', 0, 0.25, 0);
    part(g, B(0.52, 0.51, 0.1), '#fdcb6e', 0, 0.25, 0);
    part(g, B(0.1, 0.51, 0.52), '#fdcb6e', 0, 0.25, 0);
    for (const r of [0.6, -0.6]) part(g, geo('torus', 0.06, 0.02, 6, 12), '#fdcb6e', 0, 0.53, 0, 0, Math.PI / 2, r);
  },
  toiletpaper(g) {
    part(g, C(0.13, 0.13, 0.26, 18), '#ffffff', 0, 0.13, 0);
    part(g, C(0.045, 0.045, 0.262, 12), '#c8a165', 0, 0.13, 0);
  },
  bucket(g) {
    part(g, C(0.17, 0.13, 0.34, 16), '#0984e3', 0, 0.17, 0);
    part(g, C(0.15, 0.15, 0.01, 16), '#74b9ff', 0, 0.335, 0);
    part(g, geo('torus', 0.16, 0.01, 6, 16, Math.PI), '#636e72', 0, 0.34, 0);
  },
  arcade(g) {
    part(g, B(0.8, 1.8, 0.62), '#6c5ce7', 0, 0.9, -0.12);
    part(g, B(0.8, 0.14, 0.34), '#2d3436', 0, 1.02, 0.25, 0.25, 0, 0);
    lit(part(g, B(0.62, 0.48, 0.02), '#00cec9', 0, 1.38, 0.2), '#00cec9', 0.8);
    lit(part(g, B(0.8, 0.22, 0.08), '#fdcb6e', 0, 1.69, 0.21), '#fdcb6e', 0.4);
    part(g, C(0.015, 0.015, 0.1, 8), '#2d3436', -0.18, 1.13, 0.26);
    part(g, geo('sph', 0.04, 8, 6), '#d63031', -0.18, 1.19, 0.26);
    for (const [x, col] of [[0.05, '#d63031'], [0.15, '#0984e3'], [0.25, '#00b894']]) part(g, C(0.03, 0.03, 0.02, 10), col, x, 1.1, 0.27);
    part(g, B(0.3, 0.12, 0.02), '#2d3436', 0, 0.35, 0.2);
  },
  drum(g) {
    part(g, C(0.28, 0.28, 0.4, 18), '#c0392b', 0, 0.36, 0);
    part(g, C(0.285, 0.285, 0.02, 18), '#fdf5e6', 0, 0.57, 0);
    for (const y of [0.17, 0.55]) part(g, geo('torus', 0.285, 0.015, 6, 24), '#bdc3c7', 0, y, 0, Math.PI / 2, 0, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      part(g, B(0.03, 0.17, 0.03), '#7f8c8d', Math.sin(a) * 0.24, 0.085, Math.cos(a) * 0.24);
    }
    for (const sg of [-1, 1]) part(g, C(0.012, 0.012, 0.4, 6), '#f5cba7', sg * 0.1, 0.6, 0.05, 0, 0, sg * 1.4);
  },
  watermelon(g) {
    part(g, geo('sph', 0.25, 14, 10), '#27ae60', 0, 0.2, 0).scale.set(1.2, 0.8, 0.9);
    part(g, C(0.015, 0.02, 0.06, 6), '#6d4c41', 0, 0.41, 0);
  },

  // ------------------------------------------------------------ exterior
  snowman(g) {
    const w = '#f5f6fa';
    part(g, geo('sph', 0.4, 16, 12), w, 0, 0.4, 0);
    part(g, geo('sph', 0.29, 16, 12), w, 0, 0.94, 0);
    part(g, geo('sph', 0.2, 14, 10), w, 0, 1.35, 0);
    part(g, geo('cone', 0.04, 0.22, 8), '#e67e22', 0, 1.35, 0.29, Math.PI / 2, 0, 0);
    for (const x of [-0.07, 0.07]) part(g, geo('sph', 0.025, 6, 6), '#111111', x, 1.42, 0.17);
    for (const y of [0.82, 0.94, 1.06]) part(g, geo('sph', 0.03, 6, 6), '#111111', 0, y, 0.28);
    part(g, C(0.22, 0.22, 0.03, 16), '#2d3436', 0, 1.52, 0);
    part(g, C(0.14, 0.14, 0.2, 16), '#2d3436', 0, 1.63, 0);
    part(g, geo('torus', 0.23, 0.05, 6, 16), '#c0392b', 0, 1.17, 0, Math.PI / 2, 0, 0);
    for (const sg of [-1, 1]) part(g, C(0.015, 0.02, 0.35, 6), '#6d4c41', sg * 0.36, 1.02, 0, 0, 0, sg * 1.0);
  },
  hydrant(g) {
    const r = '#c0392b';
    part(g, C(0.17, 0.17, 0.08, 12), r, 0, 0.04, 0);
    part(g, C(0.12, 0.13, 0.5, 12), r, 0, 0.33, 0);
    part(g, DOME(0.13, 12), r, 0, 0.58, 0);
    part(g, C(0.04, 0.05, 0.08, 8), '#922b21', 0, 0.74, 0);
    part(g, C(0.05, 0.05, 0.4, 10), '#922b21', 0, 0.45, 0, 0, 0, Math.PI / 2);
    part(g, C(0.06, 0.06, 0.1, 10), '#922b21', 0, 0.38, 0.13, Math.PI / 2, 0, 0);
  },
  bike(g) {
    const f = '#e74c3c';
    for (const z of [-0.48, 0.48]) {
      part(g, geo('torus', 0.31, 0.035, 6, 20), '#222222', 0, 0.345, z, 0, Math.PI / 2, 0);
      part(g, C(0.03, 0.03, 0.08, 8), '#7f8c8d', 0, 0.345, z, 0, 0, Math.PI / 2);
    }
    part(g, B(0.04, 0.04, 0.62), f, 0, 0.72, 0.02);
    part(g, B(0.04, 0.04, 0.68), f, 0, 0.53, 0.1, 0.55, 0, 0);
    part(g, B(0.04, 0.42, 0.04), f, 0, 0.55, -0.22, -0.25, 0, 0);
    part(g, B(0.04, 0.04, 0.5), f, 0, 0.36, -0.25);
    part(g, B(0.04, 0.6, 0.04), f, 0, 0.62, 0.42, 0.2, 0, 0);
    part(g, B(0.12, 0.05, 0.24), '#2d3436', 0, 0.8, -0.3);
    part(g, B(0.5, 0.04, 0.04), '#2d3436', 0, 0.94, 0.47);
    part(g, C(0.06, 0.06, 0.04, 10), '#7f8c8d', 0, 0.345, -0.05, 0, 0, Math.PI / 2);
  },
  cactus(g) {
    part(g, C(0.2, 0.15, 0.25, 12), '#c0392b', 0, 0.125, 0);
    part(g, C(0.19, 0.19, 0.02, 12), '#6d4c41', 0, 0.25, 0);
    const c = '#27ae60';
    part(g, C(0.11, 0.12, 0.85, 10), c, 0, 0.67, 0);
    part(g, geo('sph', 0.11, 10, 8), c, 0, 1.09, 0);
    for (const sg of [-1, 1]) {
      part(g, C(0.06, 0.06, 0.18, 8), c, sg * 0.15, 0.62, 0, 0, 0, Math.PI / 2);
      part(g, C(0.06, 0.06, 0.3, 8), c, sg * 0.22, 0.77, 0);
      part(g, geo('sph', 0.06, 8, 6), c, sg * 0.22, 0.92, 0);
    }
    part(g, geo('sph', 0.05, 8, 6), '#fd79a8', 0, 1.21, 0);
  },
  flowers(g) {
    part(g, C(0.18, 0.13, 0.26, 12), '#d35400', 0, 0.13, 0);
    part(g, C(0.17, 0.17, 0.02, 12), '#5d4037', 0, 0.26, 0);
    part(g, geo('ico', 0.12, 0), '#2ecc71', 0, 0.33, 0).scale.set(1.2, 0.6, 1.2);
    const cols = ['#e84393', '#fdcb6e', '#ffffff', '#a29bfe', '#ff7675'];
    [[0, 0.55, 0], [0.09, 0.47, 0.06], [-0.1, 0.5, 0.03], [0.04, 0.45, -0.1], [-0.05, 0.42, 0.1]].forEach(([x, y, z], i) => {
      part(g, C(0.008, 0.008, y - 0.26, 4), '#27ae60', x, (y + 0.26) / 2, z);
      part(g, geo('ico', 0.06, 0), cols[i], x, y, z);
    });
  },
  gnome(g) {
    part(g, C(0.12, 0.16, 0.3, 12), '#2980b9', 0, 0.15, 0);
    part(g, C(0.13, 0.13, 0.03, 12), '#5d4037', 0, 0.29, 0);
    part(g, geo('sph', 0.1, 12, 10), '#f5cba7', 0, 0.39, 0);
    part(g, geo('cone', 0.1, 0.22, 10), '#ecf0f1', 0, 0.3, 0.06, Math.PI + 0.25, 0, 0);
    part(g, geo('sph', 0.03, 8, 6), '#e17055', 0, 0.39, 0.1);
    part(g, geo('cone', 0.12, 0.3, 12), '#e74c3c', 0, 0.6, 0);
    for (const x of [-0.06, 0.06]) part(g, B(0.07, 0.04, 0.12), '#2d3436', x, 0.02, 0.06);
  },
  pumpkin(g) {
    const o = '#e67e22';
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      part(g, geo('sph', 0.17, 10, 8), o, Math.sin(a) * 0.12, 0.21, Math.cos(a) * 0.12).scale.set(1, 1.2, 1);
    }
    part(g, geo('sph', 0.2, 12, 10), '#d35400', 0, 0.22, 0).scale.set(1, 1.05, 1);
    part(g, C(0.03, 0.04, 0.12, 8), '#27ae60', 0, 0.47, 0, 0.2, 0, 0);
    part(g, geo('sph', 0.06, 8, 6), '#2ecc71', 0.07, 0.43, 0).scale.set(1.5, 0.4, 1);
  },
  mushroom(g) {
    part(g, C(0.1, 0.13, 0.32, 12), '#f5f6fa', 0, 0.16, 0);
    part(g, DOME(0.3, 16), '#e74c3c', 0, 0.28, 0).scale.set(1, 0.8, 1);
    for (const [x, z, r] of [[0, 0, 0.05], [0.15, 0.08, 0.04], [-0.12, 0.12, 0.035], [0.05, -0.17, 0.04], [-0.16, -0.06, 0.04]]) {
      const y = 0.28 + 0.24 * Math.sqrt(Math.max(0, 1 - (x * x + z * z) / 0.09));
      part(g, geo('sph', r, 8, 6), '#ffffff', x, y, z).scale.set(1, 0.4, 1);
    }
  },
  doghouse(g) {
    part(g, B(1.0, 0.65, 1.2), '#e17055', 0, 0.325, 0);
    part(g, B(0.7, 0.22, 1.18), '#e17055', 0, 0.75, 0);
    part(g, B(0.4, 0.15, 1.18), '#e17055', 0, 0.9, 0);
    for (const sg of [-1, 1]) part(g, B(0.66, 0.06, 1.32), '#6d4c41', sg * 0.27, 0.86, 0, 0, 0, -sg * 0.62);
    part(g, B(0.12, 0.08, 1.32), '#5d4037', 0, 1.03, 0);
    part(g, B(0.42, 0.45, 0.02), '#2d3436', 0, 0.25, 0.6);
    part(g, B(0.3, 0.08, 0.02), '#fdcb6e', 0, 0.55, 0.61);
  },
  haybale(g) {
    part(g, B(1.2, 0.7, 0.8), '#e1b12c', 0, 0.35, 0);
    for (const x of [-0.35, 0.35]) part(g, B(0.04, 0.71, 0.81), '#a0522d', x, 0.35, 0);
    for (let i = 0; i < 8; i++) part(g, B(0.3, 0.02, 0.02), '#f6e58d', -0.45 + (i % 4) * 0.3, 0.71, -0.25 + Math.floor(i / 4) * 0.5, 0, i, 0);
  },
  wheelbarrow(g) {
    const tray = '#27ae60';
    part(g, B(0.6, 0.06, 0.8), tray, 0, 0.4, 0.05);
    for (const sg of [-1, 1]) part(g, B(0.04, 0.3, 0.8), tray, sg * 0.3, 0.53, 0.05);
    part(g, B(0.6, 0.3, 0.04), tray, 0, 0.53, -0.35);
    part(g, B(0.6, 0.3, 0.04), tray, 0, 0.53, 0.45, -0.4, 0, 0);
    part(g, geo('torus', 0.15, 0.05, 6, 16), '#2d3436', 0, 0.2, 0.55, 0, Math.PI / 2, 0);
    for (const sg of [-1, 1]) {
      part(g, B(0.04, 0.04, 0.9), '#8b5a2b', sg * 0.22, 0.42, -0.35, -0.12, 0, 0);
      part(g, B(0.04, 0.38, 0.04), '#7f8c8d', sg * 0.22, 0.19, -0.25);
    }
  },
  streetlamp(g) {
    const d = '#2d3436';
    part(g, C(0.14, 0.18, 0.35, 10), d, 0, 0.175, 0);
    part(g, C(0.05, 0.06, 2.4, 8), d, 0, 1.55, 0);
    lit(part(g, geo('sph', 0.13, 10, 8), '#fff3b0', 0, 2.72, 0), '#fff3b0', 0.9);
    part(g, C(0.08, 0.2, 0.25, 8), d, 0, 2.875, 0);
  },
  chest(g) {
    part(g, B(0.9, 0.45, 0.6), '#8b5a2b', 0, 0.225, 0);
    part(g, HALFCYL(0.3, 0.9), '#7b4a22', 0, 0.45, 0, 0, 0, Math.PI / 2);
    for (const x of [-0.3, 0.3]) {
      part(g, B(0.06, 0.46, 0.62), '#f1c40f', x, 0.225, 0);
      part(g, HALFCYL(0.31, 0.06), '#f1c40f', x, 0.45, 0, 0, 0, Math.PI / 2);
    }
    part(g, B(0.12, 0.14, 0.04), '#f1c40f', 0, 0.42, 0.31);
  },

  // ------------------------------------------------------------ almacén y tiendas
  vending(g) {
    part(g, B(1.0, 1.9, 0.8), '#d63031', 0, 0.95, 0);
    part(g, B(0.64, 1.3, 0.01), '#1e272e', -0.1, 1.15, 0.405);
    const cols = ['#fdcb6e', '#00b894', '#e17055', '#6c5ce7', '#ffffff', '#0984e3'];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) part(g, B(0.11, 0.2, 0.04), cols[(r * 3 + c) % cols.length], -0.34 + c * 0.16, 0.7 + r * 0.3, 0.43);
    glass(part(g, B(0.66, 1.32, 0.01), '#a9d8ff', -0.1, 1.15, 0.46), '#a9d8ff', 0.35);
    part(g, B(0.2, 0.5, 0.02), '#2d3436', 0.35, 1.25, 0.41);
    part(g, B(0.08, 0.12, 0.01), '#dfe6e9', 0.35, 1.35, 0.425);
    part(g, B(0.64, 0.18, 0.04), '#2d3436', -0.1, 0.3, 0.42);
    lit(part(g, B(0.9, 0.12, 0.01), '#ffeaa7', 0, 1.8, 0.405), '#ffeaa7', 0.7);
  },
  watercooler(g) {
    part(g, B(0.34, 0.9, 0.34), '#dfe6e9', 0, 0.45, 0);
    part(g, B(0.2, 0.06, 0.04), '#636e72', 0, 0.7, 0.18);
    for (const [x, c] of [[-0.05, '#0984e3'], [0.05, '#d63031']]) part(g, B(0.03, 0.05, 0.04), c, x, 0.66, 0.2);
    glass(part(g, C(0.14, 0.14, 0.32, 16), '#74b9ff', 0, 1.07, 0), '#74b9ff', 0.7);
  },
  whiteboard(g) {
    const m = '#95a5a6';
    for (const x of [-0.75, 0.75]) {
      part(g, B(0.05, 1.65, 0.05), m, x, 0.825, 0);
      part(g, B(0.06, 0.05, 0.5), m, x, 0.025, 0);
    }
    part(g, B(1.5, 0.9, 0.04), '#ffffff', 0, 1.2, 0);
    for (const y of [0.75, 1.65]) part(g, B(1.52, 0.03, 0.06), m, 0, y, 0);
    for (const [x, y, w, c] of [[-0.4, 1.45, 0.5, '#e74c3c'], [-0.3, 1.3, 0.7, '#2980b9'], [0.3, 1.1, 0.5, '#27ae60'], [-0.2, 0.95, 0.4, '#2d3436']]) part(g, B(w, 0.03, 0.005), c, x, y, 0.022);
  },
  cart(g) {
    const rim = '#95a5a6';
    for (const [w, h, d, x, y, z] of [[0.54, 0.02, 0.76, 0, 0.45, 0], [0.02, 0.42, 0.76, -0.27, 0.66, 0], [0.02, 0.42, 0.76, 0.27, 0.66, 0], [0.54, 0.42, 0.02, 0, 0.66, 0.38], [0.54, 0.42, 0.02, 0, 0.66, -0.38]]) {
      glass(part(g, B(w, h, d), '#dfe6e9', x, y, z), '#dfe6e9', 0.35);
    }
    for (const y of [0.45, 0.87]) {
      for (const z of [-0.38, 0.38]) part(g, B(0.56, 0.03, 0.03), rim, 0, y, z);
      for (const x of [-0.28, 0.28]) part(g, B(0.03, 0.03, 0.78), rim, x, y, 0);
    }
    for (const x of [-0.27, 0.27]) part(g, B(0.03, 0.16, 0.03), rim, x, 0.93, -0.42);
    part(g, C(0.02, 0.02, 0.6, 8), '#d63031', 0, 1.0, -0.45, 0, 0, Math.PI / 2);
    for (const [x, z] of [[-0.24, -0.33], [0.24, -0.33], [-0.24, 0.33], [0.24, 0.33]]) {
      part(g, B(0.03, 0.36, 0.03), rim, x, 0.26, z);
      part(g, C(0.05, 0.05, 0.04, 10), '#2d3436', x, 0.05, z, 0, 0, Math.PI / 2);
    }
  },
  gascan(g) {
    const o = '#e67e22';
    part(g, C(0.15, 0.15, 0.06, 14), '#d35400', 0, 0.03, 0);
    part(g, C(0.16, 0.16, 0.46, 16), o, 0, 0.29, 0);
    part(g, DOME(0.16, 16), o, 0, 0.52, 0).scale.set(1, 0.5, 1);
    part(g, C(0.04, 0.04, 0.08, 10), '#7f8c8d', 0, 0.63, 0);
    part(g, geo('torus', 0.1, 0.015, 6, 16, Math.PI), '#7f8c8d', 0, 0.6, 0);
    part(g, B(0.2, 0.06, 0.005), '#ffffff', 0, 0.35, 0.161);
  },
  barrier(g) {
    for (const x of [-0.65, 0.65]) {
      part(g, B(0.08, 0.06, 0.4), '#2d3436', x, 0.03, 0);
      part(g, B(0.06, 0.94, 0.06), '#7f8c8d', x, 0.5, 0);
    }
    for (const y of [0.55, 0.88]) {
      for (let i = 0; i < 6; i++) part(g, B(0.25, 0.14, 0.04), i % 2 ? '#ffffff' : '#e74c3c', -0.625 + i * 0.25, y, 0.04);
    }
    lit(part(g, geo('sph', 0.05, 8, 6), '#f39c12', -0.65, 1.0, 0), '#f39c12', 0.8);
  },
  extinguisher(g) {
    const r = '#d63031';
    part(g, C(0.1, 0.1, 0.48, 14), r, 0, 0.24, 0);
    part(g, DOME(0.1, 14), r, 0, 0.48, 0).scale.set(1, 0.6, 1);
    part(g, B(0.05, 0.08, 0.05), '#2d3436', 0, 0.57, 0);
    part(g, B(0.14, 0.02, 0.03), '#2d3436', 0.04, 0.62, 0);
    part(g, B(0.025, 0.3, 0.025), '#2d3436', 0.12, 0.43, 0);
    part(g, B(0.14, 0.12, 0.005), '#ffffff', 0, 0.25, 0.101);
  },
};

export const MODEL_TYPES = Object.keys(builders);

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
