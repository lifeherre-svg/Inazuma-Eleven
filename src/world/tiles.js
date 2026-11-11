// Catálogo de tiles del mundo explorable.
export const T = {
  GRASS: 0, TALL: 1, PATH: 2, WATER: 3, TREE: 4, WALL: 5, ROOF: 6, DOOR: 7,
  PITCH: 8, FENCE: 9, FLOWER: 10, ROCK: 11, BRIDGE: 12, SAND: 13, PLAZA: 14,
};

export const SOLID = new Set([T.WATER, T.TREE, T.WALL, T.ROOF, T.DOOR, T.FENCE, T.ROCK]);

export const TILE_NAMES = Object.fromEntries(Object.entries(T).map(([k, v]) => [v, k]));
