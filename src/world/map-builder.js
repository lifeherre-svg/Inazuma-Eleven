// Construye mapas de tiles a partir de especificaciones declarativas
// (data/maps.js). Así añadir un mapa no exige dibujar miles de tiles a mano.
//
// Operaciones soportadas en `ops`:
//   ['fill', tile, x, y, w, h]
//   ['border', tile, thickness?]
//   ['building', x, y, w, h, { label, roof, door: dx, doorSide: 'bottom'|'top' }]
//   ['field', x, y, w, h, label?]   campo de fútbol decorativo (transitable)
//   ['scatter', tile, [[x,y], ...]]

import { T, SOLID } from './tiles.js';

export function buildMap(spec) {
  const { w, h } = spec;
  const base = T[(spec.base || 'GRASS').toUpperCase()] ?? T.GRASS;
  const tiles = new Uint8Array(w * h).fill(base);
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = t; };
  const fill = (t, x, y, ww, hh) => { for (let j = y; j < y + hh; j++) for (let i = x; i < x + ww; i++) set(i, j, t); };
  const buildings = [];
  const fields = [];
  const doors = [];

  for (const op of spec.ops || []) {
    const [kind, ...a] = op;
    switch (kind) {
      case 'fill': fill(a[0], a[1], a[2], a[3], a[4]); break;
      case 'border': {
        const th = a[1] || 1;
        fill(a[0], 0, 0, w, th); fill(a[0], 0, h - th, w, th);
        fill(a[0], 0, 0, th, h); fill(a[0], w - th, 0, th, h);
        break;
      }
      case 'building': {
        const [x, y, bw, bh, opt = {}] = a;
        fill(T.ROOF, x, y, bw, bh);
        const side = opt.doorSide || 'bottom';
        if (side === 'bottom') fill(T.WALL, x, y + bh - 2, bw, 2);
        else fill(T.WALL, x, y, bw, 2);
        const dx = opt.door ?? Math.floor(bw / 2);
        const door = { x: x + dx, y: side === 'bottom' ? y + bh - 1 : y };
        set(door.x, door.y, T.DOOR);
        doors.push(door);
        buildings.push({ x, y, w: bw, h: bh, label: opt.label || '', roof: opt.roof || '#c0392b', side, door });
        break;
      }
      case 'field': {
        const [x, y, fw, fh, label] = a;
        fill(T.PITCH, x, y, fw, fh);
        fields.push({ x, y, w: fw, h: fh, label: label || '' });
        break;
      }
      case 'scatter': for (const [x, y] of a[1]) set(x, y, a[0]); break;
      default: throw new Error(`Mapa ${spec.id}: operación desconocida ${kind}`);
    }
  }
  return {
    ...spec,
    tiles,
    buildings,
    fields,
    doors,
    get(x, y) { return x < 0 || y < 0 || x >= w || y >= h ? T.TREE : tiles[y * w + x]; },
    isSolid(x, y) { return SOLID.has(this.get(x, y)); },
  };
}
