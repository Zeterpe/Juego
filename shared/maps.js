// Definición de los mapas. Lo usan tanto el servidor como el navegador.
// statics: geometría fija. box = [x1, y1, z1, x2, y2, z2]. nocol = sin colisión (suelos, alfombras).
// props:   objetos que sirven de disfraz. t = tipo (ver props.js), p = [x, y, z], r = rotación (radianes).

import { PROPS } from './props.js';

const H = Math.PI / 2;

// Generador pseudoaleatorio con semilla, para que todos vean el mismo mapa.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function box(x1, y1, z1, x2, y2, z2, color, extra = {}) {
  return { box: [Math.min(x1, x2), y1, Math.min(z1, z2), Math.max(x1, x2), y2, Math.max(z1, z2)], color, ...extra };
}

// Pared a lo largo del eje X (z constante) con huecos de puertas.
function wallX(z, x1, x2, gaps, h, color, t = 0.3) {
  const out = [];
  let cur = x1;
  for (const [a, b] of [...gaps].sort((m, n) => m[0] - n[0])) {
    if (a > cur) out.push(box(cur, 0, z - t / 2, a, h, z + t / 2, color));
    // dintel encima de la puerta
    if (h > 2.6) out.push(box(a, 2.4, z - t / 2, b, h, z + t / 2, color, { nocolBelow: true }));
    cur = b;
  }
  if (cur < x2) out.push(box(cur, 0, z - t / 2, x2, h, z + t / 2, color));
  return out;
}

// Pared a lo largo del eje Z (x constante) con huecos.
function wallZ(x, z1, z2, gaps, h, color, t = 0.3) {
  const out = [];
  let cur = z1;
  for (const [a, b] of [...gaps].sort((m, n) => m[0] - n[0])) {
    if (a > cur) out.push(box(x - t / 2, 0, cur, x + t / 2, h, a, color));
    if (h > 2.6) out.push(box(x - t / 2, 2.4, a, x + t / 2, h, b, color, { nocolBelow: true }));
    cur = b;
  }
  if (cur < z2) out.push(box(x - t / 2, 0, cur, x + t / 2, h, z2, color));
  return out;
}

function floor(x1, z1, x2, z2, color, y = 0.01) {
  return box(x1, 0, z1, x2, y, z2, color, { nocol: true, floor: true });
}

function fence(x1, z1, x2, z2, color = '#8b5a2b') {
  const h = 1.6;
  return [
    box(x1, 0, z1 - 0.15, x2, h, z1 + 0.15, color),
    box(x1, 0, z2 - 0.15, x2, h, z2 + 0.15, color),
    box(x1 - 0.15, 0, z1, x1 + 0.15, h, z2, color),
    box(x2 - 0.15, 0, z1, x2 + 0.15, h, z2, color),
  ];
}

