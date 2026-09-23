/**
 * Deterministic scoring. Both source projects computed points from an
 * undocumented formula; this one is fixed, explainable and unit-tested.
 *
 *   score = BASE - 8 per move above par - 2 per second, floored at MIN
 */
export const SCORE_BASE = 1000;
export const SCORE_MIN = 100;
const MOVE_PENALTY = 8;
const TIME_PENALTY = 2;
const TIME_PENALTY_CAP = 400;

export function levelScore({ moves, par, seconds }) {
  const overPar = Math.max(0, moves - par);
  const movePenalty = overPar * MOVE_PENALTY;
  const timePenalty = Math.min(TIME_PENALTY_CAP, Math.floor(Math.max(0, seconds)) * TIME_PENALTY);
  return Math.max(SCORE_MIN, SCORE_BASE - movePenalty - timePenalty);
}

/** 3 stars at or under par, 2 within 35% over, 1 otherwise. */
export function levelStars({ moves, par }) {
  if (moves <= par) return 3;
  if (moves <= Math.ceil(par * 1.35)) return 2;
  return 1;
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function summarizeWorld(levelRecords) {
  const entries = Object.values(levelRecords ?? {});
  return {
    completed: entries.filter((r) => r?.completed).length,
    score: entries.reduce((sum, r) => sum + (r?.bestScore ?? 0), 0),
    stars: entries.reduce((sum, r) => sum + (r?.bestStars ?? 0), 0),
    moves: entries.reduce((sum, r) => sum + (r?.bestMoves ?? 0), 0),
  };
}
