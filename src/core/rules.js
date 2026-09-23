import { T, DIRS, CONVEYOR_DIRS, SETTLE_LIMIT } from './constants.js';
import {
  cloneState,
  shift,
  isOccupied,
  canPlayerEnter,
  canCrateEnter,
} from './state.js';

/**
 * Movement rules, expressed once as a vector operation. Every direction, every
 * entity kind and every surface goes through this same path.
 *
 * Surfaces:
 *  - ice      : the entity keeps sliding in its current direction
 *  - conveyor : the entity is carried one tile along the belt, then re-settles
 *  - teleporter: paired tiles; entering one exits at the other, once per move
 *  - pit      : a crate falls in and turns it into crossable ground
 *  - fragile  : collapses into an impassable hole once anything leaves it
 */

const canEnter = (state, kind, i) =>
  kind === 'player' ? canPlayerEnter(state, i) : canCrateEnter(state, i);

function moveEntity(state, kind, from, to) {
  if (kind === 'player') {
    state.player = to;
  } else {
    state.crates.delete(from);
    state.crates.add(to);
  }
}

function teleportExit(state, tile) {
  const wanted = tile === T.TELE_A ? T.TELE_B : T.TELE_A;
  for (let i = 0; i < state.terrain.length; i++) {
    if (state.terrain[i] === wanted) return i;
  }
  return -1;
}

/**
 * Resolves surface effects after an entity lands on `start`.
 * @returns final cell index, or -1 when the entity was consumed by a pit.
 */
function settle(state, kind, start, dir, events, trail) {
  let index = start;
  let heading = dir;
  let teleported = false;

  for (let guard = 0; guard < SETTLE_LIMIT; guard++) {
    const tile = state.terrain[index];

    if (kind === 'crate' && tile === T.PIT) {
      state.crates.delete(index);
      state.terrain[index] = T.PIT_FILLED;
      events.push({ type: 'fill', index });
      return -1;
    }

    if (tile === T.TELE_A || tile === T.TELE_B) {
      if (!teleported) {
        const exit = teleportExit(state, tile);
        if (exit >= 0 && !isOccupied(state, exit) && canEnter(state, kind, exit)) {
          moveEntity(state, kind, index, exit);
          events.push({ type: 'teleport', kind, from: index, to: exit });
          trail.push(index);
          index = exit;
          teleported = true;
          continue;
        }
      }
    } else {
      teleported = false;
    }

    const nextDir = tile === T.ICE ? heading : CONVEYOR_DIRS[tile];
    if (!nextDir) return index;

    const next = shift(state, index, nextDir);
    if (next < 0 || isOccupied(state, next) || !canEnter(state, kind, next)) return index;

    moveEntity(state, kind, index, next);
    events.push({ type: 'slide', kind, from: index, to: next });
    trail.push(index);
    index = next;
    heading = nextDir;
  }
  return index;
}

/**
 * A fragile plate gives way once it is left empty — which is only decided after
 * everything has finished moving, so the drone can follow a container across it.
 */
function collapseVacatedTiles(state, trail, events) {
  for (const index of trail) {
    if (state.terrain[index] !== T.FRAGILE) continue;
    if (state.player === index || state.crates.has(index)) continue;
    state.terrain[index] = T.BROKEN;
    events.push({ type: 'break', index });
  }
}

/**
 * Attempts one move.
 * @returns {{state: object, events: object[]} | null} null when the move is illegal.
 */
export function step(current, dirName) {
  const dir = DIRS[dirName];
  if (!dir) return null;

  const state = cloneState(current);
  state.facing = dirName;
  const from = state.player;
  const to = shift(state, from, dir);
  if (to < 0) return null;

  const events = [];
  const crateTrail = [];

  if (state.crates.has(to)) {
    const beyond = shift(state, to, dir);
    if (beyond < 0 || isOccupied(state, beyond) || !canCrateEnter(state, beyond)) return null;
    if (!canPlayerEnter(state, to)) return null;

    state.crates.delete(to);
    state.crates.add(beyond);
    crateTrail.push(to);
    events.push({ type: 'push' });
    settle(state, 'crate', beyond, dir, events, crateTrail);
    state.pushes++;
  } else if (!canPlayerEnter(state, to)) {
    return null;
  }

  // Surface effects can bring a crate back onto the tile we were entering.
  if (state.crates.has(to) || !canPlayerEnter(state, to)) return null;

  state.player = to;
  state.moves++;
  events.push({ type: 'move' });

  const playerTrail = [from];
  settle(state, 'player', to, dir, events, playerTrail);
  collapseVacatedTiles(state, [...crateTrail, ...playerTrail], events);

  return { state, events };
}

export { DIRS };