// ---------------------------------------------------------------- CASA
function casa() {
  const W = '#f1e3c8'; // paredes
  const statics = [
    // jardín
    floor(-15, -10, 15, 10, '#c9a77c', 0.02),
    ...fence(-24, -20, 24, 18),
    // camino de entrada
    floor(-7.5, -20, -4.5, -10, '#b9b2a6', 0.03),
    // suelos de cada habitación
    floor(-15, -10, 2, 0, '#c8935b', 0.03),   // salón (parqué)
    floor(2, -10, 15, 0, '#e8e4dc', 0.03),    // cocina (baldosa)
    floor(-15, 0, -4, 10, '#7aa6c2', 0.03),   // dormitorio (moqueta)
    floor(-4, 0, 3, 10, '#d6eef2', 0.03),     // baño
    floor(3, 0, 15, 10, '#9a9a9a', 0.03),     // garaje
    floor(-11, -7, -5, -3, '#b04a4a', 0.04),  // alfombra salón
    floor(-13, 3, -8, 8, '#e9d36b', 0.04),    // alfombra dormitorio
    // paredes exteriores (puerta principal y portón del garaje)
    ...wallX(-10, -15, 15, [[-7, -5]], 3, W),
    ...wallX(10, -15, 15, [], 3, W),
    ...wallZ(-15, -10, 10, [[-7, -5.5]], 3, W),
    ...wallZ(15, -10, 10, [[3, 8]], 3, W),
    // paredes interiores
    ...wallX(0, -15, 15, [[-11, -9], [-1, 1], [8, 10]], 3, '#ead7b3'),
    ...wallZ(2, -10, 0, [[-6, -4]], 3, '#ead7b3'),
    ...wallZ(-4, 0, 10, [[4, 6]], 3, '#ead7b3'),
    ...wallZ(3, 0, 10, [[6.5, 8.5]], 3, '#ead7b3'),
    // encimera de la cocina
    box(3, 0, -9.7, 14.7, 0.95, -8.9, '#ffffff'),
    box(3, 0.95, -9.7, 14.7, 1.0, -8.9, '#555555'),
    box(14, 0, -8.9, 14.7, 0.95, -4, '#ffffff'),
    // isla de cocina
    box(7, 0, -6, 10, 0.95, -4.5, '#8a6a4f'),
    // bañera
    box(-3.8, 0, 7.5, -0.5, 0.6, 9.8, '#ffffff'),
    // banco de trabajo del garaje
    box(3.3, 0, 8.8, 9, 0.9, 9.8, '#6d4c33'),
    // coche del garaje
    box(8, 0.3, 2, 12.5, 1.2, 6.2, '#c0392b'),
    box(8.8, 1.2, 2.4, 11.5, 1.9, 5.8, '#a93226'),
    // caseta del jardín
    box(17, 0, 10, 22, 2.6, 15, '#6e8b3d'),
    // piscina (sin colisión, es suelo azul)
    floor(-22, 11, -16, 16, '#3fa9f5', 0.05),
  ];

  const props = [
    // salón
    { t: 'sofa', p: [-8, 0, -2.2], r: Math.PI },
    { t: 'tv', p: [-8, 0, -9.3], r: 0 },
    { t: 'speaker', p: [-9.4, 0, -9.5], r: 0 },
    { t: 'table', p: [-8, 0, -5], r: 0 },
    { t: 'computer', p: [-8.5, 0.8, -5], r: 0 },
    { t: 'vase', p: [-7.5, 0.8, -4.8], r: 0 },
    { t: 'armchair', p: [-10.5, 0, -5], r: H },
    { t: 'piano', p: [-12, 0, -9.5], r: 0 },
    { t: 'chair', p: [-12, 0, -8.6], r: Math.PI },
    { t: 'clock', p: [-14.6, 0, -3.5], r: H },
    { t: 'lamp', p: [-14.2, 0, -1], r: 0 },
    { t: 'plant', p: [-14.2, 0, -9.2], r: 0 },
    { t: 'gift', p: [-14.2, 0, -8.3], r: 0.2 },
    { t: 'gift', p: [-14.3, 0, -7.6], r: 0 },
    { t: 'plant', p: [1.2, 0, -9.2], r: 0 },
    { t: 'guitar', p: [1.6, 0, -8], r: -H },
    { t: 'bookshelf', p: [-3, 0, -9.6], r: 0 },
    { t: 'bookshelf', p: [-1.3, 0, -9.6], r: 0 },
    { t: 'globe', p: [-3, 2, -9.6], r: 0 },
    { t: 'trophy', p: [-1.3, 2, -9.6], r: 0 },
    { t: 'coatrack', p: [-4.4, 0, -9.4], r: 0 },
    { t: 'ball', p: [-5.5, 0, -6], r: 0 },
    { t: 'smallbox', p: [-12.5, 0, -3], r: 0.3 },
    { t: 'trash', p: [1.3, 0, -1], r: 0 },
    // cocina
    { t: 'fridge', p: [14.2, 0, -2.5], r: -H },
    { t: 'stove', p: [14.3, 0, -3.55], r: -H },
    { t: 'chair', p: [6.3, 0, -5.3], r: H },
    { t: 'chair', p: [10.7, 0, -5.3], r: -H },
    { t: 'watermelon', p: [8.5, 0.95, -5.25], r: 0.3 },
    { t: 'microwave', p: [11, 1.0, -9.3], r: 0 },
    { t: 'toaster', p: [8.5, 1.0, -9.3], r: 0 },
    { t: 'trash', p: [2.8, 0, -1], r: 0 },
    { t: 'washer', p: [4, 0, -8.3], r: 0 },
    { t: 'bucket', p: [5, 0, -8.4], r: 0 },
    { t: 'gascan', p: [2.6, 0, -9.3], r: 0 },
    { t: 'plant', p: [12, 0, -1], r: 0 },
    { t: 'table', p: [5, 0, -2.2], r: 0 },
    { t: 'radio', p: [5.3, 0.8, -2.3], r: 0 },
    { t: 'chair', p: [4, 0, -1.2], r: Math.PI },
    // dormitorio
    { t: 'bed', p: [-11.5, 0, 8.6], r: H },
    { t: 'teddy', p: [-11, 0.6, 8.6], r: H },
    { t: 'nightstand', p: [-13.1, 0, 9.5], r: Math.PI },
    { t: 'lamp', p: [-14.2, 0, 6.4], r: 0 },
    { t: 'bookshelf', p: [-7, 0, 9.6], r: Math.PI },
    { t: 'guitar', p: [-9, 0, 9.6], r: Math.PI },
    { t: 'table', p: [-6.5, 0, 1], r: 0 },
    { t: 'computer', p: [-6.5, 0.8, 0.85], r: 0 },
    { t: 'chair', p: [-6.5, 0, 1.9], r: Math.PI },
    { t: 'backpack', p: [-7.6, 0, 2.2], r: 0.4 },
    { t: 'suitcase', p: [-14.5, 0, 3], r: H },
    { t: 'plant', p: [-4.8, 0, 9.2], r: 0 },
    { t: 'smallbox', p: [-14, 0, 1], r: 0 },
    { t: 'duck', p: [-10, 0, 5.5], r: 0.6 },
    // baño
    { t: 'toilet', p: [2.3, 0, 9.3], r: Math.PI },
    { t: 'toiletpaper', p: [1.5, 0, 9.6], r: 0 },
    { t: 'toiletpaper', p: [1.5, 0.26, 9.6], r: 0 },
    { t: 'washer', p: [2.4, 0, 1], r: -H },
    { t: 'duck', p: [-2, 0.6, 8.6], r: 0 },
    { t: 'bucket', p: [0.3, 0, 9.5], r: 0 },
    { t: 'trash', p: [-3.3, 0, 1], r: 0 },
    { t: 'plant', p: [-3.3, 0, 6.8], r: 0 },
    // garaje
    { t: 'tire', p: [4, 0, 1], r: 0 },
    { t: 'tire', p: [4, 0.3, 1], r: 0 },
    { t: 'tire', p: [5, 0, 1], r: 0 },
    { t: 'barrel', p: [14.2, 0, 9.2], r: 0 },
    { t: 'barrel', p: [13.2, 0, 9.2], r: 0 },
    { t: 'crate', p: [4, 0, 4], r: 0 },
    { t: 'crate', p: [4, 1, 4], r: 0.2 },
    { t: 'smallbox', p: [5.2, 0, 4.5], r: 0 },
    { t: 'arcade', p: [6.5, 0, 0.62], r: 0 },
    { t: 'cone', p: [7.6, 0, 1.4], r: 0 },
    { t: 'cone', p: [13.8, 0, 1], r: 0 },
    { t: 'gascan', p: [14.45, 0, 1.3], r: 0 },
    { t: 'washer', p: [10, 0, 9.4], r: Math.PI },
    { t: 'bike', p: [11.8, 0, 8.6], r: 0 },
    { t: 'extinguisher', p: [3.35, 0, 6], r: H },
    { t: 'ball', p: [12.3, 0, 7.1], r: 0 },
    // jardín
    { t: 'tree', p: [-20, 0, -15], r: 0 },
    { t: 'tree', p: [19, 0, -16], r: 0 },
    { t: 'tree', p: [-19, 0, 6], r: 0 },
    { t: 'tree', p: [12, 0, 14], r: 0 },
    { t: 'tree', p: [0, 0, 15], r: 0 },
    { t: 'bush', p: [-12, 0, -12], r: 0 },
    { t: 'bush', p: [-2, 0, -12], r: 0 },
    { t: 'bush', p: [4, 0, -12], r: 0 },
    { t: 'bush', p: [10, 0, -12], r: 0 },
    { t: 'bush', p: [-17.5, 0, -2], r: 0 },
    { t: 'bush', p: [20, 0, 4], r: 0 },
    { t: 'bush', p: [-8, 0, 14], r: 0 },
    { t: 'flowers', p: [-8.2, 0, -10.6], r: 0 },
    { t: 'flowers', p: [-3.8, 0, -10.6], r: 0 },
    { t: 'streetlamp', p: [-8.6, 0, -14], r: 0 },
    { t: 'streetlamp', p: [-3.4, 0, -17], r: 0 },
    { t: 'gnome', p: [-3.8, 0, -13.5], r: 0.4 },
    { t: 'gnome', p: [-11, 0, -16], r: -0.3 },
    { t: 'gnome', p: [14, 0, -12.5], r: 0 },
    { t: 'mailbox', p: [-9, 0, -18.5], r: 0 },
    { t: 'hydrant', p: [-10.5, 0, -18.8], r: 0 },
    { t: 'snowman', p: [-1, 0, -16.5], r: 0.3 },
    { t: 'pumpkin', p: [10, 0, -16], r: 0 },
    { t: 'pumpkin', p: [11, 0, -15.4], r: 1 },
    { t: 'doghouse', p: [-19, 0, -12], r: H },
    { t: 'wheelbarrow', p: [20, 0, -12], r: 0 },
    { t: 'haybale', p: [21.5, 0, 8], r: 0 },
    { t: 'bench', p: [17, 0, -8], r: H },
    { t: 'rock', p: [21, 0, -2], r: 0.5 },
    { t: 'rock', p: [-21, 0, -8], r: 1 },
    { t: 'trash', p: [-3, 0, -18.5], r: 0 },
    { t: 'chair', p: [-15, 0, 12.5], r: 0 },
    { t: 'chair', p: [-15, 0, 14.5], r: 0 },
    { t: 'bucket', p: [-15.2, 0, 16.5], r: 0 },
    { t: 'table', p: [6, 0, 14], r: 0 },
    { t: 'watermelon', p: [6.3, 0.8, 14], r: 0 },
    { t: 'ball', p: [8, 0, -15], r: 0 },
  ];

  return {
    id: 'casa',
    name: 'La Casa',
    desc: 'Salón, cocina, dormitorio, baño, garaje y jardín con piscina.',
    bounds: [-24, -20, 24, 18],
    ground: '#6fbf5a',
    sky: '#8fd3ff',
    spawns: {
      hider: [[-6, -7], [-10, -7], [-6, -3], [8, -3], [-9, 5], [0, 5], [6, 3], [-4, -8]],
      seeker: [[-6, -16], [-3, -16], [-9, -16], [0, -16]],
    },
    statics,
    props,
  };
}

