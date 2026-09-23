import { BUILTIN_WORLDS } from './worlds.js';
import { computeStreak, computeLongestStreak, totalDailyClears, DAILY_WORLD_ID } from './daily.js';

const TOTAL_LEVELS = BUILTIN_WORLDS.reduce((n, w) => n + w.levels.length, 0);
const TOTAL_STARS = TOTAL_LEVELS * 3;

/**
 * Every achievement is a pure predicate over a context snapshot, so unlocking
 * is a deterministic function of save data — nothing here depends on when or
 * how the player got there, which makes it replayable and easy to test.
 */
export const ACHIEVEMENTS = [
  { id: 'first_clear', check: (ctx) => ctx.levelsCompleted >= 1 || ctx.dailyClears >= 1 },
  ...BUILTIN_WORLDS.map((world) => ({
    id: `sector_${world.id}`,
    check: (ctx) => ctx.sectorsComplete.includes(world.id),
  })),
  { id: 'campaign_complete', check: (ctx) => ctx.sectorsComplete.length >= BUILTIN_WORLDS.length },
  { id: 'stars_bronze', check: (ctx) => ctx.totalStars >= Math.round(TOTAL_STARS * 0.33) },
  { id: 'stars_silver', check: (ctx) => ctx.totalStars >= Math.round(TOTAL_STARS * 0.66) },
  { id: 'stars_gold', check: (ctx) => ctx.totalStars >= TOTAL_STARS },
  { id: 'hint_free_clear', check: (ctx) => ctx.hintFreeClears >= 1 },
  { id: 'purist', check: (ctx) => ctx.hintFreeClears >= 10 },
  { id: 'daily_first', check: (ctx) => ctx.dailyClears >= 1 },
  { id: 'daily_streak_3', check: (ctx) => ctx.dailyStreak >= 3 },
  { id: 'daily_streak_7', check: (ctx) => ctx.dailyStreak >= 7 },
  { id: 'daily_streak_30', check: (ctx) => ctx.dailyStreak >= 30 },
  { id: 'builder', check: (ctx) => ctx.customLevelCount >= 1 },
  { id: 'score_hunter', check: (ctx) => ctx.totalScore >= 20000 },
];

const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));

/**
 * Builds the snapshot achievements are checked against, from plain save data
 * — no dependency on the storage layer, so this stays testable and reusable
 * from anywhere that already has a `save` object in hand.
 */
export function buildContext({ save, customWorlds }) {
  const sectorsComplete = BUILTIN_WORLDS.filter((world) =>
    world.levels.every((level) => save.records[world.id]?.[level.id]?.completed),
  ).map((w) => w.id);

  let levelsCompleted = 0;
  let totalStars = 0;
  for (const world of BUILTIN_WORLDS) {
    for (const record of Object.values(save.records[world.id] ?? {})) {
      if (record?.completed) levelsCompleted++;
      totalStars += record?.bestStars ?? 0;
    }
  }

  const dailyRecords = save.records[DAILY_WORLD_ID] ?? {};

  return {
    levelsCompleted,
    totalStars,
    sectorsComplete,
    hintFreeClears: save.totals.hintFreeClears ?? 0,
    totalScore: save.totals.score,
    dailyClears: totalDailyClears(dailyRecords),
    dailyStreak: computeStreak(dailyRecords),
    dailyLongestStreak: computeLongestStreak(dailyRecords),
    customLevelCount: (customWorlds ?? []).reduce((n, w) => n + w.levels.length, 0),
  };
}

/**
 * @returns {{unlocked: string[], newly: string[]}} `unlocked` is the full set
 * to persist; `newly` is what to celebrate this call, if anything.
 */
export function evaluateAchievements(ctx, previouslyUnlocked) {
  const unlocked = new Set((previouslyUnlocked ?? []).filter((id) => ACHIEVEMENT_IDS.has(id)));
  const newly = [];
  for (const achievement of ACHIEVEMENTS) {
    if (!unlocked.has(achievement.id) && achievement.check(ctx)) {
      unlocked.add(achievement.id);
      newly.push(achievement.id);
    }
  }
  return { unlocked: [...unlocked], newly };
}
