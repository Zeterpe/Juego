// Navegación para los bots: una rejilla del suelo que dice por dónde se puede andar,
// caminos con A* y comprobaciones de línea de visión. La usan el servidor y las pruebas.
import { overlaps, bodyBox } from './physics.js';

const CELL = 0.5; // tamaño de cada casilla de la rejilla (m)
const BUCKET = 4; // casillas gruesas para encontrar rápido los obstáculos cercanos
const PAD = 0.8; // margen al repartir obstáculos en casillas gruesas (mayor que cualquier radio de cuerpo)
export const NAV_R = 0.3; // radio de un bot andando
const BODY_H = 1.7;

export function buildNav(map, colliders) {
  const [x1, z1, x2, z2] = map.bounds;
  const nav = {
    x1, z1, x2, z2,
    cell: CELL,
    nx: Math.floor((x2 - x1) / CELL),
    nz: Math.floor((z2 - z1) / CELL),
    all: colliders,
    bw: Math.ceil((x2 - x1) / BUCKET),
    bh: Math.ceil((z2 - z1) / BUCKET),
  };
  // obstáculos que estorban a alguien de pie (los dinteles de las puertas no)
  nav.solid = colliders.filter((c) => c[1] < BODY_H && c[4] > 0.02);
  nav.buckets = Array.from({ length: nav.bw * nav.bh }, () => []);
  for (const c of nav.solid) {
    const i1 = clampI(Math.floor((c[0] - PAD - x1) / BUCKET), nav.bw);
    const i2 = clampI(Math.floor((c[3] + PAD - x1) / BUCKET), nav.bw);
    const j1 = clampI(Math.floor((c[2] - PAD - z1) / BUCKET), nav.bh);
    const j2 = clampI(Math.floor((c[5] + PAD - z1) / BUCKET), nav.bh);
    for (let j = j1; j <= j2; j++) for (let i = i1; i <= i2; i++) nav.buckets[j * nav.bw + i].push(c);
  }
  const n = nav.nx * nav.nz;
  nav.walk = new Uint8Array(n);
  for (let j = 0; j < nav.nz; j++) {
    for (let i = 0; i < nav.nx; i++) {
      const [x, z] = cellCenter(nav, j * nav.nx + i);
      nav.walk[j * nav.nx + i] = blocked(nav, x, z) ? 0 : 1;
    }
  }
  labelComponents(nav);
  // memoria reutilizable para A*
  nav.g = new Float32Array(n);
  nav.from = new Int32Array(n);
  nav.stamp = new Uint32Array(n);
  nav.closed = new Uint32Array(n);
  nav.gen = 0;
  return nav;
}

const clampI = (v, n) => Math.max(0, Math.min(n - 1, v));

export function cellOf(nav, x, z) {
  const i = Math.floor((x - nav.x1) / nav.cell);
  const j = Math.floor((z - nav.z1) / nav.cell);
  if (i < 0 || j < 0 || i >= nav.nx || j >= nav.nz) return -1;
  return j * nav.nx + i;
}

export function cellCenter(nav, idx) {
  const i = idx % nav.nx;
  const j = (idx - i) / nav.nx;
  return [nav.x1 + (i + 0.5) * nav.cell, nav.z1 + (j + 0.5) * nav.cell];
}

// ¿choca un cuerpo de radio r puesto de pie en (x, z)?
export function blocked(nav, x, z, r = NAV_R, h = BODY_H) {
  const i = clampI(Math.floor((x - nav.x1) / BUCKET), nav.bw);
  const j = clampI(Math.floor((z - nav.z1) / BUCKET), nav.bh);
  const box = bodyBox(x, 0.01, z, r, h);
  for (const c of nav.buckets[j * nav.bw + i]) if (overlaps(c, box)) return true;
  return false;
}