// ---------------------------------------------------------------- ALMACÉN
function almacen() {
  const statics = [
    floor(-20, -15, 20, 15, '#9da3a8', 0.02),
    floor(12, 8, 20, 15, '#c9b38f', 0.03), // oficina
    // líneas amarillas del suelo
    floor(-20, -10.1, 20, -9.9, '#f2c40f', 0.04),
    floor(-0.1, -15, 0.1, -10, '#f2c40f', 0.04),
    // paredes exteriores
    ...wallX(-15, -20, 20, [], 6, '#b8c2cc'),
    ...wallX(15, -20, 20, [], 6, '#b8c2cc'),
    ...wallZ(-20, -15, 15, [], 6, '#b8c2cc'),
    ...wallZ(20, -15, 15, [], 6, '#b8c2cc'),
    // oficina
    ...wallX(8, 12, 20, [[14, 16]], 3, '#e3e7ea'),
    ...wallZ(12, 8, 15, [], 3, '#e3e7ea'),
    // muelle de carga
    box(-19.7, 0, -14.7, -14, 1.2, -11, '#5d6d7e'),
    box(14, 0, -14.7, 19.7, 1.2, -11, '#5d6d7e'),
    // carretilla elevadora
    box(5, 0.2, -13.5, 7, 1.5, -11.5, '#f39c12'),
    box(5.3, 1.5, -13, 6.7, 2.6, -12, '#2c3e50'),
    box(4.4, 0, -13.3, 5, 1.8, -11.7, '#7f8c8d'),
  ];

  // estanterías industriales
  const racks = [];
  const rackXs = [-14, -7, 0, 7];
  for (const x of rackXs) {
    for (const [z1, z2] of [[-7, -1.5], [1.5, 7]]) {
      // estructura sólida (colisión) con estantes visuales
      statics.push(box(x - 0.6, 0, z1, x + 0.6, 0.1, z2, '#2e4053', { nocol: true }));
      // postes verticales cada ~1,3 m (entre ellos se puede colar algo pequeño)
      const n = Math.max(1, Math.round((z2 - z1) / 1.3));
      for (let i = 0; i <= n; i++) {
        const z = Math.min(z2 - 0.05, Math.max(z1 + 0.05, z1 + ((z2 - z1) * i) / n));
        statics.push(box(x - 0.6, 0, z - 0.05, x - 0.5, 4, z + 0.05, '#e67e22'));
        statics.push(box(x + 0.5, 0, z - 0.05, x + 0.6, 4, z + 0.05, '#e67e22'));
      }
      for (const y of [1.3, 2.6, 3.9]) statics.push(box(x - 0.6, y, z1, x + 0.6, y + 0.1, z2, '#34495e'));
      racks.push([x, z1, z2]);
    }
  }

  const props = [];
  const rand = rng(42);
  // lo que hay en las estanterías (todo cabe entre los postes y bajo el estante de arriba)
  const shelfTypes = ['crate', 'smallbox', 'smallbox', 'crate', 'barrel', 'tire', 'gift', 'suitcase', 'toiletpaper',
    'bucket', 'gascan', 'chest', 'teddy', 'ball', 'pumpkin', 'watermelon', 'radio', 'trophy'];
  for (const [x, z1, z2] of racks) {
    const n = Math.max(1, Math.round((z2 - z1) / 1.3));
    for (let i = 0; i < n; i++) {
      const z = +(z1 + ((i + 0.5) * (z2 - z1)) / n).toFixed(3);
      for (const y of [0.1, 1.4, 2.7]) {
        if (rand() < 0.4) continue;
        const t = shelfTypes[Math.floor(rand() * shelfTypes.length)];
        if (y > 0.1 && t === 'barrel') continue;
        const big = PROPS[t].size[0] > 0.8 || PROPS[t].size[2] > 0.8;
        props.push({ t, p: [x, y, z], r: big || rand() < 0.5 ? 0 : 0.15 });
      }
    }
  }

  props.push(
    // muelle y zona de carga
    { t: 'pallet', p: [-10, 0, -12.5], r: 0 },
    { t: 'crate', p: [-10, 0.15, -12.5], r: 0 },
    { t: 'pallet', p: [-7, 0, -12.5], r: 0 },
    { t: 'smallbox', p: [-7.3, 0.15, -12.2], r: 0 },
    { t: 'smallbox', p: [-6.7, 0.15, -12.75], r: 0 },
    { t: 'barrel', p: [-3, 0, -13.5], r: 0 },
    { t: 'barrel', p: [-2.1, 0, -13.5], r: 0 },
    { t: 'barrel', p: [-2.5, 0, -12.6], r: 0 },
    { t: 'cone', p: [2, 0, -10.6], r: 0 },
    { t: 'cone', p: [3.5, 0, -10.6], r: 0 },
    { t: 'cone', p: [-12, 0, -9.3], r: 0 },
    { t: 'tire', p: [10, 0, -13.5], r: 0 },
    { t: 'tire', p: [10, 0.3, -13.5], r: 0 },
    { t: 'tire', p: [10, 0.6, -13.5], r: 0 },
    { t: 'crate', p: [-17, 1.2, -13], r: 0 },
    { t: 'crate', p: [16, 1.2, -13], r: 0.4 },
    { t: 'smallbox', p: [17.5, 1.2, -12], r: 0 },
    // pasillos
    { t: 'crate', p: [-10.5, 0, 0], r: 0.1 },
    { t: 'barrel', p: [3.5, 0, 0.5], r: 0 },
    { t: 'cone', p: [-3.5, 0, -3], r: 0 },
    { t: 'pallet', p: [10.5, 0, -4], r: H },
    { t: 'crate', p: [10.5, 0.15, -4], r: 0 },
    { t: 'crate', p: [10.5, 1.15, -4], r: 0.3 },
    { t: 'trash', p: [-19.3, 0, 0], r: 0 },
    { t: 'smallbox', p: [14, 0, 2], r: 0.7 },
    { t: 'smallbox', p: [14.8, 0, 2.8], r: 0 },
    { t: 'barrel', p: [18.8, 0, -3], r: 0 },
    { t: 'barrel', p: [18.8, 0, -2], r: 0 },
    { t: 'barrel', p: [18.8, 0, 3], r: 0 },
    { t: 'crate', p: [-18.8, 0, 9], r: 0 },
    { t: 'crate', p: [-18.8, 0, 10], r: 0 },
    { t: 'crate', p: [-18.8, 1, 9.5], r: 0 },
    { t: 'tire', p: [-3, 0, 12], r: 0 },
    { t: 'cone', p: [5, 0, 10], r: 0 },
    { t: 'pallet', p: [0, 0, 12.5], r: 0 },
    // oficina
    { t: 'table', p: [16, 0, 12], r: 0 },
    { t: 'computer', p: [16, 0.8, 12], r: Math.PI },
    { t: 'chair', p: [16, 0, 13.2], r: Math.PI },
    { t: 'plant', p: [19.3, 0, 8.6], r: 0 },
    { t: 'lamp', p: [12.7, 0, 14.3], r: 0 },
    { t: 'bookshelf', p: [19.6, 0, 12], r: -H },
    { t: 'trash', p: [13, 0, 9], r: 0 },
    { t: 'fridge', p: [12.6, 0, 11], r: H },
    { t: 'sofa', p: [15, 0, 14.4], r: Math.PI },
    { t: 'whiteboard', p: [17.9, 0, 9.0], r: 0 },
    { t: 'trophy', p: [19.6, 2, 12], r: -H },
    { t: 'globe', p: [16.6, 0.8, 11.8], r: 0 },
    { t: 'radio', p: [15.45, 0.8, 12.2], r: 0 },
    { t: 'coatrack', p: [13.5, 0, 14.3], r: 0 },
    { t: 'backpack', p: [14.2, 0, 12.5], r: 0.5 },
    // zona de descanso
    { t: 'vending', p: [10.5, 0, 14.4], r: Math.PI },
    { t: 'watercooler', p: [9.3, 0, 14.6], r: Math.PI },
    { t: 'arcade', p: [8.3, 0, 14.4], r: Math.PI },
    { t: 'speaker', p: [7.3, 0, 14.6], r: Math.PI },
    // seguridad y carga
    { t: 'extinguisher', p: [-19.65, 0, 4], r: H },
    { t: 'extinguisher', p: [19.65, 0, 6], r: -H },
    { t: 'extinguisher', p: [0.5, 0, 14.7], r: Math.PI },
    { t: 'cart', p: [-5, 0, 10.5], r: 0.3 },
    { t: 'cart', p: [-6.1, 0, 11.6], r: 0.2 },
    { t: 'barrier', p: [-12, 0, -10.6], r: 0 },
    { t: 'barrier', p: [12, 0, -10.6], r: 0 },
    { t: 'gascan', p: [13, 0, -13.8], r: 0 },
    { t: 'gascan', p: [13.4, 0, -13.2], r: 0 },
    { t: 'haybale', p: [18.6, 1.2, -13.8], r: 0 },
    { t: 'toiletpaper', p: [-16, 1.2, -12], r: 0 },
  );

  return {
    id: 'almacen',
    name: 'El Almacén',
    desc: 'Estanterías enormes llenas de cajas, barriles y una oficina escondida.',
    bounds: [-20, -15, 20, 15],
    ground: '#7f8c8d',
    sky: '#2c3e50',
    indoor: true,
    spawns: {
      hider: [[-10.5, 4], [-3.5, 4], [3.5, 4], [10.5, 4], [-10.5, -4], [-3.5, -4], [3.5, -4], [16, 4]],
      seeker: [[-4, -12.5], [-1, -12.5], [1, -12.5], [3, -12.5]],
    },
    statics,
    props,
  };
}

