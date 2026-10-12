import { createState, isSolved } from './state.js';
import { step } from './rules.js';
import { T } from './constants.js';

const ORDER = ['up', 'right', 'down', 'left'];

/**
 * Only pits, fragile plates and keyholes ever change terrain, so the state key
 * tracks those cells instead of the whole board — which keeps the frontier
 * small enough to search. Twin containers also carry their link: the same
 * layout with the pair still linked or already split is a different position.
 */
export function makeKeyFn(start) {
  const mutable = [];
  for (let i = 0; i < start.terrain.length; i++) {
    if (start.terrain[i] === T.PIT || start.terrain[i] === T.FRAGILE || start.terrain[i] === T.KEYHOLE) {
      mutable.push(i);
    }
  }
  return (state) => {
    const crates = [...state.crates].sort((a, b) => a - b).join(',');
    let flags = '';
    for (const i of mutable) flags += String.fromCharCode(state.terrain[i]);
    const twins = state.twins.size ? `|${[...state.twins.keys()].sort((a, b) => a - b).join(',')}` : '';
    return `${state.player}|${crates}|${flags}${twins}`;
  };
}

/**
 * Breadth-first search for a shortest move sequence.
 * @returns {{solved: boolean, moves: string[]|null, explored: number}}
 */
export function solve(level, options) {
  return solveFromState(createState(level), options);
}

/**
 * Same search, but from a position already in play — which is what the hint
 * system needs, since the player is rarely still on the optimal route.
 */
export function solveFromState(start, { maxStates = 2000000 } = {}) {
  if (isSolved(start)) return { solved: true, moves: [], explored: 0 };

  const key = makeKeyFn(start);
  const seen = new Set([key(start)]);
  let frontier = [{ state: start, path: [] }];
  let explored = 0;

  while (frontier.length) {
    const next = [];
    for (const node of frontier) {
      for (const dir of ORDER) {
        const result = step(node.state, dir);
        if (!result) continue;

        const k = key(result.state);
        if (seen.has(k)) continue;
        seen.add(k);
        explored++;

        const path = [...node.path, dir];
        if (isSolved(result.state)) return { solved: true, moves: path, explored };
        if (explored >= maxStates) return { solved: false, moves: null, explored };
        next.push({ state: result.state, path });
      }
    }
    frontier = next;
  }
  return { solved: false, moves: null, explored };
}

/**
 * Breadth-first search for the fewest moves from `start` to any position for
 * which `goalIndex(key)` returns a number (or that is solved). Keeps parent
 * links rather than copying paths, so large searches stay light on memory.
 * @returns {{found: boolean, moves: string[]|null, goal: number|null, explored: number}}
 */
export function searchTowards(start, key, goalIndex, { maxStates = 400000 } = {}) {
  const startGoal = goalIndex(key(start));
  if (startGoal !== undefined) return { found: true, moves: [], goal: startGoal, explored: 0 };

  const seen = new Map([[key(start), 0]]);
  const parent = [-1];
  const via = [-1];
  let frontier = [{ id: 0, state: start }];
  while (frontier.length) {
    const next = [];
    for (const node of frontier) {
      for (let d = 0; d < ORDER.length; d++) {
        const result = step(node.state, ORDER[d]);
        if (!result) continue;
        const k = key(result.state);
        if (seen.has(k)) continue;
        const id = parent.length;
        seen.set(k, id);
        parent.push(node.id);
        via.push(d);
        const goal = goalIndex(k);
        if (goal !== undefined || isSolved(result.state)) {
          const moves = [];
          for (let cur = id; cur > 0; cur = parent[cur]) moves.push(ORDER[via[cur]]);
          moves.reverse();
          return { found: true, moves, goal: goal ?? null, explored: parent.length };
        }
        if (parent.length >= maxStates) return { found: false, moves: null, goal: null, explored: parent.length };
        next.push({ id, state: result.state });
      }
    }
    frontier = next;
  }
  return { found: false, moves: null, goal: null, explored: parent.length };
}

/** Replays a move list and reports whether it solves the level. */
export function replay(level, moves) {
  let state = createState(level);
  for (const dir of moves) {
    const result = step(state, dir);
    if (!result) return { solved: false, state, failedAt: dir };
    state = result.state;
  }
  return { solved: isSolved(state), state, failedAt: null };
}
