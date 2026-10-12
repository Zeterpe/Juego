// Colisiones sencillas con cajas alineadas a los ejes (AABB). Compartido por servidor y cliente.
import { propFootprint } from './props.js';

export function buildColliders(map) {
  const out = [];
  for (const s of map.statics) {
    if (s.nocol) continue;
    if (s.box) out.push(s.box.slice());
    else if (s.cyl) {
      const [x, z, r, y1, y2] = s.cyl;
      out.push([x - r * 0.85, y1, z - r * 0.85, x + r * 0.85, y2, z + r * 0.85]);
    }
  }
  for (const p of map.props) {
    const [w, h, d] = propFootprint(p.t, p.r);
    const [x, y, z] = p.p;
    out.push([x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2]);
  }
  const [bx1, bz1, bx2, bz2] = map.bounds;
  // límites invisibles del mapa
  out.push([bx1 - 5, -1, bz1 - 5, bx1, 50, bz2 + 5]);
  out.push([bx2, -1, bz1 - 5, bx2 + 5, 50, bz2 + 5]);
  out.push([bx1 - 5, -1, bz1 - 5, bx2 + 5, 50, bz1]);
  out.push([bx1 - 5, -1, bz2, bx2 + 5, 50, bz2 + 5]);
  return out;
}

export function overlaps(a, b) {
  return a[0] < b[3] && a[3] > b[0] && a[1] < b[4] && a[4] > b[1] && a[2] < b[5] && a[5] > b[2];
}

export function bodyBox(x, y, z, r, h) {
  return [x - r, y, z - r, x + r, y + h, z + r];
}

export function collidesAny(colliders, aabb) {
  for (const c of colliders) if (overlaps(c, aabb)) return c;
  return null;
}

const STEP = 0.45;

// Mueve un cuerpo (cilindro aproximado a caja) resolviendo colisiones eje a eje.
// body = { x, y, z, vy, r, h, onGround }. Devuelve el cuerpo modificado.
export function moveBody(colliders, body, dx, dz, dt, gravity = 1) {
  const { r, h } = body;

  // eje X
  if (dx !== 0) {
    const nx = body.x + dx;
    const hit = collidesAny(colliders, bodyBox(nx, body.y + 0.001, body.z, r, h));
    if (!hit) body.x = nx;
    else if (hit[4] - body.y <= STEP && body.onGround && !collidesAny(colliders, bodyBox(nx, hit[4] + 0.001, body.z, r, h))) {
      body.x = nx; body.y = hit[4];
    }
  }
  // eje Z
  if (dz !== 0) {
    const nz = body.z + dz;
    const hit = collidesAny(colliders, bodyBox(body.x, body.y + 0.001, nz, r, h));
    if (!hit) body.z = nz;
    else if (hit[4] - body.y <= STEP && body.onGround && !collidesAny(colliders, bodyBox(body.x, hit[4] + 0.001, nz, r, h))) {
      body.z = nz; body.y = hit[4];
    }
  }
  // eje Y (gravedad)
  body.vy -= 22 * gravity * dt;
  if (body.vy < -30) body.vy = -30;
  const ny = body.y + body.vy * dt;
  body.onGround = false;
  if (body.vy <= 0) {
    if (ny <= 0) { body.y = 0; body.vy = 0; body.onGround = true; }
    else {
      const hit = collidesAny(colliders, bodyBox(body.x, ny, body.z, r, h));
      if (hit) { body.y = hit[4]; body.vy = 0; body.onGround = true; }
      else body.y = ny;
    }
  } else {
    const hit = collidesAny(colliders, bodyBox(body.x, ny, body.z, r, h));
    if (hit) { body.vy = 0; } else body.y = ny;
  }
  return body;
}

// Busca un hueco libre cerca de (x, z) para colocar un cuerpo.
export function findFreeSpot(colliders, x, z, r, h, rand = Math.random) {
  if (!collidesAny(colliders, bodyBox(x, 0.01, z, r, h))) return [x, z];
  for (let i = 0; i < 60; i++) {
    const a = rand() * Math.PI * 2;
    const d = 0.5 + (i / 60) * 4;
    const nx = x + Math.cos(a) * d;
    const nz = z + Math.sin(a) * d;
    if (!collidesAny(colliders, bodyBox(nx, 0.01, nz, r, h))) return [nx, nz];
  }
  return [x, z];
}
