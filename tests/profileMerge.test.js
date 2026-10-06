import { describe, it, expect } from 'vitest';
import {
  mergeTotals,
  mergeLevelRecord,
  mergeRecords,
  mergeSave,
  mergeAchievements,
  mergeChapters,
  mergeLabyrinth,
  finite,
} from '../server/merge.js';

describe('finite', () => {
  it('passes through finite numbers', () => {
    expect(finite(5)).toBe(5);
  });

  it('falls back on non-finite input', () => {
    expect(finite(undefined)).toBe(0);
    expect(finite(NaN, 7)).toBe(7);
    expect(finite(Infinity, 7)).toBe(7);
  });
});

describe('mergeTotals', () => {
  it('takes the max of each field independently', () => {
    const a = { moves: 10, pushes: 2, seconds: 100, score: 50, runs: 1, hintFreeClears: 0 };
    const b = { moves: 5, pushes: 8, seconds: 90, score: 60, runs: 3, hintFreeClears: 2 };
    expect(mergeTotals(a, b)).toEqual({
      moves: 10,
      pushes: 8,
      seconds: 100,
      score: 60,
      runs: 3,
      hintFreeClears: 2,
    });
  });

  it('defaults missing fields to 0', () => {
    expect(mergeTotals({}, {})).toEqual({
      moves: 0,
      pushes: 0,
      seconds: 0,
      score: 0,
      runs: 0,
      hintFreeClears: 0,
    });
  });
});

describe('mergeLevelRecord', () => {
  it('returns the other side untouched when one side is missing', () => {
    const record = { completed: true, bestScore: 10, bestStars: 3, bestMoves: 5, bestTime: 20, playCount: 2, playedAt: 100 };
    expect(mergeLevelRecord(undefined, record)).toBe(record);
    expect(mergeLevelRecord(record, undefined)).toBe(record);
  });

  it('takes the better of each stat from both sides', () => {
    const a = { completed: false, bestScore: 10, bestStars: 2, bestMoves: 50, bestTime: 60, playCount: 1, playedAt: 100 };
    const b = { completed: true, bestScore: 30, bestStars: 1, bestMoves: 20, bestTime: 90, playCount: 4, playedAt: 50 };
    expect(mergeLevelRecord(a, b)).toEqual({
      completed: true,
      bestScore: 30,
      bestStars: 2,
      bestMoves: 20,
      bestTime: 60,
      playCount: 4,
      playedAt: 100,
    });
  });
});

describe('mergeRecords', () => {
  it('merges per-world, per-level records, keeping levels unique to either side', () => {
    const a = { w1: { l1: { completed: true, bestScore: 10, bestStars: 3, bestMoves: 5, bestTime: 20, playCount: 1, playedAt: 1 } } };
    const b = { w1: { l2: { completed: true, bestScore: 5, bestStars: 1, bestMoves: 9, bestTime: 30, playCount: 1, playedAt: 1 } }, w2: {} };
    const merged = mergeRecords(a, b);
    expect(Object.keys(merged)).toEqual(expect.arrayContaining(['w1', 'w2']));
    expect(merged.w1.l1).toBeDefined();
    expect(merged.w1.l2).toBeDefined();
  });
});

describe('mergeSave', () => {
  it('handles a first sync with no existing profile', () => {
    const incoming = { records: { w1: { l1: { completed: true, bestScore: 10, bestStars: 3, bestMoves: 5, bestTime: 20, playCount: 1, playedAt: 1 } } }, totals: { moves: 4 } };
    expect(mergeSave(undefined, incoming)).toEqual({
      records: incoming.records,
      totals: mergeTotals({}, incoming.totals),
    });
  });

  it('tolerates malformed input on either side', () => {
    expect(mergeSave(null, null)).toEqual({ records: {}, totals: mergeTotals({}, {}) });
  });
});

describe('mergeAchievements', () => {
  it('unions ids and drops duplicates', () => {
    expect(mergeAchievements(['a', 'b'], ['b', 'c'])).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    expect(mergeAchievements(['a', 'b'], ['b', 'c'])).toHaveLength(3);
  });

  it('ignores non-array input and filters non-string entries', () => {
    expect(mergeAchievements(undefined, ['a', 1, null])).toEqual(['a']);
  });
});

describe('mergeChapters', () => {
  it('keeps a chapter present on only one side', () => {
    const a = { c1: { completed: true, bestMoves: 10, bestSeconds: 20 } };
    expect(mergeChapters(a, {})).toEqual(a);
  });

  it('takes the better stats when a chapter exists on both sides', () => {
    const a = { c1: { completed: false, bestMoves: 50, bestSeconds: 90 } };
    const b = { c1: { completed: true, bestMoves: 30, bestSeconds: 120 } };
    expect(mergeChapters(a, b)).toEqual({ c1: { completed: true, bestMoves: 30, bestSeconds: 90 } });
  });
});

describe('mergeLabyrinth', () => {
  it('merges chapters and takes the max endless depth', () => {
    const a = { chapters: { c1: { completed: true, bestMoves: 10, bestSeconds: 20 } }, endless: { bestDepth: 5 } };
    const b = { chapters: {}, endless: { bestDepth: 12 } };
    expect(mergeLabyrinth(a, b)).toEqual({
      chapters: { c1: { completed: true, bestMoves: 10, bestSeconds: 20 } },
      endless: { bestDepth: 12 },
    });
  });

  it('tolerates malformed input on either side', () => {
    expect(mergeLabyrinth(null, undefined)).toEqual({ chapters: {}, endless: { bestDepth: 0 } });
  });
});
