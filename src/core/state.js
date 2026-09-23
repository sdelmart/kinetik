import { T, E, TERRAIN_GLYPHS, ENTITY_GLYPHS } from './constants.js';
import { levelSize } from './level.js';

/**
 * Runtime state. Terrain is a flat Uint8Array and crates a Set of cell indices,
 * which makes cloning (for undo) cheap and comparisons exact.
 */
export function createState(level) {
  const { width, height } = levelSize(level);
  const terrain = new Uint8Array(width * height);
  const crates = new Set();
  let player = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      terrain[i] = TERRAIN_GLYPHS[level.terrain[y][x]];
      const entity = ENTITY_GLYPHS[level.entities[y][x]];
      if (entity === E.PLAYER) player = i;
      else if (entity === E.CRATE) crates.add(i);
    }
  }

  return { width, height, terrain, crates, player, moves: 0, pushes: 0, facing: 'down' };
}

export function cloneState(state) {
  return {
    width: state.width,
    height: state.height,
    terrain: new Uint8Array(state.terrain),
    crates: new Set(state.crates),
    player: state.player,
    moves: state.moves,
    pushes: state.pushes,
    facing: state.facing,
  };
}

export const toIndex = (state, x, y) => y * state.width + x;
export const toXY = (state, i) => ({ x: i % state.width, y: Math.floor(i / state.width) });

export function shift(state, i, dir) {
  const x = (i % state.width) + dir.dx;
  const y = Math.floor(i / state.width) + dir.dy;
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return -1;
  return y * state.width + x;
}

/** Gates are open while any switch tile carries the player or a crate. */
export function gatesOpen(state) {
  for (let i = 0; i < state.terrain.length; i++) {
    if (state.terrain[i] === T.SWITCH && (state.player === i || state.crates.has(i))) return true;
  }
  return false;
}

export function isOccupied(state, i) {
  return state.player === i || state.crates.has(i);
}

export function canPlayerEnter(state, i) {
  if (i < 0) return false;
  const t = state.terrain[i];
  if (t === T.WALL || t === T.PIT || t === T.BROKEN) return false;
  if (t === T.GATE && !gatesOpen(state)) return false;
  return true;
}

export function canCrateEnter(state, i) {
  if (i < 0) return false;
  const t = state.terrain[i];
  if (t === T.WALL || t === T.BROKEN) return false;
  if (t === T.GATE && !gatesOpen(state)) return false;
  return true;
}

export function isSolved(state) {
  for (let i = 0; i < state.terrain.length; i++) {
    if (state.terrain[i] === T.TARGET && !state.crates.has(i)) return false;
  }
  return true;
}

/** A level is lost when fewer crates remain than uncovered targets. */
export function isDeadlocked(state) {
  let targets = 0;
  for (let i = 0; i < state.terrain.length; i++) {
    if (state.terrain[i] === T.TARGET) targets++;
  }
  return state.crates.size < targets;
}
