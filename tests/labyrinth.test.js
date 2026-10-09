import { describe, it, expect } from 'vitest';
import { carveMaze, generateMaze, shortestPath, N, E, S, W } from '../src/labyrinth/maze.js';
import { mulberry32 } from '../src/labyrinth/rng.js';
import { createRun, step, resolveLock, blockingAt, isAtExit, endlessSpec } from '../src/labyrinth/state.js';
import { CHAPTERS, findChapter, nextChapter } from '../src/labyrinth/campaign.js';
import { QUESTIONS, CATEGORIES, questionsByCategory, questionsByDifficulty } from '../src/labyrinth/questions.js';
import { BUILTIN_WORLDS } from '../src/core/worlds.js';
import {
  isLabyrinthUnlocked,
  labyrinthSectorsCleared,
  labyrinthUnlockRequirement,
  persistLabyrinthSave,
} from '../src/state/labyrinthSave.js';

function reachableCount(cells, width, height) {
  const idx = (x, y) => y * width + x;
  const seen = new Uint8Array(width * height);
  const stack = [{ x: 0, y: 0 }];
  seen[0] = 1;
  let count = 1;
  const DIRS = [
    { bit: N, dx: 0, dy: -1 },
    { bit: E, dx: 1, dy: 0 },
    { bit: S, dx: 0, dy: 1 },
    { bit: W, dx: -1, dy: 0 },
  ];
  while (stack.length) {
    const { x, y } = stack.pop();
    for (const d of DIRS) {
      if (!(cells[idx(x, y)] & d.bit)) continue;
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (seen[idx(nx, ny)]) continue;
      seen[idx(nx, ny)] = 1;
      count++;
      stack.push({ x: nx, y: ny });
    }
  }
  return count;
}

describe('carveMaze', () => {
  it('connects every cell (a perfect maze is a spanning tree)', () => {
    const rng = mulberry32(42);
    const cells = carveMaze(10, 8, rng);
    expect(reachableCount(cells, 10, 8)).toBe(80);
  });

  it('is deterministic for a given seed', () => {
    const a = carveMaze(12, 9, mulberry32(1234));
    const b = carveMaze(12, 9, mulberry32(1234));
    expect([...a]).toEqual([...b]);
  });

  it('produces a different maze for a different seed', () => {
    const a = carveMaze(12, 9, mulberry32(1));
    const b = carveMaze(12, 9, mulberry32(2));
    expect([...a]).not.toEqual([...b]);
  });
});

describe('generateMaze', () => {
  it('always has a path from start to exit', () => {
    for (let seed = 0; seed < 20; seed++) {
      const maze = generateMaze(8, 8, mulberry32(seed), { gateCount: 4, secretCount: 2 });
      const path = shortestPath(maze.cells, maze.width, maze.height, maze.start, maze.exit);
      expect(path).not.toBeNull();
      expect(path[0]).toEqual(maze.start);
      expect(path[path.length - 1]).toEqual(maze.exit);
    }
  });

  it('places every gate on an edge of the main path', () => {
    const maze = generateMaze(9, 9, mulberry32(7), { gateCount: 5, secretCount: 2 });
    const path = maze.path;
    const pathEdgeSet = new Set();
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      pathEdgeSet.add(`${Math.min(a.y * 1e4 + a.x, b.y * 1e4 + b.x)}:${Math.max(a.y * 1e4 + a.x, b.y * 1e4 + b.x)}`);
    }
    for (const gate of maze.gates) expect(pathEdgeSet.has(gate)).toBe(true);
  });

  it('never places more gates or secrets than requested', () => {
    const maze = generateMaze(5, 5, mulberry32(3), { gateCount: 100, secretCount: 100 });
    // A 5x5 tree only has 24 edges total, so requesting 100 must clamp.
    expect(maze.gates.length).toBeLessThanOrEqual(maze.path.length - 1);
    expect(maze.secrets.length).toBeGreaterThanOrEqual(0);
  });
});

