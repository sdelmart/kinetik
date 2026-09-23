import { read, write } from './storage.js';

export function loadUnlockedAchievements(key = 'achievements') {
  const raw = read(key, []);
  return Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : [];
}

export function persistUnlockedAchievements(ids, key = 'achievements') {
  write(key, ids);
}
