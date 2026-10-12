// Comprueba que los mapas y los objetos están bien montados:
// - cada objeto tiene modelo 3D y su tamaño declarado coincide con el modelo,
// - ningún objeto del suelo atraviesa paredes ni otros objetos,
// - todo está dentro del mapa y los puntos de aparición están libres,
// - los bots pueden ir andando de cualquier punto de aparición a cualquier otro.
// Uso: node test/maps.js   (añade --tamaños para ver la tabla de medidas)
import * as THREE from 'three';
import { MAPS } from '../shared/maps.js';
import { PROPS } from '../shared/props.js';
import { buildColliders, collidesAny, bodyBox } from '../shared/physics.js';
import { buildNav, findPath, cellOf } from '../shared/nav.js';
import { buildProp, MODEL_TYPES } from '../public/js/models.js';

const errors = [];
const r2 = (v) => Math.round(v * 100) / 100;

// 1) modelos y tamaños
const TOL = 0.05;
for (const k of Object.keys(PROPS)) {
  if (!MODEL_TYPES.includes(k)) { errors.push(`El objeto "${k}" no tiene modelo 3D`); continue; }
  const g = buildProp(k);
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g, true);
  const s = b.getSize(new THREE.Vector3());
  const d = PROPS[k].size;
  const off = [Math.abs(s.x - d[0]), Math.abs(s.y - d[1]), Math.abs(s.z - d[2])];
  if (process.argv.includes('--tamaños')) console.log(`${k.padEnd(13)} modelo [${r2(s.x)}, ${r2(s.y)}, ${r2(s.z)}]  declarado [${d.join(', ')}]  suelo ${r2(b.min.y)}`);
  if (off.some((o) => o > TOL)) errors.push(`"${k}": el modelo mide [${r2(s.x)}, ${r2(s.y)}, ${r2(s.z)}] pero está declarado como [${d.join(', ')}]`);
  if (b.min.y < -0.08) errors.push(`"${k}": el modelo se hunde en el suelo (${r2(b.min.y)})`);
}

// 2) mapas
function rotatedBox(p) {
  const def = PROPS[p.t];
  const [w, h, d] = def.col || def.size;
  const c = Math.cos(p.r || 0);
  const s = Math.sin(p.r || 0);
  const hw = (Math.abs(c) * w + Math.abs(s) * d) / 2;
  const hd = (Math.abs(s) * w + Math.abs(c) * d) / 2;
  return [p.p[0] - hw, p.p[1], p.p[2] - hd, p.p[0] + hw, p.p[1] + h, p.p[2] + hd];
}
const shrink = (b, e = 0.02) => [b[0] + e, b[1] + e, b[2] + e, b[3] - e, b[4] - e, b[5] - e];
const hit = (a, b) => a[0] < b[3] && a[3] > b[0] && a[1] < b[4] && a[4] > b[1] && a[2] < b[5] && a[5] > b[2];

for (const map of Object.values(MAPS)) {
  const statics = map.statics.filter((s) => !s.nocol).map((s) => {
    if (s.box) return s.box;
    const [x, z, r, y1, y2] = s.cyl;
    return [x - r, y1, z - r, x + r, y2, z + r];
  });
  const [bx1, bz1, bx2, bz2] = map.bounds;
  const boxes = map.props.map((p) => {
    if (!PROPS[p.t]) errors.push(`${map.id}: tipo desconocido "${p.t}"`);
    return PROPS[p.t] ? shrink(rotatedBox(p)) : null;
  });
  map.props.forEach((p, i) => {
    const b = boxes[i];
    if (!b) return;
    const where = `${map.id}: ${p.t} en [${p.p.join(', ')}]`;
    if (b[0] < bx1 || b[3] > bx2 || b[2] < bz1 || b[5] > bz2) errors.push(`${where} se sale del mapa`);
    for (const s of statics) if (hit(b, s)) errors.push(`${where} atraviesa una pared/estructura [${s.map(r2).join(', ')}]`);
    // los objetos colocados encima de otros (y > 0) son decoración: pueden tocar al de abajo
    if (p.p[1] > 0) return;
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[j] && map.props[j].p[1] === 0 && hit(b, boxes[j])) errors.push(`${where} se solapa con ${map.props[j].t} en [${map.props[j].p.join(', ')}]`);
    }
  });
  // puntos de aparición libres (con un poco de margen)
  const colliders = buildColliders(map);
  for (const [kind, list] of Object.entries(map.spawns)) {
    for (const [x, z] of list) {
      if (collidesAny(colliders, bodyBox(x, 0.01, z, 0.35, 1.8))) errors.push(`${map.id}: aparición de ${kind} en [${x}, ${z}] está ocupada`);
    }
  }
  // navegación de los bots: las apariciones están en la zona transitable y hay camino entre todas
  const nav = buildNav(map, colliders);
  const spawns = [...map.spawns.hider, ...map.spawns.seeker];
  for (const [x, z] of spawns) {
    const c = cellOf(nav, x, z);
    if (c < 0 || !nav.walk[c] || nav.comp[c] !== nav.main) errors.push(`${map.id}: los bots no pueden llegar a la aparición [${x}, ${z}]`);
  }
  for (const a of spawns) {
    for (const b of spawns) if (!findPath(nav, a[0], a[1], b[0], b[1])) errors.push(`${map.id}: no hay camino de [${a}] a [${b}]`);
  }
  const share = Math.round((nav.walkable / (nav.nx * nav.nz)) * 100);
  console.log(`  ${map.name}: ${map.props.length} objetos, ${new Set(map.props.map((p) => p.t)).size} tipos distintos, ${share}% del suelo transitable`);
}

console.log(`  Catálogo: ${Object.keys(PROPS).length} objetos para disfrazarse`);
if (errors.length) {
  console.log(`\n✗ ${errors.length} problema(s):\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
console.log('✓ Mapas y objetos correctos');
