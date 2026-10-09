import { N, E, S, W, edgeKey, generateMaze } from './maze.js';
import { QUESTIONS } from './questions.js';
import { generateQuestion } from './generatedQuestions.js';
import { mulberry32, shuffle } from './rng.js';

const DIR_BITS = { up: N, right: E, down: S, left: W };
const DELTA = { up: { dx: 0, dy: -1 }, right: { dx: 1, dy: 0 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 } };

/** Moves added to the run for each wrong answer — guessing has a cost. */
export const WRONG_ANSWER_PENALTY = 5;

/**
 * Hands out questions for one run: written ones in the difficulty range,
 * preferring ones this player hasn't seen yet, mixed with freshly generated
 * puzzles so a run never has to repeat itself.
 */
export function createQuestionSource(spec, rng) {
  const min = spec.minDifficulty ?? 1;
  const max = spec.maxDifficulty ?? 3;
  const avoid = spec.avoid ?? new Set();
  const inRange = QUESTIONS.filter((q) => q.difficulty >= min && q.difficulty <= max);
  const fresh = inRange.filter((q) => !avoid.has(q.id));
  // Once a player has seen nearly everything in range, start over rather than run dry.
  const written = shuffle(rng, fresh.length >= 6 ? fresh : inRange);
  const generatedShare = max >= 2 ? (spec.generatedShare ?? 0.4) : 0;
  let next = 0;

  return function nextQuestion() {
    if (generatedShare && (rng() < generatedShare || next >= written.length)) {
      const lowest = Math.max(2, min);
      return generateQuestion(rng, lowest + Math.floor(rng() * (max - lowest + 1)));
    }
    return written[next++ % written.length];
  };
}

/**
 * Builds a playable run from a chapter spec (or an endless-mode spec built on
 * the fly) — the maze itself, which edges start locked, and a question per lock.
 */
export function createRun(spec) {
  const rng = mulberry32(spec.seed);
  const maze = generateMaze(spec.width, spec.height, rng, {
    gateCount: spec.gateCount,
    secretCount: spec.secretCount,
    branching: spec.branching,
  });

  // Questions use their own stream, so which questions a player has already
  // seen never changes the layout of a fixed campaign maze.
  const nextQuestion = createQuestionSource(spec, mulberry32(spec.seed ^ (Date.now() & 0xffff)));
  const locks = new Map();
  for (const key of maze.gates) locks.set(key, { kind: 'gate', question: nextQuestion() });
  for (const key of maze.secrets) locks.set(key, { kind: 'secret', question: nextQuestion() });

  return {
    spec,
    maze,
    locks,
    nextQuestion,
    resolved: new Set(),
    player: { ...maze.start },
    visited: new Set([cellKey(maze.start)]),
    moves: 0,
    hintsLeft: spec.hintBudget ?? 2,
    startedAt: Date.now(),
  };
}

/**
 * A wrong answer: the lock gets a different question (so the other choices
 * can't simply be tried one after another) and the run pays a move penalty.
 */
export function failLock(run, edge) {
  const lock = run.locks.get(edge);
  if (!lock) return run;
  const locks = new Map(run.locks);
  locks.set(edge, { ...lock, question: run.nextQuestion() });
  return { ...run, locks, moves: run.moves + WRONG_ANSWER_PENALTY };
}

/** Spends one of the run's hints, if any are left. */
export function spendHint(run) {
  return run.hintsLeft > 0 ? { ...run, hintsLeft: run.hintsLeft - 1 } : run;
}

function cellKey(pos) {
  return `${pos.x},${pos.y}`;
}

/** The wall/lock state blocking a move, or null if the step is free. */
export function blockingAt(run, dirName) {
  const { maze, player } = run;
  const bit = DIR_BITS[dirName];
  const idx = player.y * maze.width + player.x;
  if (!(maze.cells[idx] & bit)) return { kind: 'wall' };

  const d = DELTA[dirName];
  const nx = player.x + d.dx;
  const ny = player.y + d.dy;
  const key = edgeKey(player.x, player.y, nx, ny);
  const lock = run.locks.get(key);
  if (lock && !run.resolved.has(key)) return { kind: lock.kind, edge: key, question: lock.question };
  return null;
}

/** Attempts to step; returns the new run state, or the same one if blocked. */
export function step(run, dirName) {
  const blocked = blockingAt(run, dirName);
  if (blocked) return run;

  const d = DELTA[dirName];
  const player = { x: run.player.x + d.dx, y: run.player.y + d.dy };
  const visited = new Set(run.visited);
  visited.add(cellKey(player));
  return { ...run, player, visited, moves: run.moves + 1 };
}

/** Marks an edge's lock as solved, permanently opening it for this run. */
export function resolveLock(run, edgeKey) {
  const resolved = new Set(run.resolved);
  resolved.add(edgeKey);
  return { ...run, resolved };
}

export function isAtExit(run) {
  return run.player.x === run.maze.exit.x && run.player.y === run.maze.exit.y;
}

const DIFFICULTY_CAPS = { easy: 1, medium: 2, hard: 3 };

/**
 * The player's chosen general-knowledge level (from Settings) overrides a
 * chapter's or floor's own built-in difficulty cap outright — 'auto' is the
 * only choice that keeps the automatic per-chapter/per-depth progression.
 */
export function resolveMaxDifficulty(preference, autoValue) {
  return DIFFICULTY_CAPS[preference] ?? autoValue;
}

/**
 * Full range version: an explicit level means exactly that level, while
 * 'auto' keeps the chapter's own range, whose floor rises through the
 * campaign so late chapters stop handing out easy questions.
 */
export function resolveDifficultyRange(preference, autoMin, autoMax) {
  const cap = DIFFICULTY_CAPS[preference];
  if (cap) return { minDifficulty: cap, maxDifficulty: cap };
  return { minDifficulty: Math.min(autoMin ?? 1, autoMax), maxDifficulty: autoMax };
}

/** Difficulty scaling for endless mode: every 3 floors the maze grows, darkens and hardens. */
export function endlessSpec(depth, seed) {
  const tier = Math.floor(depth / 3);
  return {
    id: `endless-${depth}`,
    seed: seed ^ (depth * 0x9e3779b1),
    width: Math.min(24, 9 + tier * 2),
    height: Math.min(15, 7 + tier),
    gateCount: Math.min(12, 3 + tier),
    secretCount: Math.min(5, 1 + Math.floor(tier / 2)),
    minDifficulty: Math.min(3, 1 + Math.floor(depth / 4)),
    maxDifficulty: Math.min(3, 2 + Math.floor(depth / 4)),
    vision: depth < 3 ? null : Math.max(2, 5 - Math.floor(depth / 4)),
    hintBudget: 1,
  };
}