// ---------------------------------------------------------------- PARQUE
function parque() {
  const statics = [
    ...fence(-30, -30, 30, 30, '#6e4b2a'),
    // caminos en cruz
    floor(-30, -1.5, 30, 1.5, '#d8c79a', 0.02),
    floor(-1.5, -30, 1.5, 30, '#d8c79a', 0.02),
    // estanque
    floor(10, 10, 22, 20, '#2e86c1', 0.03),
    // zona de juegos (arena)
    floor(-22, 10, -10, 22, '#f0d9a0', 0.03),
    // fuente central
    { cyl: [0, 0, 3, 0, 0.6], color: '#aab7b8' },
    { cyl: [0, 0, 0.5, 0, 2.2], color: '#d5dbdb' },
    // tobogán y columpio
    box(-18, 0, 14, -17, 2.2, 15, '#e74c3c'),
    box(-17, 0.2, 14, -13, 0.4, 15, '#f1c40f', { ramp: true }),
    box(-20.5, 0, 18, -20.3, 2.5, 18.2, '#3498db'),
    box(-15.7, 0, 18, -15.5, 2.5, 18.2, '#3498db'),
    box(-20.5, 2.4, 18, -15.5, 2.6, 18.2, '#3498db'),
    // quiosco
    ...wallX(-12, -22, -14, [[-19, -17]], 3, '#f5cba7'),
    ...wallX(-20, -22, -14, [], 3, '#f5cba7'),
    ...wallZ(-22, -20, -12, [], 3, '#f5cba7'),
    ...wallZ(-14, -20, -12, [[-17, -15]], 3, '#f5cba7'),
    floor(-22, -20, -14, -12, '#d35400', 0.03),
    // muro de piedra
    box(12, 0, -22, 22, 1.2, -21.4, '#95a5a6'),
    box(12, 0, -14, 22, 1.2, -13.4, '#95a5a6'),
    // escenario
    box(18, 0, -4, 28, 0.6, 4, '#a04000'),
  ];

  const props = [
    // alrededor de la fuente
    { t: 'bench', p: [4, 0, 4], r: -Math.PI / 4 },
    { t: 'bench', p: [-4, 0, 4], r: Math.PI / 4 },
    { t: 'bench', p: [4, 0, -4], r: Math.PI + Math.PI / 4 },
    { t: 'bench', p: [-4, 0, -4], r: Math.PI - Math.PI / 4 },
    { t: 'teddy', p: [4, 0.47, 4], r: -Math.PI / 4 },
    { t: 'backpack', p: [-3, 0, 5.2], r: 0.8 },
    { t: 'flowers', p: [6.5, 0, 6.5], r: 0 },
    { t: 'flowers', p: [-6.5, 0, -6.5], r: 0 },
    { t: 'flowers', p: [6.5, 0, -6.5], r: 0 },
    // farolas, papeleras y bocas de incendio junto a los caminos
    { t: 'streetlamp', p: [2.2, 0, 8], r: 0 },
    { t: 'streetlamp', p: [-2.2, 0, -8], r: 0 },
    { t: 'streetlamp', p: [8, 0, -2.2], r: 0 },
    { t: 'streetlamp', p: [-8, 0, 2.2], r: 0 },
    { t: 'streetlamp', p: [2.2, 0, -18], r: 0 },
    { t: 'streetlamp', p: [-2.2, 0, 18], r: 0 },
    { t: 'streetlamp', p: [-18, 0, -2.2], r: 0 },
    { t: 'streetlamp', p: [12, 0, 2.2], r: 0 },
    { t: 'hydrant', p: [2.1, 0, 15.5], r: 0 },
    { t: 'hydrant', p: [-15.5, 0, -2.1], r: H },
    { t: 'trash', p: [2.3, 0, 12], r: 0 },
    { t: 'trash', p: [-2.3, 0, -14], r: 0 },
    { t: 'trash', p: [-14, 0, 2.3], r: 0 },
    { t: 'bike', p: [6, 0, 1.95], r: H },
    { t: 'bike', p: [-1.95, 0, -12], r: 0 },
    // zona de juegos
    { t: 'ball', p: [-12, 0, 13], r: 0 },
    { t: 'ball', p: [-18, 0, 20], r: 0 },
    { t: 'chest', p: [-12, 0, 20.5], r: Math.PI },
    { t: 'bucket', p: [-13, 0, 11.5], r: 0 },
    { t: 'teddy', p: [-20.5, 0, 12.5], r: 0.5 },
    { t: 'tire', p: [-15, 0, 21], r: 0 },
    { t: 'tire', p: [-25, 0, 26], r: 0 },
    // estanque
    { t: 'duck', p: [14, 0.03, 14], r: 0.4 },
    { t: 'duck', p: [18, 0.03, 16], r: 2 },
    { t: 'duck', p: [12, 0.03, 18], r: 1 },
    // quiosco
    { t: 'mailbox', p: [-13.5, 0, -13], r: 0 },
    { t: 'vending', p: [-13.2, 0, -18.5], r: H },
    { t: 'smallbox', p: [-21, 0, -19], r: 0 },
    { t: 'smallbox', p: [-20.3, 0, -19.2], r: 0.4 },
    { t: 'crate', p: [-21.2, 0, -13], r: 0 },
    { t: 'table', p: [-18, 0, -16], r: 0 },
    { t: 'radio', p: [-18.3, 0.8, -16], r: 0 },
    { t: 'chair', p: [-18, 0, -14.8], r: Math.PI },
    { t: 'chair', p: [-18, 0, -17.2], r: 0 },
    { t: 'arcade', p: [-15, 0, -19.35], r: 0 },
    { t: 'watercooler', p: [-21.45, 0, -15.5], r: H },
    // obras entre los muros de piedra
    { t: 'cone', p: [20, 0, -18], r: 0 },
    { t: 'cone', p: [14, 0, -18], r: 0 },
    { t: 'barrier', p: [15.2, 0, -17.4], r: 0 },
    { t: 'barrier', p: [18.8, 0, -17.4], r: 0 },
    { t: 'wheelbarrow', p: [17, 0, -15.9], r: H },
    { t: 'haybale', p: [13.5, 0, -15.2], r: 0 },
    { t: 'gascan', p: [21, 0, -15], r: 0 },
    // escenario con grupo de música
    { t: 'chair', p: [21, 0.6, 2], r: -H },
    { t: 'chair', p: [21, 0.6, -2], r: -H },
    { t: 'lamp', p: [27, 0.6, 3.3], r: 0 },
    { t: 'lamp', p: [27, 0.6, -3.3], r: 0 },
    { t: 'tv', p: [26.5, 0.6, 0], r: -H },
    { t: 'drum', p: [24.5, 0.6, -2], r: 0 },
    { t: 'speaker', p: [27.3, 0.6, 1.8], r: -H },
    { t: 'speaker', p: [27.3, 0.6, -1.8], r: -H },
    { t: 'guitar', p: [23.5, 0.6, 2.5], r: -H },
    { t: 'piano', p: [25, 0.6, 3.3], r: Math.PI },
    // pícnic, granja y rincones
    { t: 'table', p: [-8, 0, -20], r: 0 },
    { t: 'watermelon', p: [-8, 0.8, -20], r: 0.4 },
    { t: 'bench', p: [-8, 0, -21.2], r: 0 },
    { t: 'cart', p: [10, 0, -8], r: 0.5 },
    { t: 'doghouse', p: [26, 0, 20], r: -H },
    { t: 'haybale', p: [25, 0, 22.5], r: 0 },
    { t: 'haybale', p: [25.3, 0.72, 22.5], r: 0.2 },
    { t: 'wheelbarrow', p: [23.3, 0, 24.5], r: 0 },
    { t: 'barrel', p: [25, 0, 26], r: 0 },
    { t: 'barrel', p: [26, 0, 25], r: 0 },
    { t: 'pumpkin', p: [27, 0, -26.5], r: 0 },
    { t: 'pumpkin', p: [25.8, 0, -27.2], r: 1 },
    { t: 'snowman', p: [-27, 0, 15], r: 0.6 },
    { t: 'gnome', p: [6, 0, 9], r: 0.3 },
    { t: 'gnome', p: [-7, 0, -9], r: 2 },
    { t: 'gnome', p: [9, 0, -24], r: -0.5 },
    { t: 'mushroom', p: [-25, 0, 3], r: 0 },
    { t: 'mushroom', p: [-26, 0, 4.5], r: 1 },
    { t: 'mushroom', p: [24, 0, 12], r: 0 },
    { t: 'mushroom', p: [-6, 0, -25], r: 2 },
    { t: 'cactus', p: [28, 0, -10], r: 0 },
    { t: 'bench', p: [16, 0, 8], r: 0 },
    { t: 'bench', p: [-25, 0, -5], r: H },
  ];

  const spawns = {
    hider: [[5, 5], [-5, 5], [5, -5], [-5, -5], [10, 0], [-10, 0], [0, 10], [0, -10]],
    seeker: [[-26, -26], [-24, -26], [-26, -24], [-24, -24]],
  };

  // árboles, arbustos y rocas repartidos con semilla, sin pisar caminos, zonas ocupadas ni otros objetos
  const rand = rng(7);
  const busy = [[-23, -21, -12, -11], [9, 9, 23, 21], [-23, 9, -9, 23], [17, -5, 29, 5], [11, -23, 23, -13], [-4, -4, 4, 4]];
  const free = (x, z) => Math.abs(x) > 2.8 && Math.abs(z) > 2.8 && !busy.some(([a, b, c, d]) => x > a && x < c && z > b && z < d);
  const occupied = props.map((q) => [q.p[0], q.p[2], Math.max(PROPS[q.t].size[0], PROPS[q.t].size[2]) / 2]);
  for (const [x, z] of [...spawns.hider, ...spawns.seeker]) occupied.push([x, z, 0.6]);
  const tryPlace = (t, n, gap) => {
    const radius = Math.max(PROPS[t].size[0], PROPS[t].size[2]) / 2;
    let tries = 0;
    while (n > 0 && tries++ < 3000) {
      const x = -28 + rand() * 56;
      const z = -28 + rand() * 56;
      if (!free(x, z)) continue;
      if (occupied.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + radius + gap)) continue;
      occupied.push([x, z, radius]);
      props.push({ t, p: [+x.toFixed(2), 0, +z.toFixed(2)], r: +(rand() * Math.PI * 2).toFixed(2) });
      n--;
    }
  };
  tryPlace('tree', 26, 2.2);
  tryPlace('bush', 30, 0.9);
  tryPlace('rock', 14, 0.9);

  return {
    id: 'parque',
    name: 'El Parque',
    desc: 'Exterior enorme con árboles, arbustos, estanque, quiosco y escenario.',
    bounds: [-30, -30, 30, 30],
    ground: '#58b14c',
    sky: '#9fd8ff',
    spawns,
    statics,
    props,
  };
}

export const MAPS = { casa: casa(), almacen: almacen(), parque: parque() };
export const MAP_KEYS = Object.keys(MAPS);
