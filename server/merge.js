/**
 * Pure merge logic for /api/profile/sync, kept separate from index.js so it
 * can be unit tested without importing (and thereby starting) the Express
 * app. See the comment above the endpoint in index.js for the rationale:
 * numbers that only ever grow take the max, per-level/per-chapter bests take
 * whichever is actually better, achievement lists union.
 */

export const finite = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);

export function mergeTotals(a = {}, b = {}) {
  const keys = ['moves', 'pushes', 'seconds', 'score', 'runs', 'hintFreeClears'];
  const out = {};
  for (const k of keys) out[k] = Math.max(finite(a[k]), finite(b[k]));
  return out;
}

export function mergeLevelRecord(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    completed: Boolean(a.completed || b.completed),
    bestScore: Math.max(finite(a.bestScore), finite(b.bestScore)),
    bestStars: Math.max(finite(a.bestStars), finite(b.bestStars)),
    bestMoves: Math.min(finite(a.bestMoves, Infinity), finite(b.bestMoves, Infinity)),
    bestTime: Math.min(finite(a.bestTime, Infinity), finite(b.bestTime, Infinity)),
    playCount: Math.max(finite(a.playCount), finite(b.playCount)),
    playedAt: Math.max(finite(a.playedAt), finite(b.playedAt)),
  };
}

export function mergeRecords(a = {}, b = {}) {
  const out = {};
  for (const worldId of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const wa = a[worldId] ?? {};
    const wb = b[worldId] ?? {};
    out[worldId] = {};
    for (const levelId of new Set([...Object.keys(wa), ...Object.keys(wb)])) {
      out[worldId][levelId] = mergeLevelRecord(wa[levelId], wb[levelId]);
    }
  }
  return out;
}

export function mergeSave(a, b) {
  const sa = a && typeof a === 'object' ? a : {};
  const sb = b && typeof b === 'object' ? b : {};
  return { records: mergeRecords(sa.records, sb.records), totals: mergeTotals(sa.totals, sb.totals) };
}

export function mergeAchievements(a, b) {
  const sa = Array.isArray(a) ? a : [];
  const sb = Array.isArray(b) ? b : [];
  return [...new Set([...sa, ...sb])].filter((id) => typeof id === 'string');
}

export function mergeChapters(a = {}, b = {}) {
  const out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const ca = a[id];
    const cb = b[id];
    if (!ca) out[id] = cb;
    else if (!cb) out[id] = ca;
    else {
      out[id] = {
        completed: Boolean(ca.completed || cb.completed),
        bestMoves: Math.min(finite(ca.bestMoves, Infinity), finite(cb.bestMoves, Infinity)),
        bestSeconds: Math.min(finite(ca.bestSeconds, Infinity), finite(cb.bestSeconds, Infinity)),
      };
    }
  }
  return out;
}

export function mergeLabyrinth(a, b) {
  const la = a && typeof a === 'object' ? a : {};
  const lb = b && typeof b === 'object' ? b : {};
  return {
    chapters: mergeChapters(la.chapters, lb.chapters),
    endless: { bestDepth: Math.max(finite(la.endless?.bestDepth), finite(lb.endless?.bestDepth)) },
  };
}
