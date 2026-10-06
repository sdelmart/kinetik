import { describe, it, expect } from 'vitest';
import { resolveMaxDifficulty } from '../src/labyrinth/state.js';

describe('resolveMaxDifficulty', () => {
  it('keeps the automatic value when the player has not overridden it', () => {
    expect(resolveMaxDifficulty('auto', 1)).toBe(1);
    expect(resolveMaxDifficulty('auto', 3)).toBe(3);
  });

  it('overrides the automatic value for an explicit choice', () => {
    expect(resolveMaxDifficulty('easy', 3)).toBe(1);
    expect(resolveMaxDifficulty('medium', 3)).toBe(2);
    expect(resolveMaxDifficulty('hard', 1)).toBe(3);
  });

  it('falls back to the automatic value for an unknown preference', () => {
    expect(resolveMaxDifficulty('bogus', 2)).toBe(2);
  });
});
