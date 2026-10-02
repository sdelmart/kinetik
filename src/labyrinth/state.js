import { N, E, S, W, edgeKey, generateMaze } from './maze.js';
import { QUESTIONS } from './questions.js';
import { mulberry32, shuffle } from './rng.js';

const DIR_BITS = { up: N, right: E, down: S, left: W };
const DELTA = { up: { dx: 0, dy: -1 }, right: { dx: 1, dy: 0 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 } };

/**
 * Builds a playable run from a chapter spec (or an endless-mode spec built on
 * the fly) — the maze itself, which edges start locked, and a question drawn
 * per lock so the same run always offers the same prompts.
 */
export function createRun(spec) {
  const rng = mulberry32(spec.seed);
  const maze = generateMaze(spec.width, spec.height, rng, {
    gateCount: spec.gateCount,
    secretCount: spec.secretCount,
  });

  const pool = shuffle(rng, QUESTIONS.filter((q) => q.difficulty <= spec.maxDifficulty));
  const locks = new Map();
  let p = 0;
  for (const key of maze.gates) locks.set(key, { kind: 'gate', question: pool[p++ % pool.length] });
  for (const key of maze.secrets) locks.set(key, { kind: 'secret', question: pool[p++ % pool.length] });

  return {
    spec,
    maze,
    locks,
    resolved: new Set(),
    player: { ...maze.start },
    visited: new Set([cellKey(maze.start)]),
    moves: 0,
    startedAt: Date.now(),
  };
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

/** Difficulty scaling for endless mode: every 3 floors, the maze grows and hardens. */
export function endlessSpec(depth, seed) {
  const tier = Math.floor(depth / 3);
  return {
    id: `endless-${depth}`,
    seed: seed ^ (depth * 0x9e3779b1),
    width: Math.min(18, 6 + tier),
    height: Math.min(14, 5 + tier),
    gateCount: Math.min(10, 2 + tier),
    secretCount: Math.min(4, 1 + Math.floor(tier / 2)),
    maxDifficulty: Math.min(3, 1 + Math.floor(depth / 5)),
  };
}
