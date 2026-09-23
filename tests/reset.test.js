import { describe, it, expect, beforeEach } from 'vitest';
import { resetProfileProgress } from '../src/state/reset.js';
import { commitRun, loadSave } from '../src/state/save.js';
import { read, write } from '../src/state/storage.js';
import { loadUnlockedAchievements, persistUnlockedAchievements } from '../src/state/achievements.js';
import { STARTING_TOKENS } from '../src/core/hints.js';

const keyFor = (name) => `test:${name}`;

describe('resetProfileProgress', () => {
  beforeEach(() => {
    // Seed some progress under every key the reset is supposed to touch.
    write(keyFor('save'), commitRun(loadSave(), {
      worldId: 'assembly',
      levelId: 'assembly-1',
      moves: 4,
      pushes: 4,
      seconds: 10,
      score: 900,
      stars: 3,
    }));
    write(keyFor('hints'), 12);
    persistUnlockedAchievements(['first_clear', 'stars_gold'], keyFor('achievements'));
  });

  it('wipes level records and totals', () => {
    const { save } = resetProfileProgress(keyFor);
    expect(save.records).toEqual({});
    expect(save.totals.score).toBe(0);
    expect(loadSave(keyFor('save')).records).toEqual({});
  });

  it('resets hint tokens to the starting amount, not zero', () => {
    const { hintTokens } = resetProfileProgress(keyFor);
    expect(hintTokens).toBe(STARTING_TOKENS);
    expect(read(keyFor('hints'), null)).toBe(STARTING_TOKENS);
  });

  it('clears every unlocked achievement', () => {
    const { achievements } = resetProfileProgress(keyFor);
    expect(achievements).toEqual([]);
    expect(loadUnlockedAchievements(keyFor('achievements'))).toEqual([]);
  });

  it('leaves no achievement that the wiped save could no longer justify', () => {
    resetProfileProgress(keyFor);
    // The scenario the bug fix targets: an achievement screen read right
    // after a reset must not still claim something the save no longer shows.
    const save = loadSave(keyFor('save'));
    const unlocked = loadUnlockedAchievements(keyFor('achievements'));
    expect(save.totals.score).toBe(0);
    expect(unlocked).toEqual([]);
  });
});
