import { describe, it, expect } from 'vitest';
import {
  levelScore,
  levelStars,
  formatTime,
  summarizeWorld,
  SCORE_BASE,
  SCORE_MIN,
} from '../src/core/score.js';

describe('levelScore', () => {
  it('awards the full base for a par run with no time lost', () => {
    expect(levelScore({ moves: 20, par: 20, seconds: 0 })).toBe(SCORE_BASE);
  });

  it('does not reward finishing under par beyond the base', () => {
    expect(levelScore({ moves: 5, par: 20, seconds: 0 })).toBe(SCORE_BASE);
  });

  it('removes 8 points per move above par', () => {
    expect(levelScore({ moves: 25, par: 20, seconds: 0 })).toBe(SCORE_BASE - 40);
  });

  it('removes 2 points per second', () => {
    expect(levelScore({ moves: 20, par: 20, seconds: 10 })).toBe(SCORE_BASE - 20);
  });

  it('caps the time penalty', () => {
    expect(levelScore({ moves: 20, par: 20, seconds: 99999 })).toBe(SCORE_BASE - 400);
  });

  it('never drops below the floor', () => {
    expect(levelScore({ moves: 9999, par: 10, seconds: 9999 })).toBe(SCORE_MIN);
  });

  it('is deterministic', () => {
    const args = { moves: 31, par: 24, seconds: 47 };
    expect(levelScore(args)).toBe(levelScore(args));
  });
});

describe('levelStars', () => {
  it('gives three stars at or under par', () => {
    expect(levelStars({ moves: 20, par: 20 })).toBe(3);
    expect(levelStars({ moves: 12, par: 20 })).toBe(3);
  });

  it('gives two stars within 35% over par', () => {
    expect(levelStars({ moves: 27, par: 20 })).toBe(2);
  });

  it('gives one star beyond that', () => {
    expect(levelStars({ moves: 28, par: 20 })).toBe(1);
  });
});

describe('formatTime', () => {
  it('pads minutes and seconds', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(3599)).toBe('59:59');
  });

  it('clamps negatives', () => {
    expect(formatTime(-5)).toBe('00:00');
  });
});

describe('summarizeWorld', () => {
  it('totals completion, score and stars', () => {
    const summary = summarizeWorld({
      a: { completed: true, bestScore: 900, bestStars: 3, bestMoves: 18 },
      b: { completed: true, bestScore: 700, bestStars: 2, bestMoves: 25 },
      c: { completed: false },
    });
    expect(summary).toEqual({ completed: 2, score: 1600, stars: 5, moves: 43 });
  });

  it('handles an empty record', () => {
    expect(summarizeWorld(undefined)).toEqual({ completed: 0, score: 0, stars: 0, moves: 0 });
  });
});
