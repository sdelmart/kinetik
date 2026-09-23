import { read, write, remove } from './storage.js';
import { validateLevel } from '../core/level.js';

const EMPTY = { records: {}, totals: { moves: 0, pushes: 0, seconds: 0, score: 0, runs: 0 } };

export function loadSave(key = 'save') {
  const raw = read(key, null);
  if (!raw || typeof raw !== 'object') return structuredClone(EMPTY);
  return {
    records: raw.records && typeof raw.records === 'object' ? raw.records : {},
    totals: { ...EMPTY.totals, ...(raw.totals ?? {}) },
  };
}

export function persistSave(save, key = 'save') {
  write(key, save);
}

export function recordsFor(save, worldId) {
  return save.records[worldId] ?? {};
}

export function levelRecord(save, worldId, levelId) {
  return recordsFor(save, worldId)[levelId] ?? null;
}

/**
 * Stores a finished run. Bests only ever improve; lifetime totals always
 * accumulate, so restarting a level never erases what the player has done.
 */
export function commitRun(save, { worldId, levelId, moves, pushes, seconds, score, stars }) {
  const world = { ...(save.records[worldId] ?? {}) };
  const previous = world[levelId] ?? {};

  world[levelId] = {
    completed: true,
    bestScore: Math.max(previous.bestScore ?? 0, score),
    bestStars: Math.max(previous.bestStars ?? 0, stars),
    bestMoves: previous.bestMoves ? Math.min(previous.bestMoves, moves) : moves,
    bestTime: previous.bestTime ? Math.min(previous.bestTime, seconds) : seconds,
    playedAt: Date.now(),
  };

  return {
    records: { ...save.records, [worldId]: world },
    totals: {
      moves: save.totals.moves + moves,
      pushes: save.totals.pushes + pushes,
      seconds: save.totals.seconds + seconds,
      score: save.totals.score + score,
      runs: save.totals.runs + 1,
    },
  };
}

export function isWorldComplete(save, world) {
  const records = recordsFor(save, world.id);
  return world.levels.every((level) => records[level.id]?.completed);
}

/** A world unlocks when the previous one is finished; the first is always open. */
export function isWorldUnlocked(save, worlds, index) {
  if (index === 0) return true;
  return isWorldComplete(save, worlds[index - 1]);
}

export function isLevelUnlocked(save, world, index) {
  if (index === 0) return true;
  return Boolean(recordsFor(save, world.id)[world.levels[index - 1].id]?.completed);
}

export function resetSave(key = 'save') {
  remove(key);
  return structuredClone(EMPTY);
}

// --- Custom worlds -------------------------------------------------------

export function loadCustomWorlds(key = 'worlds') {
  const raw = read(key, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(isUsableWorld).map((world) => ({ ...world, builtin: false }));
}

function isUsableWorld(world) {
  return (
    world &&
    typeof world.id === 'string' &&
    typeof world.name === 'string' &&
    Array.isArray(world.levels) &&
    world.levels.every((level) => validateLevel(level).ok)
  );
}

export function persistCustomWorlds(worlds, key = 'worlds') {
  write(
    key,
    worlds.map(({ id, name, accent, levels }) => ({ id, name, accent, levels })),
  );
}

export { isUsableWorld };