// ¿choca una caja [x1, y1, z1, x2, y2, z2] con el mapa?
export function boxBlocked(nav, box) {
  const i1 = clampI(Math.floor((box[0] - nav.x1) / BUCKET), nav.bw);
  const i2 = clampI(Math.floor((box[3] - nav.x1) / BUCKET), nav.bw);
  const j1 = clampI(Math.floor((box[2] - nav.z1) / BUCKET), nav.bh);
  const j2 = clampI(Math.floor((box[5] - nav.z1) / BUCKET), nav.bh);
  for (let j = j1; j <= j2; j++) {
    for (let i = i1; i <= i2; i++) {
      for (const c of nav.buckets[j * nav.bw + i]) if (overlaps(c, box)) return true;
    }
  }
  return false;
}

// ¿se puede ir andando en línea recta de a a b?
export function segmentClear(nav, ax, az, bx, bz, r = NAV_R) {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(len / 0.2));
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    if (blocked(nav, ax + (bx - ax) * t, az + (bz - az) * t, r)) return false;
  }
  return true;
}

// ¿hay algo sólido entre los puntos a y b? (paredes, muebles... los jugadores no tapan)
export function lineOfSight(nav, a, b) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const lo = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];
  const hi = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
  for (const c of nav.all) {
    if (c[0] > hi[0] || c[3] < lo[0] || c[1] > hi[1] || c[4] < lo[1] || c[2] > hi[2] || c[5] < lo[2]) continue;
    const t = segBox(a, d, c);
    if (t !== null && t > 0.001 && t < 0.98) return false;
  }
  return true;
}

