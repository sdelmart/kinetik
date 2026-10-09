import { randInt, shuffle } from './rng.js';

/**
 * A cell is a bitmask of which of its four sides are open passages. Generation
 * carves a perfect maze (a spanning tree over the grid — exactly one path
 * between any two cells, so it is solvable by construction, not by testing
 * after the fact), then a handful of extra walls are knocked through to create
 * loops. Those loop edges are *not* opened for free: the game locks each one
 * behind a riddle, so finding them is what "discovering a passage" means.
 *
 * Edges that sit on the main (tree) path can additionally be sealed behind a
 * trivia question — since the tree has no alternate route, answering one is
 * mandatory to continue, while a secret passage is always an optional shortcut.
 */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

const DIRS = [
  { bit: N, opp: S, dx: 0, dy: -1 },
  { bit: E, opp: W, dx: 1, dy: 0 },
  { bit: S, opp: N, dx: 0, dy: 1 },
  { bit: W, opp: E, dx: -1, dy: 0 },
];

const key = (x, y) => y * 1e4 + x;
export const edgeKey = (ax, ay, bx, by) => {
  const a = key(ax, ay);
  const b = key(bx, by);
  return a < b ? `${a}:${b}` : `${b}:${a}`;
};

function inBounds(x, y, width, height) {
  return x >= 0 && y >= 0 && x < width && y < height;
}

/**
 * Growing-tree carve. Always extending the newest cell gives a depth-first
 * maze — long winding corridors, few dead ends, easy to follow. Picking a
 * random active cell some of the time adds side branches and many more dead
 * ends, which is what makes a maze genuinely hard to read. `branching` is
 * the share of random picks (0 = pure depth-first).
 */
export function carveMaze(width, height, rng, branching = 0.35) {
  const cells = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const idx = (x, y) => y * width + x;

  const start = { x: randInt(rng, width), y: randInt(rng, height) };
  visited[idx(start.x, start.y)] = 1;
  const active = [start];

  while (active.length) {
    const at = rng() < branching ? randInt(rng, active.length) : active.length - 1;
    const { x, y } = active[at];
    const options = shuffle(rng, DIRS).filter((d) => {
      const nx = x + d.dx;
      const ny = y + d.dy;
      return inBounds(nx, ny, width, height) && !visited[idx(nx, ny)];
    });

    if (!options.length) {
      active.splice(at, 1);
      continue;
    }

    const dir = options[0];
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    cells[idx(x, y)] |= dir.bit;
    cells[idx(nx, ny)] |= dir.opp;
    visited[idx(nx, ny)] = 1;
    active.push({ x: nx, y: ny });
  }

  return cells;
}

/** The cell farthest (by walking distance) from `start` — the hardest place to put an exit. */
export function farthestCell(cells, width, height, start) {
  const idx = (x, y) => y * width + x;
  const dist = new Int32Array(width * height).fill(-1);
  dist[idx(start.x, start.y)] = 0;
  const queue = [start];
  let best = start;
  for (let head = 0; head < queue.length; head++) {
    const { x, y } = queue[head];
    if (dist[idx(x, y)] > dist[idx(best.x, best.y)]) best = { x, y };
    for (const d of DIRS) {
      if (!(cells[idx(x, y)] & d.bit)) continue;
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (dist[idx(nx, ny)] !== -1) continue;
      dist[idx(nx, ny)] = dist[idx(x, y)] + 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return best;
}

/** BFS shortest path between two cells, returned as an ordered list of {x,y}. */
export function shortestPath(cells, width, height, start, exit) {
  const idx = (x, y) => y * width + x;
  const prev = new Int32Array(width * height).fill(-1);
  const visited = new Uint8Array(width * height);
  const queue = [start];
  visited[idx(start.x, start.y)] = 1;

  while (queue.length) {
    const { x, y } = queue.shift();
    if (x === exit.x && y === exit.y) break;
    for (const d of DIRS) {
      if (!(cells[idx(x, y)] & d.bit)) continue;
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (visited[idx(nx, ny)]) continue;
      visited[idx(nx, ny)] = 1;
      prev[idx(nx, ny)] = idx(x, y);
      queue.push({ x: nx, y: ny });
    }
  }

  const path = [];
  let cur = idx(exit.x, exit.y);
  if (!visited[cur]) return null;
  while (cur !== -1) {
    path.unshift({ x: cur % width, y: Math.floor(cur / width) });
    cur = prev[cur];
  }
  return path;
}

/** Knocks `count` extra walls through at random, each creating exactly one loop. */
export function addLoopEdges(cells, width, height, rng, count) {
  const idx = (x, y) => y * width + x;
  const candidates = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (const d of DIRS) {
        if (d.bit === N || d.bit === W) continue; // dedupe: each wall has one owner
        const nx = x + d.dx;
        const ny = y + d.dy;
        if (!inBounds(nx, ny, width, height)) continue;
        if (cells[idx(x, y)] & d.bit) continue; // already open
        candidates.push({ x, y, nx, ny, d });
      }
    }
  }

  const chosen = shuffle(rng, candidates).slice(0, count);
  for (const { x, y, nx, ny, d } of chosen) {
    cells[idx(x, y)] |= d.bit;
    cells[idx(nx, ny)] |= d.opp;
  }
  return chosen.map(({ x, y, nx, ny }) => edgeKey(x, y, nx, ny));
}

/**
 * Builds a full maze: the tree, a few loop edges (secret passages), and a set
 * of mandatory gates picked from the main path. `path` is the pre-loop
 * shortest route, so gates are guaranteed on the only way through.
 */
export function generateMaze(width, height, rng, { secretCount = 3, gateCount = 4, branching = 0.35 } = {}) {
  const cells = carveMaze(width, height, rng, branching);
  const start = { x: 0, y: 0 };
  const exit = farthestCell(cells, width, height, start);
  const path = shortestPath(cells, width, height, start, exit);

  const pathEdges = [];
  for (let i = 0; i < path.length - 1; i++) {
    pathEdges.push(edgeKey(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y));
  }
  const gates = shuffle(rng, pathEdges).slice(0, Math.min(gateCount, pathEdges.length));
  const secrets = addLoopEdges(cells, width, height, rng, secretCount);

  return { width, height, cells, start, exit, path, gates, secrets };
}
