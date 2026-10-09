import { read, write, remove } from './storage.js';
import { resetProfileProgress } from './reset.js';
import { SEASON } from './season.js';

/**
 * Once per season: wipes a profile's results — campaign progress and scores,
 * statistics, Labyrinth, achievements, hint tokens — because they were earned
 * on levels that no longer exist. Custom levels, published sectors and
 * settings are kept. Returns whether a reset happened.
 */
export function applySeasonReset(keyFor) {
  if (read(keyFor('season'), 1) >= SEASON) return false;
  resetProfileProgress(keyFor);
  for (const name of ['labyrinth', 'labSeenQuestions', 'scoresPushed']) remove(keyFor(name));
  write(keyFor('season'), SEASON);
  return true;
}
