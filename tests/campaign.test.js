import { describe, it, expect } from 'vitest';
import { BUILTIN_WORLDS } from '../src/core/worlds.js';
import { validateLevel } from '../src/core/level.js';
import { solve } from '../src/core/solver.js';
import { createState, isSolved } from '../src/core/state.js';

const allLevels = BUILTIN_WORLDS.flatMap((world) =>
  world.levels.map((level, index) => ({ world: world.id, index: index + 1, level })),
);

// Solving is the expensive part of this suite, so each level is solved once.
const solutions = new Map();
const solutionFor = (level) => {
  if (!solutions.has(level.id)) solutions.set(level.id, solve(level));
  return solutions.get(level.id);
};

describe('campaign', () => {
  it('ships five sectors of ten levels', () => {
    expect(BUILTIN_WORLDS).toHaveLength(5);
    for (const world of BUILTIN_WORLDS) expect(world.levels).toHaveLength(10);
  });

  it('uses unique level ids', () => {
    const ids = allLevels.map(({ level }) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(allLevels)('$world $index is a valid level', ({ level }) => {
    expect(validateLevel(level)).toEqual({ ok: true });
  });

  it.each(allLevels)('$world $index is solvable', ({ level }) => {
    const { solved, moves } = solutionFor(level);
    expect(solved).toBe(true);
    expect(moves.length).toBeGreaterThan(0);
  });

  it.each(allLevels)('$world $index has a reachable par', ({ level }) => {
    expect(level.par).toBeGreaterThanOrEqual(solutionFor(level).moves.length);
  });

  it('does not start any level already solved', () => {
    for (const { level } of allLevels) {
      expect(isSolved(createState(level))).toBe(false);
    }
  });

  // The whole point of the calibration step: a sector must not throw a harder
  // level at the player before an easier one.
  it.each(BUILTIN_WORLDS.map((w) => ({ id: w.id, world: w })))(
    '$id gets steadily harder',
    ({ world }) => {
      const lengths = world.levels.map((level) => solutionFor(level).moves.length);
      const sorted = [...lengths].sort((a, b) => a - b);
      expect(lengths).toEqual(sorted);
    },
  );

  it('keeps the first level of each sector approachable', () => {
    for (const world of BUILTIN_WORLDS) {
      expect(solutionFor(world.levels[0]).moves.length, world.id).toBeLessThanOrEqual(15);
    }
  });
});
