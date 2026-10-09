import { describe, it, expect } from 'vitest';
import campaign from '../src/core/campaign.json';
import { BUILTIN_WORLDS } from '../src/core/worlds.js';
import { validateLevel } from '../src/core/level.js';
import { replay } from '../src/core/solver.js';
import { createState, isSolved } from '../src/core/state.js';
import { hintFromSolution } from '../src/core/hints.js';
import { step } from '../src/core/rules.js';

const allLevels = BUILTIN_WORLDS.flatMap((world) =>
  world.levels.map((level, index) => ({ world: world.id, index: index + 1, level })),
);

const difficultyOf = (worldId, index) => campaign.find((w) => w.id === worldId).levels[index].difficulty;

/**
 * Every level ships with the optimal solution the generator found
 * (scripts/generate-campaign.js). Replaying it proves the level is solvable
 * under the current rules in milliseconds — solving 80 hard levels from
 * scratch here would take minutes.
 */
describe('campaign', () => {
  it('ships eight sectors of ten levels', () => {
    expect(BUILTIN_WORLDS).toHaveLength(8);
    for (const world of BUILTIN_WORLDS) expect(world.levels).toHaveLength(10);
  });

  it('uses unique level ids', () => {
    const ids = allLevels.map(({ level }) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never repeats a layout', () => {
    const layouts = allLevels.map(({ level }) => level.terrain.join('/') + level.entities.join('/'));
    expect(new Set(layouts).size).toBe(layouts.length);
  });

  it.each(allLevels)('$world $index is a valid level', ({ level }) => {
    expect(validateLevel(level)).toEqual({ ok: true });
  });

  it.each(allLevels)('$world $index is solved by its stored solution', ({ level }) => {
    expect(level.solution?.length).toBeGreaterThan(0);
    expect(replay(level, level.solution).solved).toBe(true);
  });

  it.each(allLevels)('$world $index has a reachable par', ({ level }) => {
    expect(level.par).toBeGreaterThanOrEqual(level.solution.length);
  });

  it('does not start any level already solved', () => {
    for (const { level } of allLevels) {
      expect(isSolved(createState(level))).toBe(false);
    }
  });

  // Pushes, not moves: walking around doesn't make a level hard, shifting
  // containers in the right order does. The old campaign averaged 7.5 pushes
  // and had levels finished in a single push.
  it('is genuinely demanding: every level needs at least 8 pushes', () => {
    for (const { world, index, level } of allLevels) {
      let state = createState(level);
      let pushes = 0;
      for (const dir of level.solution) {
        const result = step(state, dir);
        if (result.events.some((e) => e.type === 'push')) pushes++;
        state = result.state;
      }
      expect(pushes, `${world} ${index}`).toBeGreaterThanOrEqual(8);
    }
  });

  it.each(BUILTIN_WORLDS.map((w) => ({ id: w.id, world: w })))('$id gets steadily harder', ({ world }) => {
    const scores = world.levels.map((_, i) => difficultyOf(world.id, i));
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  it('gives an instant hint anywhere along the stored route', () => {
    const level = BUILTIN_WORLDS[0].levels[0];
    let state = createState(level);
    for (let i = 0; i < 5; i++) {
      const hint = hintFromSolution(state, level);
      expect(hint).toEqual({ ok: true, direction: level.solution[i], remaining: level.solution.length - i });
      state = step(state, level.solution[i]).state;
    }
  });
});
