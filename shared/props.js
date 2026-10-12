// Catálogo de objetos en los que se pueden disfrazar los escondidos.
// size = [ancho, alto, fondo] en metros (se usa para colisiones y para la cámara).
export const PROPS = {
  crate:     { name: 'Caja de madera', size: [1, 1, 1] },
  smallbox:  { name: 'Caja de cartón', size: [0.6, 0.5, 0.6] },
  barrel:    { name: 'Barril', size: [0.8, 1.1, 0.8] },
  chair:     { name: 'Silla', size: [0.6, 1.0, 0.6] },
  table:     { name: 'Mesa', size: [1.6, 0.8, 1.0] },
  plant:     { name: 'Planta', size: [0.6, 1.2, 0.6] },
  lamp:      { name: 'Lámpara', size: [0.5, 1.7, 0.5] },
  sofa:      { name: 'Sofá', size: [2.0, 0.9, 0.9] },
  tv:        { name: 'Televisión', size: [1.2, 1.1, 0.5] },
  bookshelf: { name: 'Estantería', size: [1.2, 2.0, 0.4] },
  trash:     { name: 'Papelera', size: [0.5, 0.8, 0.5] },
  cone:      { name: 'Cono', size: [0.5, 0.7, 0.5] },
  tire:      { name: 'Neumático', size: [0.8, 0.35, 0.8] },
  bench:     { name: 'Banco', size: [1.8, 0.8, 0.6] },
  fridge:    { name: 'Nevera', size: [0.8, 1.9, 0.7] },
  washer:    { name: 'Lavadora', size: [0.7, 0.9, 0.7] },
  toilet:    { name: 'Váter', size: [0.5, 0.8, 0.7] },
  bed:       { name: 'Cama', size: [1.6, 0.6, 2.1] },
  pallet:    { name: 'Palé', size: [1.2, 0.15, 1.0] },
  tree:      { name: 'Árbol', size: [1.6, 4.0, 1.6], col: [0.5, 4.0, 0.5] },
  bush:      { name: 'Arbusto', size: [1.2, 1.0, 1.2] },
  rock:      { name: 'Roca', size: [1.0, 0.7, 0.9] },
  mailbox:   { name: 'Buzón', size: [0.4, 1.2, 0.4] },
  computer:  { name: 'Ordenador', size: [0.6, 0.5, 0.4] },
  ball:      { name: 'Pelota', size: [0.5, 0.5, 0.5] },
  duck:      { name: 'Patito de goma', size: [0.4, 0.4, 0.5] },
};

export const PROP_KEYS = Object.keys(PROPS);

// Tamaño de colisión (huella en el suelo) de un objeto, teniendo en cuenta la rotación.
export function propFootprint(type, rot = 0) {
  const def = PROPS[type];
  if (!def) return [0.8, 1.8, 0.8];
  const s = def.col || def.size;
  const quarter = Math.round(rot / (Math.PI / 2)) % 2 !== 0;
  return quarter ? [s[2], s[1], s[0]] : [s[0], s[1], s[2]];
}
