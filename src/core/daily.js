import { parseCompact } from './level.js';
import pool from './daily.json';

/**
 * The daily challenge: one level a day, the same for everyone, picked
 * deterministically from a fixed pool so it needs no server or randomness at
 * runtime. `id` encodes the date, which is what makes the save system track
 * one record per calendar day for free — see commitRun in state/save.js.
 */
export const DAILY_WORLD_ID = 'daily';
const EPOCH = Date.UTC(2024, 0, 1); // arbitrary fixed origin, never changes
const DAY_MS = 86400000;

export function todayKey(date = new Date()) {
  return dateKey(date);
}

export function dateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function dayNumber(dateKeyStr) {
  return Math.floor((Date.parse(`${dateKeyStr}T00:00:00Z`) - EPOCH) / DAY_MS);
}

/** Picks today's level and wraps it as a single-level virtual world. */
export function dailyLevelFor(dateKeyStr) {
  const index = ((dayNumber(dateKeyStr) % pool.length) + pool.length) % pool.length;
  const def = pool[index];
  return parseCompact(def.rows, { id: `${DAILY_WORLD_ID}-${dateKeyStr}`, par: def.par });
}

export function dailyWorld(dateKeyStr = todayKey()) {
  return {
    id: DAILY_WORLD_ID,
    accent: '#54e08a',
    builtin: true,
    daily: true,
    levels: [dailyLevelFor(dateKeyStr)],
  };
}

function addDays(dateKeyStr, delta) {
  return dateKey(new Date(Date.parse(`${dateKeyStr}T00:00:00Z`) + delta * DAY_MS));
}

/**
 * Counts consecutive completed days ending today, or ending yesterday if
 * today hasn't been played yet — the standard streak semantics (a streak
 * isn't broken until a whole day is skipped, matching what players expect
 * from similar daily-challenge features elsewhere).
 */
export function computeStreak(records, today = todayKey()) {
  const completed = new Set(
    Object.entries(records ?? {})
      .filter(([, record]) => record?.completed)
      .map(([id]) => id.slice(`${DAILY_WORLD_ID}-`.length)),
  );

  let cursor = completed.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (completed.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** The longest run of consecutive days ever, independent of today. */
export function computeLongestStreak(records) {
  const days = Object.entries(records ?? {})
    .filter(([, record]) => record?.completed)
    .map(([id]) => id.slice(`${DAILY_WORLD_ID}-`.length))
    .sort();

  let longest = 0;
  let current = 0;
  let previous = null;
  for (const day of days) {
    current = previous && addDays(previous, 1) === day ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }
  return longest;
}

export function totalDailyClears(records) {
  return Object.values(records ?? {}).filter((r) => r?.completed).length;
}
