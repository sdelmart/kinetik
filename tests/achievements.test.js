import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, evaluateAchievements } from '../src/core/achievements.js';

const baseCtx = {
  levelsCompleted: 0,
  totalStars: 0,
  sectorsComplete: [],
  hintFreeClears: 0,
  totalScore: 0,
  dailyClears: 0,
  dailyStreak: 0,
  dailyLongestStreak: 0,
  customLevelCount: 0,
};

describe('achievement definitions', () => {
  it('has no duplicate ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('unlocks nothing from a blank slate', () => {
    expect(evaluateAchievements(baseCtx, []).unlocked).toEqual([]);
  });
});

describe('evaluateAchievements', () => {
  it('unlocks first_clear once a level is completed', () => {
    const { newly } = evaluateAchievements({ ...baseCtx, levelsCompleted: 1 }, []);
    expect(newly).toContain('first_clear');
  });

  it('never re-unlocks something already recorded', () => {
    const { newly } = evaluateAchievements({ ...baseCtx, levelsCompleted: 1 }, ['first_clear']);
    expect(newly).not.toContain('first_clear');
  });

  it('accumulates unlocked ids across calls', () => {
    const first = evaluateAchievements({ ...baseCtx, levelsCompleted: 1 }, []);
    const second = evaluateAchievements(
      { ...baseCtx, levelsCompleted: 1, totalScore: 20000 },
      first.unlocked,
    );
    expect(second.unlocked).toEqual(expect.arrayContaining(['first_clear', 'score_hunter']));
    expect(second.newly).toEqual(['score_hunter']);
  });

  it('drops unknown ids from storage instead of crashing', () => {
    const { unlocked } = evaluateAchievements(baseCtx, ['not_a_real_id', 'first_clear']);
    expect(unlocked).not.toContain('not_a_real_id');
  });

  it('unlocks campaign_complete only once every sector is', () => {
    const almost = evaluateAchievements(
      { ...baseCtx, sectorsComplete: ['assembly', 'foundry', 'cryo', 'reactor'] },
      [],
    );
    expect(almost.newly).not.toContain('campaign_complete');

    const all = evaluateAchievements(
      { ...baseCtx, sectorsComplete: ['assembly', 'foundry', 'cryo', 'reactor', 'core'] },
      [],
    );
    expect(all.newly).toContain('campaign_complete');
  });

  it('gates purist behind ten hint-free clears, not one', () => {
    const one = evaluateAchievements({ ...baseCtx, hintFreeClears: 1 }, []);
    expect(one.newly).toContain('hint_free_clear');
    expect(one.newly).not.toContain('purist');

    const ten = evaluateAchievements({ ...baseCtx, hintFreeClears: 10 }, []);
    expect(ten.newly).toEqual(expect.arrayContaining(['hint_free_clear', 'purist']));
  });

  it('unlocks daily streak milestones at their thresholds', () => {
    const { newly } = evaluateAchievements({ ...baseCtx, dailyStreak: 7 }, []);
    expect(newly).toEqual(expect.arrayContaining(['daily_streak_3', 'daily_streak_7']));
    expect(newly).not.toContain('daily_streak_30');
  });
});
