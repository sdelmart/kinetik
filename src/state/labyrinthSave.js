import { read, write } from './storage.js';
import { BUILTIN_WORLDS } from '../core/worlds.js';
import { buildContext } from '../core/achievements.js';

/** The Labyrinth stays locked until at least half the Sokoban sectors are cleared. */
export const LABYRINTH_UNLOCK_RATIO = 0.5;

export function labyrinthUnlockRequirement() {
  return Math.ceil(BUILTIN_WORLDS.length * LABYRINTH_UNLOCK_RATIO);
}

export function labyrinthSectorsCleared(app) {
  return buildContext(app).sectorsComplete.length;
}

export function isLabyrinthUnlocked(app) {
  return labyrinthSectorsCleared(app) >= labyrinthUnlockRequirement();
}

const EMPTY = {
  chapters: {}, // id -> { completed: bool, bestMoves: number, bestSeconds: number }
  endless: { bestDepth: 0 },
};

export function loadLabyrinthSave(key = 'labyrinth') {
  const raw = read(key, null);
  if (!raw || typeof raw !== 'object') return structuredClone(EMPTY);
  return {
    chapters: raw.chapters && typeof raw.chapters === 'object' ? raw.chapters : {},
    endless: { bestDepth: 0, ...(raw.endless ?? {}) },
  };
}

export function persistLabyrinthSave(save, key = 'labyrinth') {
  write(key, save);
}

export function isChapterUnlocked(save, chapters, chapterId) {
  const index = chapters.findIndex((c) => c.id === chapterId);
  if (index <= 0) return true;
  return Boolean(save.chapters[chapters[index - 1].id]?.completed);
}

/** Bests only ever improve, same rule as the Sokoban save. */
export function commitChapter(save, chapterId, { moves, seconds }) {
  const previous = save.chapters[chapterId];
  const next = {
    completed: true,
    bestMoves: previous?.completed ? Math.min(previous.bestMoves, moves) : moves,
    bestSeconds: previous?.completed ? Math.min(previous.bestSeconds, seconds) : seconds,
  };
  return { ...save, chapters: { ...save.chapters, [chapterId]: next } };
}

export function commitEndlessDepth(save, depth) {
  if (depth <= save.endless.bestDepth) return save;
  return { ...save, endless: { bestDepth: depth } };
}
