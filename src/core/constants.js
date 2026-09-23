export const FORMAT_VERSION = 1;

export const T = {
  FLOOR: 0,
  WALL: 1,
  TARGET: 2,
  PIT: 3,
  PIT_FILLED: 4,
  FRAGILE: 5,
  BROKEN: 6,
  ICE: 7,
  CONV_UP: 8,
  CONV_RIGHT: 9,
  CONV_DOWN: 10,
  CONV_LEFT: 11,
  TELE_A: 12,
  TELE_B: 13,
  SWITCH: 14,
  GATE: 15,
};

export const TERRAIN_GLYPHS = {
  '#': T.WALL,
  '.': T.FLOOR,
  '*': T.TARGET,
  o: T.PIT,
  O: T.PIT_FILLED,
  '~': T.FRAGILE,
  x: T.BROKEN,
  _: T.ICE,
  '^': T.CONV_UP,
  '>': T.CONV_RIGHT,
  v: T.CONV_DOWN,
  '<': T.CONV_LEFT,
  a: T.TELE_A,
  b: T.TELE_B,
  s: T.SWITCH,
  g: T.GATE,
};

export const GLYPH_BY_TERRAIN = Object.fromEntries(
  Object.entries(TERRAIN_GLYPHS).map(([glyph, code]) => [code, glyph]),
);

export const E = { NONE: 0, PLAYER: 1, CRATE: 2 };

export const ENTITY_GLYPHS = { '.': E.NONE, '@': E.PLAYER, $: E.CRATE };

export const GLYPH_BY_ENTITY = Object.fromEntries(
  Object.entries(ENTITY_GLYPHS).map(([glyph, code]) => [code, glyph]),
);

export const DIRS = {
  up: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
};

export const CONVEYOR_DIRS = {
  [T.CONV_UP]: DIRS.up,
  [T.CONV_RIGHT]: DIRS.right,
  [T.CONV_DOWN]: DIRS.down,
  [T.CONV_LEFT]: DIRS.left,
};

/** Guards against conveyor/teleporter cycles resolving forever. */
export const SETTLE_LIMIT = 64;

export const MIN_SIZE = 4;
export const MAX_SIZE = 24;