// primer punto (0..1) donde el segmento a + d·t toca la caja, o null
export function segBox(a, d, c) {
  let tmin = 0;
  let tmax = 1;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-9) {
      if (a[k] < c[k] || a[k] > c[k + 3]) return null;
    } else {
      let t1 = (c[k] - a[k]) / d[k];
      let t2 = (c[k + 3] - a[k]) / d[k];
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

// casilla transitable más cercana (o -1 si no hay ninguna cerca)
export function nearestWalkable(nav, x, z, maxRing = 10) {
  const i0 = Math.max(0, Math.min(nav.nx - 1, Math.floor((x - nav.x1) / nav.cell)));
  const j0 = Math.max(0, Math.min(nav.nz - 1, Math.floor((z - nav.z1) / nav.cell)));
  let best = -1;
  let bestD = Infinity;
  for (let ring = 0; ring <= maxRing; ring++) {
    for (let j = j0 - ring; j <= j0 + ring; j++) {
      for (let i = i0 - ring; i <= i0 + ring; i++) {
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== ring) continue;
        if (i < 0 || j < 0 || i >= nav.nx || j >= nav.nz) continue;
        const idx = j * nav.nx + i;
        if (!nav.walk[idx] || nav.comp[idx] !== nav.main) continue;
        const [cx, cz] = cellCenter(nav, idx);
        const d = (cx - x) ** 2 + (cz - z) ** 2;
        if (d < bestD) { bestD = d; best = idx; }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

export function randomWalkable(nav, rand = Math.random) {
  for (let k = 0; k < 400; k++) {
    const idx = Math.floor(rand() * nav.nx * nav.nz);
    if (nav.walk[idx] && nav.comp[idx] === nav.main) return idx;
  }
  return nearestWalkable(nav, (nav.x1 + nav.x2) / 2, (nav.z1 + nav.z2) / 2, 60);
}

// Zonas conectadas: la más grande es por donde se mueven los bots.
function labelComponents(nav) {
  const n = nav.nx * nav.nz;
  nav.comp = new Int32Array(n).fill(-1);
  const sizes = [];
  const queue = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (!nav.walk[s] || nav.comp[s] >= 0) continue;
    const id = sizes.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = s;
    nav.comp[s] = id;
    while (head < tail) {
      const c = queue[head++];
      for (const nb of neighbours(nav, c)) {
        if (nav.comp[nb[0]] < 0) { nav.comp[nb[0]] = id; queue[tail++] = nb[0]; }
      }
    }
    sizes.push(tail);
  }
  nav.main = sizes.length ? sizes.indexOf(Math.max(...sizes)) : -1;
  nav.walkable = sizes.length ? Math.max(...sizes) : 0;
}

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

// vecinos transitables; en diagonal solo si no se corta una esquina
function neighbours(nav, idx) {
  const out = [];
  const i = idx % nav.nx;
  const j = (idx - i) / nav.nx;
  for (const [di, dj, cost] of DIRS) {
    const ni = i + di;
    const nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= nav.nx || nj >= nav.nz) continue;
    const nidx = nj * nav.nx + ni;
    if (!nav.walk[nidx]) continue;
    if (di && dj && (!nav.walk[j * nav.nx + ni] || !nav.walk[nj * nav.nx + i])) continue;
    out.push([nidx, cost]);
  }
  return out;
}

// Camino de (sx, sz) a (tx, tz): lista de puntos [x, z] ya suavizada, o null si no se puede llegar.
export function findPath(nav, sx, sz, tx, tz) {
  const s = nearestWalkable(nav, sx, sz);
  const t = nearestWalkable(nav, tx, tz);
  if (s < 0 || t < 0) return null;
  const gen = ++nav.gen;
  const { g, from, stamp, closed } = nav;
  const ti = t % nav.nx;
  const tj = (t - ti) / nav.nx;
  const h = (idx) => {
    const i = idx % nav.nx;
    const dx = Math.abs(i - ti);
    const dz = Math.abs((idx - i) / nav.nx - tj);
    return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
  };
  const heap = new Heap();
  stamp[s] = gen; g[s] = 0; from[s] = -1;
  heap.push(s, h(s));
  let found = false;
  while (heap.size) {
    const c = heap.pop();
    if (closed[c] === gen) continue;
    closed[c] = gen;
    if (c === t) { found = true; break; }
    for (const [nb, cost] of neighbours(nav, c)) {
      if (closed[nb] === gen) continue;
      const ng = g[c] + cost;
      if (stamp[nb] !== gen || ng < g[nb]) {
        stamp[nb] = gen; g[nb] = ng; from[nb] = c;
        heap.push(nb, ng + h(nb));
      }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let c = t; c !== -1; c = from[c]) cells.push(c);
  cells.reverse();
  const pts = cells.map((c) => cellCenter(nav, c));
  pts[0] = [sx, sz];
  if (!blocked(nav, tx, tz)) pts.push([tx, tz]);
  return smooth(nav, pts);
}

// quita los zigzags de la rejilla: va en línea recta mientras no choque con nada
function smooth(nav, pts) {
  if (pts.length <= 2) return pts.slice(1);
  const out = [];
  let i = 0;
  while (i < pts.length - 1) {
    let j = i + 1;
    while (j + 1 < pts.length && segmentClear(nav, pts[i][0], pts[i][1], pts[j + 1][0], pts[j + 1][1])) j++;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

class Heap {
  constructor() { this.items = []; this.keys = []; }
  get size() { return this.items.length; }
  push(item, key) {
    const a = this.items;
    const k = this.keys;
    let n = a.length;
    a.push(item); k.push(key);
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (k[p] <= key) break;
      a[n] = a[p]; k[n] = k[p];
      n = p;
    }
    a[n] = item; k[n] = key;
  }
  pop() {
    const a = this.items;
    const k = this.keys;
    const top = a[0];
    const lastItem = a.pop();
    const lastKey = k.pop();
    if (a.length) {
      let n = 0;
      for (;;) {
        const l = 2 * n + 1;
        const r = l + 1;
        let m = n;
        let mk = lastKey;
        if (l < a.length && k[l] < mk) { m = l; mk = k[l]; }
        if (r < a.length && k[r] < mk) { m = r; mk = k[r]; }
        if (m === n) break;
        a[n] = a[m]; k[n] = k[m];
        n = m;
      }
      a[n] = lastItem; k[n] = lastKey;
    }
    return top;
  }
}
