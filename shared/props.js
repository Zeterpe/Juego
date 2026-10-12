// Catálogo de objetos en los que se pueden disfrazar los escondidos.
// size = [ancho, alto, fondo] en metros (se usa para colisiones y para la cámara).
export const PROPS = {
  crate:     { name: 'Caja de madera', size: [1, 1, 1] },
  smallbox:  { name: 'Caja de cartón', size: [0.6, 0.5, 0.6] },
  barrel:    { name: 'Barril', size: [0.8, 1.1, 0.8] },
  chair:     { name: 'Silla', size: [0.55, 1.02, 0.56] },
  table:     { name: 'Mesa', size: [1.6, 0.8, 1.0] },
  plant:     { name: 'Planta', size: [0.58, 1.15, 0.54] },
  lamp:      { name: 'Lámpara', size: [0.5, 1.7, 0.5] },
  sofa:      { name: 'Sofá', size: [2, 0.85, 0.9] },
  tv:        { name: 'Televisión', size: [1.2, 1.09, 0.45] },
  bookshelf: { name: 'Estantería', size: [1.2, 2.0, 0.4] },
  trash:     { name: 'Papelera', size: [0.5, 0.8, 0.5] },
  cone:      { name: 'Cono', size: [0.5, 0.7, 0.5] },
  tire:      { name: 'Neumático', size: [0.84, 0.3, 0.84] },
  bench:     { name: 'Banco', size: [1.8, 0.8, 0.6] },
  fridge:    { name: 'Nevera', size: [0.8, 1.9, 0.7] },
  washer:    { name: 'Lavadora', size: [0.7, 0.9, 0.7] },
  toilet:    { name: 'Váter', size: [0.45, 0.82, 0.65] },
  bed:       { name: 'Cama', size: [1.6, 0.9, 2.14] },
  pallet:    { name: 'Palé', size: [1.2, 0.15, 1.0] },
  tree:      { name: 'Árbol', size: [1.75, 3.81, 1.62], col: [0.5, 3.8, 0.5] },
  bush:      { name: 'Arbusto', size: [1.35, 1.1, 1.1] },
  rock:      { name: 'Roca', size: [1.02, 0.7, 0.84] },
  mailbox:   { name: 'Buzón', size: [0.38, 1.37, 0.4] },
  computer:  { name: 'Ordenador', size: [0.5, 0.46, 0.26] },
  ball:      { name: 'Pelota', size: [0.56, 0.5, 0.56] },
  duck:      { name: 'Patito de goma', size: [0.4, 0.4, 0.5] },
  // --- casa
  microwave:   { name: 'Microondas', size: [0.6, 0.35, 0.41] },
  stove:       { name: 'Horno', size: [0.7, 0.92, 0.67] },
  toaster:     { name: 'Tostadora', size: [0.33, 0.28, 0.18] },
  teddy:       { name: 'Osito de peluche', size: [0.48, 0.61, 0.33] },
  guitar:      { name: 'Guitarra', size: [0.36, 1.05, 0.25] },
  piano:       { name: 'Piano', size: [1.5, 1.25, 0.6] },
  clock:       { name: 'Reloj de pie', size: [0.55, 2, 0.4] },
  vase:        { name: 'Jarrón', size: [0.37, 0.62, 0.37] },
  armchair:    { name: 'Sillón', size: [0.96, 0.95, 0.82] },
  nightstand:  { name: 'Mesita de noche', size: [0.5, 0.5, 0.43] },
  coatrack:    { name: 'Perchero', size: [0.47, 1.81, 0.48] },
  globe:       { name: 'Bola del mundo', size: [0.4, 0.59, 0.34] },
  trophy:      { name: 'Trofeo', size: [0.41, 0.38, 0.26] },
  radio:       { name: 'Radio', size: [0.5, 0.31, 0.17] },
  speaker:     { name: 'Altavoz', size: [0.5, 1, 0.47] },
  suitcase:    { name: 'Maleta', size: [0.55, 0.73, 0.25] },
  backpack:    { name: 'Mochila', size: [0.38, 0.53, 0.28] },
  gift:        { name: 'Regalo', size: [0.52, 0.61, 0.52] },
  toiletpaper: { name: 'Rollo de papel', size: [0.26, 0.26, 0.26] },
  bucket:      { name: 'Cubo', size: [0.34, 0.51, 0.34] },
  arcade:      { name: 'Máquina recreativa', size: [0.8, 1.8, 0.86] },
  drum:        { name: 'Tambor', size: [0.6, 0.64, 0.6] },
  watermelon:  { name: 'Sandía', size: [0.6, 0.44, 0.44] },
  // --- exterior
  snowman:     { name: 'Muñeco de nieve', size: [1.03, 1.73, 0.8], col: [0.8, 1.73, 0.8] },
  hydrant:     { name: 'Boca de incendios', size: [0.4, 0.78, 0.35] },
  bike:        { name: 'Bicicleta', size: [0.5, 0.96, 1.65] },
  cactus:      { name: 'Cactus', size: [0.56, 1.26, 0.4] },
  flowers:     { name: 'Maceta con flores', size: [0.36, 0.6, 0.36] },
  gnome:       { name: 'Gnomo de jardín', size: [0.32, 0.75, 0.34] },
  pumpkin:     { name: 'Calabaza', size: [0.55, 0.53, 0.56] },
  mushroom:    { name: 'Seta gigante', size: [0.6, 0.54, 0.6] },
  doghouse:    { name: 'Caseta de perro', size: [1.11, 1.08, 1.32] },
  haybale:     { name: 'Fardo de paja', size: [1.2, 0.72, 0.81] },
  wheelbarrow: { name: 'Carretilla', size: [0.64, 0.68, 1.55] },
  streetlamp:  { name: 'Farola', size: [0.4, 3, 0.4], col: [0.3, 3.0, 0.3] },
  chest:       { name: 'Cofre del tesoro', size: [0.9, 0.77, 0.64] },
  // --- almacén y tiendas
  vending:     { name: 'Máquina expendedora', size: [1, 1.9, 0.87] },
  watercooler: { name: 'Fuente de agua', size: [0.34, 1.23, 0.39] },
  whiteboard:  { name: 'Pizarra', size: [1.56, 1.67, 0.5] },
  cart:        { name: 'Carrito de la compra', size: [0.6, 1.02, 0.86] },
  gascan:      { name: 'Bombona de butano', size: [0.32, 0.72, 0.32] },
  barrier:     { name: 'Valla de obra', size: [1.5, 1.05, 0.4] },
  extinguisher:{ name: 'Extintor', size: [0.23, 0.63, 0.2] },
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