describe('run state', () => {
  const spec = { id: 'test', seed: 99, width: 6, height: 6, gateCount: 2, secretCount: 1, maxDifficulty: 2 };

  it('starts at the maze start, unresolved', () => {
    const run = createRun(spec);
    expect(run.player).toEqual(run.maze.start);
    expect(run.resolved.size).toBe(0);
  });

  it('blocks a step through a locked gate until resolved', () => {
    let run = createRun(spec);
    expect(run.maze.gates.length).toBeGreaterThan(0);

    // Decode the first gate edge's two cells (edgeKey packs y*1e4+x per side).
    const [a, b] = run.maze.gates[0].split(':').map(Number);
    const from = { x: a % 1e4, y: Math.floor(a / 1e4) };
    const to = { x: b % 1e4, y: Math.floor(b / 1e4) };
    const dirName =
      to.x > from.x ? 'right' : to.x < from.x ? 'left' : to.y > from.y ? 'down' : 'up';

    run = { ...run, player: from, visited: new Set([`${from.x},${from.y}`]) };
    const blocked = blockingAt(run, dirName);
    expect(blocked).toEqual({ kind: 'gate', edge: run.maze.gates[0], question: blocked.question });

    const after = step(run, dirName);
    expect(after.player).toEqual(from); // still blocked

    run = resolveLock(run, run.maze.gates[0]);
    const moved = step(run, dirName);
    expect(moved.player).toEqual(to);
  });

  it('reports arrival at the exit', () => {
    let run = createRun(spec);
    run = { ...run, player: { ...run.maze.exit } };
    expect(isAtExit(run)).toBe(true);
  });
});

describe('endlessSpec', () => {
  it('grows the maze and difficulty with depth, within caps', () => {
    const shallow = endlessSpec(0, 1);
    const deep = endlessSpec(30, 1);
    expect(deep.width).toBeGreaterThan(shallow.width);
    expect(deep.width).toBeLessThanOrEqual(24);
    expect(deep.height).toBeLessThanOrEqual(15);
    expect(deep.gateCount).toBeLessThanOrEqual(12);
    expect(deep.maxDifficulty).toBeLessThanOrEqual(3);
  });

  it('is deterministic for the same depth and seed', () => {
    expect(endlessSpec(5, 42)).toEqual(endlessSpec(5, 42));
  });
});

describe('campaign chapters', () => {
  it('has unique ids and increasing difficulty budget', () => {
    const ids = CHAPTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < CHAPTERS.length; i++) {
      expect(CHAPTERS[i].width * CHAPTERS[i].height).toBeGreaterThanOrEqual(
        CHAPTERS[i - 1].width * CHAPTERS[i - 1].height,
      );
    }
  });

  it('finds a chapter by id and its successor', () => {
    const first = CHAPTERS[0];
    expect(findChapter(first.id)).toEqual(first);
    expect(nextChapter(first.id)).toEqual(CHAPTERS[1]);
    expect(nextChapter(CHAPTERS[CHAPTERS.length - 1].id)).toBeNull();
  });
});

describe('question bank', () => {
  it('has unique ids and valid shape', () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of QUESTIONS) {
      expect(q.choices).toHaveLength(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      expect(CATEGORIES).toContain(q.category);
      expect([1, 2, 3]).toContain(q.difficulty);
    }
  });

  it('covers every category with a healthy pool', () => {
    for (const category of CATEGORIES) {
      expect(questionsByCategory(category).length).toBeGreaterThanOrEqual(20);
    }
  });

  it('filters by difficulty ceiling', () => {
    const easy = questionsByDifficulty(1);
    expect(easy.every((q) => q.difficulty === 1)).toBe(true);
    expect(easy.length).toBeGreaterThan(0);
  });
});

function saveWithSectorsCleared(count) {
  const records = {};
  for (const world of BUILTIN_WORLDS.slice(0, count)) {
    records[world.id] = {};
    for (const level of world.levels) records[world.id][level.id] = { completed: true };
  }
  return { records, totals: {} };
}

describe('labyrinth unlock gate', () => {
  it('requires half the Sokoban sectors cleared', () => {
    expect(labyrinthUnlockRequirement()).toBe(Math.ceil(BUILTIN_WORLDS.length / 2));
  });

  it('stays locked below the requirement', () => {
    const required = labyrinthUnlockRequirement();
    const app = { save: saveWithSectorsCleared(required - 1), customWorlds: [] };
    expect(labyrinthSectorsCleared(app)).toBe(required - 1);
    expect(isLabyrinthUnlocked(app)).toBe(false);
  });

  it('unlocks once the requirement is met', () => {
    const required = labyrinthUnlockRequirement();
    const app = { save: saveWithSectorsCleared(required), customWorlds: [] };
    expect(isLabyrinthUnlocked(app)).toBe(true);
  });

  it('stays open for someone who already played it, even below the requirement', () => {
    persistLabyrinthSave({ chapters: { crypt: { completed: true, bestMoves: 9, bestSeconds: 9 } }, endless: { bestDepth: 0 } }, 'p:veteran:labyrinth');
    const app = { save: saveWithSectorsCleared(0), customWorlds: [], key: (name) => `p:veteran:${name}` };
    expect(isLabyrinthUnlocked(app)).toBe(true);
  });
});
