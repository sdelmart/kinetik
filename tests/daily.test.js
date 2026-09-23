import { describe, it, expect } from 'vitest';
import {
  dailyLevelFor,
  dailyWorld,
  computeStreak,
  computeLongestStreak,
  totalDailyClears,
  DAILY_WORLD_ID,
} from '../src/core/daily.js';
import { validateLevel } from '../src/core/level.js';
import { solve } from '../src/core/solver.js';
import pool from '../src/core/daily.json';

describe('daily level selection', () => {
  it('is deterministic for a given date', () => {
    expect(dailyLevelFor('2026-01-15').id).toBe(dailyLevelFor('2026-01-15').id);
  });

  it('encodes the date in the level id', () => {
    expect(dailyLevelFor('2026-03-08').id).toBe(`${DAILY_WORLD_ID}-2026-03-08`);
  });

  it('picks a different pool entry for every day of a full cycle', () => {
    // Two levels can share a terrain layout (e.g. the same walls with crates
    // in different spots), so identify a board by terrain *and* entities.
    const boards = new Set();
    for (let i = 0; i < pool.length; i++) {
      const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      const level = dailyLevelFor(date);
      boards.add(`${level.terrain.join('|')}//${level.entities.join('|')}`);
    }
    expect(boards.size).toBe(pool.length);
  });

  it('wraps a single-level virtual world', () => {
    const world = dailyWorld('2026-01-15');
    expect(world.id).toBe(DAILY_WORLD_ID);
    expect(world.levels).toHaveLength(1);
  });
});

describe('daily pool integrity', () => {
  it.each(pool.map((def, index) => ({ index, def })))(
    'level $index is valid and solvable',
    ({ index }) => {
      const date = new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10);
      const level = dailyLevelFor(date);
      expect(validateLevel(level)).toEqual({ ok: true });
      const { solved, moves } = solve(level);
      expect(solved).toBe(true);
      expect(level.par).toBeGreaterThanOrEqual(moves.length);
    },
  );
});

describe('streaks', () => {
  const day = (n) => new Date(Date.UTC(2026, 0, n)).toISOString().slice(0, 10);
  const records = (days) =>
    Object.fromEntries(days.map((n) => [`${DAILY_WORLD_ID}-${day(n)}`, { completed: true }]));

  it('is zero with no history', () => {
    expect(computeStreak({}, day(10))).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(computeStreak(records([8, 9, 10]), day(10))).toBe(3);
  });

  it('keeps the streak alive if only yesterday was played', () => {
    expect(computeStreak(records([8, 9]), day(10))).toBe(2);
  });

  it('drops to zero once both today and yesterday are missing', () => {
    expect(computeStreak(records([6, 7]), day(10))).toBe(0);
  });

  it('restarts the count from the day after a gap', () => {
    // Days 6-7 were a streak, day 8 was skipped, day 9 (yesterday) restarts
    // it — the gap breaks continuity with 6-7, but yesterday still counts.
    expect(computeStreak(records([6, 7, 9]), day(10))).toBe(1);
  });

  it('ignores unrelated records', () => {
    const mixed = { ...records([10]), 'daily-not-a-date': { completed: true } };
    expect(computeStreak(mixed, day(10))).toBe(1);
  });

  it('finds the longest streak regardless of gaps', () => {
    expect(computeLongestStreak(records([1, 2, 3, 4, 8, 9]))).toBe(4);
  });

  it('counts total distinct clears', () => {
    expect(totalDailyClears(records([1, 5, 9]))).toBe(3);
  });

  it('does not count an incomplete record', () => {
    const withIncomplete = { ...records([1]), [`${DAILY_WORLD_ID}-${day(2)}`]: { completed: false } };
    expect(totalDailyClears(withIncomplete)).toBe(1);
  });
});
