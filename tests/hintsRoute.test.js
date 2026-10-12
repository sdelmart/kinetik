import { describe, it, expect } from 'vitest';
import { BUILTIN_WORLDS } from '../src/core/worlds.js';
import { createState, isSolved } from '../src/core/state.js';
import { step } from '../src/core/rules.js';
import { computeHint, hintFromSolution } from '../src/core/hints.js';

const DIRS = ['up', 'right', 'down', 'left'];

/**
 * Wanders off the stored route with plain walking moves only (no pushes, no
 * slides or teleports), so the level stays solvable but the player is no
 * longer on the optimal path.
 */
function detour(level, count) {
  let state = createState(level);
  let taken = 0;
  for (let i = 0; taken < count && i < 40; i++) {
    const dir = DIRS[(i * 7 + level.id.length) % 4];
    const result = step(state, dir);
    if (!result || result.events.some((e) => e.type !== 'move')) continue;
    state = result.state;
    taken++;
  }
  return state;
}

const sample = BUILTIN_WORLDS.flatMap((world) => [world.levels[0], world.levels[world.levels.length - 1]].map((level) => ({ world: world.id, level })));

describe('hints on the regenerated campaign', () => {
  it.each(sample)('$world $level.id: following hints from a detour solves the level', ({ level }) => {
    let state = detour(level, 3);
    const limit = level.solution.length + 40;
    let moves = 0;
    while (!isSolved(state) && moves < limit) {
      const hint = computeHint(state, level);
      expect(hint.ok, `no hint after ${moves} moves`).toBe(true);
      state = step(state, hint.direction).state;
      moves++;
    }
    expect(isSolved(state)).toBe(true);
  });

  it('reports how many moves remain, counting the way back to the route', () => {
    const level = BUILTIN_WORLDS[0].levels[0];
    const offRoute = detour(level, 2);
    if (hintFromSolution(offRoute, level)) return; // the detour happened to land on the route
    const hint = computeHint(offRoute, level);
    expect(hint.ok).toBe(true);
    expect(hint.remaining).toBeGreaterThan(0);
  });
});
