import {
  T,
  DIRS,
  CONVEYOR_DIRS,
  CONVEYOR_DIR_NAME,
  SETTLE_LIMIT,
  OPPOSITE_DIR,
} from './constants.js';
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

const canEnter = (state, kind, i, dirName) =>
  kind === 'player' ? canPlayerEnter(state, i, dirName) : canCrateEnter(state, i, dirName);

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
function settle(state, kind, start, dir, headingName, events, trail) {
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

    if (kind === 'crate' && tile === T.KEYHOLE) {
      state.terrain[index] = T.KEYHOLE_USED;
      events.push({ type: 'key', index });
      return index;
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
    const nextDirName = tile === T.ICE ? headingName : CONVEYOR_DIR_NAME[tile];

    const next = shift(state, index, nextDir);
    if (next < 0 || isOccupied(state, next) || !canEnter(state, kind, next, nextDirName)) {
      return index;
    }

    moveEntity(state, kind, index, next);
    events.push({ type: 'slide', kind, from: index, to: next });
    trail.push(index);
    index = next;
    heading = nextDir;
    headingName = nextDirName;
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
    // A crate seated in a used keyhole has given up its key for good — it can't budge.
    if (state.terrain[to] === T.KEYHOLE_USED) return null;

    const beyond = shift(state, to, dir);
    if (beyond < 0 || isOccupied(state, beyond) || !canCrateEnter(state, beyond, dirName)) return null;
    if (!canPlayerEnter(state, to, dirName)) return null;

    // A twin-linked crate moves its partner the same instant, mirrored.
    const partner = state.twins.get(to);
    let partnerBeyond = -1;
    let mirrorDirName = null;
    if (partner !== undefined) {
      // A twin locked into a used keyhole anchors its partner in place too.
      if (state.terrain[partner] === T.KEYHOLE_USED) return null;
      mirrorDirName = OPPOSITE_DIR[dirName];
      const mirrorDir = DIRS[mirrorDirName];
      partnerBeyond = shift(state, partner, mirrorDir);
      if (
        partnerBeyond < 0 ||
        partnerBeyond === beyond ||
        isOccupied(state, partnerBeyond) ||
        !canCrateEnter(state, partnerBeyond, mirrorDirName)
      ) {
        return null;
      }
    }

    state.crates.delete(to);
    state.crates.add(beyond);
    crateTrail.push(to);
    events.push({ type: 'push' });
    const primaryRest = settle(state, 'crate', beyond, dir, dirName, events, crateTrail);

    if (partner !== undefined) {
      state.crates.delete(partner);
      state.crates.add(partnerBeyond);
      state.twins.delete(to);
      state.twins.delete(partner);
      crateTrail.push(partner);
      events.push({ type: 'push', twin: true });
      const partnerRest = settle(
        state,
        'crate',
        partnerBeyond,
        DIRS[mirrorDirName],
        mirrorDirName,
        events,
        crateTrail,
      );
      // Re-link at the post-settle resting cells — the pair stays linked unless
      // one of them was consumed by a pit or locked into a keyhole along the way.
      if (primaryRest >= 0 && partnerRest >= 0) {
        state.twins.set(primaryRest, partnerRest);
        state.twins.set(partnerRest, primaryRest);
      }
    }

    state.pushes++;
  } else if (!canPlayerEnter(state, to, dirName)) {
    return null;
  }

  // Surface effects can bring a crate back onto the tile we were entering.
  if (state.crates.has(to) || !canPlayerEnter(state, to, dirName)) return null;

  state.player = to;
  state.moves++;
  events.push({ type: 'move' });

  const playerTrail = [from];
  settle(state, 'player', to, dir, dirName, events, playerTrail);
  collapseVacatedTiles(state, [...crateTrail, ...playerTrail], events);

  return { state, events };
}

export { DIRS };
