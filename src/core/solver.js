import { createState, isSolved } from './state.js';
import { step } from './rules.js';
import { T } from './constants.js';

const ORDER = ['up', 'right', 'down', 'left'];

/**
 * Only pits and fragile plates ever change, so the state key tracks those cells
 * instead of the whole board — which keeps the frontier small enough to search.
 */
function makeKeyFn(start) {
  const mutable = [];
  for (let i = 0; i < start.terrain.length; i++) {
    if (start.terrain[i] === T.PIT || start.terrain[i] === T.FRAGILE) mutable.push(i);
  }
  return (state) => {
    const crates = [...state.crates].sort((a, b) => a - b).join(',');
    let flags = '';
    for (const i of mutable) flags += String.fromCharCode(state.terrain[i]);
    return `${state.player}|${crates}|${flags}`;
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
