/**
 * Generates the built-in Sokoban campaign: 8 sectors x 10 levels that are
 * genuinely hard and all different from each other.
 *
 *   node scripts/generate-campaign.js            generate and print a report
 *   node scripts/generate-campaign.js --write    also rewrite src/core/campaign.json
 *   options: --seconds=70 (search time per candidate)  --only=assembly,cryo
 *            --workers=5  --fresh (ignore results cached by a previous run)
 *            --count=4 (candidates per sector for this run)  --seed=N
 * Selection draws on every cached candidate of a sector, so a later run with
 * another --seed only adds options; it never throws earlier ones away.
 *
 * Each finished candidate is appended to a cache file straight away, so an
 * interrupted run (or one killed for memory) resumes instead of starting over.
 *
 * How: every candidate starts as a random room using its sector's mechanics,
 * then evolves (simulated annealing) by small edits — a wall, a container,
 * a target, a special tile — keeping edits that make it harder. Difficulty is
 * measured by solving it optimally with the game's own rules engine
 * (src/core/rules.js), so a level can never rely on behaviour the game
 * doesn't actually have. A candidate only counts if its optimal solution
 * really uses the sector's signature mechanic. Each sector generates a few
 * spare candidates and keeps the best ten, ordered easiest to hardest.
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { availableParallelism, tmpdir } from 'node:os';

import { parseCompact, validateLevel } from '../src/core/level.js';
import { createState, isSolved } from '../src/core/state.js';
import { step } from '../src/core/rules.js';
import { T } from '../src/core/constants.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(here, '../src/core/campaign.json');

// --- sectors -----------------------------------------------------------------

/**
 * `pool`: special tiles this sector may use (cumulative, like the original
 * campaign). `signature`: the mechanic a level's solution must exercise.
 */
export const SECTORS = [
  { id: 'assembly', accent: '#00e5ff', pool: [], signature: null, maxBoxes: 5 },
  { id: 'foundry', accent: '#ff7a29', pool: ['pit', 'fragile'], signature: ['fill', 'break'], maxBoxes: 4 },
  { id: 'cryo', accent: '#7ae7ff', pool: ['ice', 'pit'], signature: ['ice'], maxBoxes: 4 },
  { id: 'reactor', accent: '#ff2d95', pool: ['conveyor', 'ice', 'pit', 'fragile'], signature: ['conveyor'], maxBoxes: 4 },
  { id: 'core', accent: '#ffb300', pool: ['conveyor', 'ice', 'teleport', 'switch', 'pit'], signature: ['teleport', 'gate'], maxBoxes: 4 },
  { id: 'transit', accent: '#8b5cf6', pool: ['oneway', 'conveyor', 'ice', 'teleport', 'switch', 'pit', 'fragile'], signature: ['oneway'], maxBoxes: 4 },
  { id: 'vault', accent: '#d4a017', pool: ['key', 'oneway', 'conveyor', 'ice', 'switch', 'pit', 'fragile'], signature: ['key'], maxBoxes: 4 },
  { id: 'mirror', accent: '#ff5c8a', pool: ['twins', 'key', 'oneway', 'conveyor', 'ice', 'switch', 'pit', 'fragile'], signature: ['twin'], maxBoxes: 4 },
];

const CANDIDATES_PER_SECTOR = 12;
const LEVELS_PER_SECTOR = 10;
const MAX_STATES = 200000;
const MIN_OPENING_PUSHES = 9;

// --- tiny seeded rng ----------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (rng, n) => Math.floor(rng() * n);
const pick = (rng, list) => list[randInt(rng, list.length)];

// --- grid model ----------------------------------------------------------------
// terrain: '#', '.', '*', and special tiles; entity: null | '@' | '$' | '1' | '2'

const SPECIAL_TILES = {
  pit: ['o'],
  fragile: ['~'],
  ice: ['_'],
  conveyor: ['^', '>', 'v', '<'],
  oneway: ['U', 'R', 'D', 'L'],
};

function cloneGrid(g) {
  return { w: g.w, h: g.h, t: g.t.map((r) => [...r]), e: g.e.map((r) => [...r]) };
}

function toRows(g) {
  const rows = [];
  for (let y = 0; y < g.h; y++) {
    let row = '';
    for (let x = 0; x < g.w; x++) {
      const t = g.t[y][x];
      const e = g.e[y][x];
      if (!e) row += t;
      else if (t === '*') row += { '@': '+', $: '&', 1: '3', 2: '4' }[e];
      else row += e;
    }
    rows.push(row);
  }
  return rows;
}

const inner = (g) => {
  const cells = [];
  for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) cells.push([x, y]);
  return cells;
};
const isPlain = (g, x, y) => (g.t[y][x] === '.' || g.t[y][x] === '*') ;
const freeFloor = (g) => inner(g).filter(([x, y]) => g.t[y][x] === '.' && !g.e[y][x]);
const entityCells = (g, kind) => inner(g).filter(([x, y]) => g.e[y][x] === kind);
const tileCells = (g, glyphs) => inner(g).filter(([x, y]) => glyphs.includes(g.t[y][x]));

/** Walls off everything not connected to the largest open region. */
function keepLargestRegion(g) {
  const seen = new Set();
  let best = [];
  for (const [sx, sy] of inner(g)) {
    if (g.t[sy][sx] === '#' || seen.has(`${sx},${sy}`)) continue;
    const region = [];
    const stack = [[sx, sy]];
    seen.add(`${sx},${sy}`);
    while (stack.length) {
      const [x, y] = stack.pop();
      region.push([x, y]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (g.t[ny][nx] === '#' || seen.has(`${nx},${ny}`)) continue;
        seen.add(`${nx},${ny}`);
        stack.push([nx, ny]);
      }
    }
    if (region.length > best.length) best = region;
  }
  const keep = new Set(best.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of inner(g)) {
    if (!keep.has(`${x},${y}`)) {
      g.t[y][x] = '#';
      g.e[y][x] = null;
    }
  }
}

function placeOnFree(g, rng, terrain, entity) {
  const free = freeFloor(g);
  if (!free.length) return false;
  const [x, y] = pick(rng, free);
  if (terrain) g.t[y][x] = terrain;
  if (entity) g.e[y][x] = entity;
  return true;
}

function randomRoom(spec, rng) {
  const w = spec.w + 2;
  const h = spec.h + 2;
  const g = {
    w,
    h,
    t: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#' : '.'))),
    e: Array.from({ length: h }, () => Array(w).fill(null)),
  };
  for (const [x, y] of inner(g)) if (rng() < spec.walls) g.t[y][x] = '#';
  keepLargestRegion(g);

  for (let i = 0; i < spec.boxes; i++) placeOnFree(g, rng, '*', null);
  for (let i = 0; i < spec.boxes; i++) placeOnFree(g, rng, null, '$');
  placeOnFree(g, rng, null, '@');
  for (const mechanic of spec.mechanics) addMechanic(g, rng, mechanic);
  return g;
}

/** Adds one instance of a mechanic, keeping its pairing rules valid. */
function addMechanic(g, rng, mechanic) {
  if (SPECIAL_TILES[mechanic]) {
    const ok = placeOnFree(g, rng, pick(rng, SPECIAL_TILES[mechanic]), null);
    // Each pit swallows a container for good, so it needs a spare one.
    if (ok && mechanic === 'pit') placeOnFree(g, rng, null, '$');
    return;
  }
  if (mechanic === 'teleport' && !tileCells(g, ['a']).length) {
    placeOnFree(g, rng, 'a', null);
    placeOnFree(g, rng, 'b', null);
  } else if (mechanic === 'switch') {
    if (!tileCells(g, ['s']).length) placeOnFree(g, rng, 's', null);
    placeOnFree(g, rng, 'g', null);
  } else if (mechanic === 'key') {
    if (!tileCells(g, ['k']).length) {
      placeOnFree(g, rng, 'k', null);
      placeOnFree(g, rng, null, '$'); // the key container stays in its keyhole
    }
    placeOnFree(g, rng, 'q', null);
  } else if (mechanic === 'twins' && !entityCells(g, '1').length) {
    const crates = entityCells(g, '$');
    if (crates.length >= 2) {
      const [a, b] = [crates[0], crates[crates.length - 1]];
      g.e[a[1]][a[0]] = '1';
      g.e[b[1]][b[0]] = '2';
    }
  }
}

// --- mutation -------------------------------------------------------------------

function mutate(g0, sector, rng) {
  const g = cloneGrid(g0);
  const edits = 1 + randInt(rng, 3);
  for (let i = 0; i < edits; i++) {
    const op = rng();
    const cells = inner(g);
    if (op < 0.4) {
      // Toggle a wall.
      const [x, y] = pick(rng, cells);
      if (g.e[y][x] || !(g.t[y][x] === '.' || g.t[y][x] === '#')) continue;
      g.t[y][x] = g.t[y][x] === '#' ? '.' : '#';
    } else if (op < 0.75) {
      // Move a container, a target or the drone.
      const kind = pick(rng, ['crate', 'crate', 'target', 'target', 'player']);
      if (kind === 'target') {
        const targets = tileCells(g, ['*']);
        const free = inner(g).filter(([x, y]) => g.t[y][x] === '.');
        if (!targets.length || !free.length) continue;
        const [fx, fy] = pick(rng, targets);
        const [tx, ty] = pick(rng, free);
        g.t[fy][fx] = '.';
        g.t[ty][tx] = '*';
        // An entity standing on the old target stays on plain floor.
      } else {
        const glyph = kind === 'player' ? '@' : pick(rng, ['$', '$', '1', '2']);
        const from = entityCells(g, glyph);
        const to = inner(g).filter(([x, y]) => isPlain(g, x, y) && !g.e[y][x]);
        if (!from.length || !to.length) continue;
        const [fx, fy] = pick(rng, from);
        const [tx, ty] = pick(rng, to);
        g.e[ty][tx] = g.e[fy][fx];
        g.e[fy][fx] = null;
      }
    } else if (sector.pool.length) {
      // Move, reshape or add a special tile.
      const specials = inner(g).filter(([x, y]) => !['.', '*', '#'].includes(g.t[y][x]));
      const r = rng();
      if (r < 0.45 && specials.length) {
        const [fx, fy] = pick(rng, specials);
        const free = freeFloor(g);
        if (!free.length) continue;
        const [tx, ty] = pick(rng, free);
        g.t[ty][tx] = g.t[fy][fx];
        g.t[fy][fx] = '.';
      } else if (r < 0.7 && specials.length) {
        // Re-orient a directional tile.
        const [x, y] = pick(rng, specials);
        for (const glyphs of [SPECIAL_TILES.conveyor, SPECIAL_TILES.oneway]) {
          if (glyphs.includes(g.t[y][x])) g.t[y][x] = pick(rng, glyphs);
        }
      } else {
        const mechanic = pick(rng, sector.pool);
        if (mechanic !== 'twins' && mechanic !== 'teleport') addMechanic(g, rng, mechanic);
        else if (SPECIAL_TILES[mechanic]) addMechanic(g, rng, mechanic);
      }
    } else {
      const [x, y] = pick(rng, cells);
      if (!g.e[y][x] && g.t[y][x] === '#') g.t[y][x] = '.';
    }
  }
  return g;
}

// --- evaluation -----------------------------------------------------------------

function stateKeyFn(start) {
  const mutable = [];
  for (let i = 0; i < start.terrain.length; i++) {
    const t = start.terrain[i];
    if (t === T.PIT || t === T.FRAGILE || t === T.KEYHOLE) mutable.push(i);
  }
  return (s) => {
    let k = `${s.player}|${[...s.crates].sort((a, b) => a - b).join(',')}|`;
    for (const i of mutable) k += String.fromCharCode(48 + s.terrain[i]);
    if (s.twins.size) k += `|${[...s.twins.keys()].sort((a, b) => a - b).join(',')}`;
    return k;
  };
}

const DIRS = ['up', 'right', 'down', 'left'];

/** Optimal (fewest moves) solution by breadth-first search, with parent links instead of copied paths. */
export function solveOptimal(level, maxStates = MAX_STATES) {
  const start = createState(level);
  if (isSolved(start)) return { solved: false, trivial: true };
  const key = stateKeyFn(start);
  const seen = new Map([[key(start), 0]]);
  const parent = [-1];
  const via = [-1];
  let frontier = [{ id: 0, state: start }];
  while (frontier.length) {
    const next = [];
    for (const node of frontier) {
      for (let d = 0; d < 4; d++) {
        const result = step(node.state, DIRS[d]);
        if (!result) continue;
        const k = key(result.state);
        if (seen.has(k)) continue;
        const id = parent.length;
        seen.set(k, id);
        parent.push(node.id);
        via.push(d);
        if (isSolved(result.state)) {
          const moves = [];
          for (let cur = id; cur > 0; cur = parent[cur]) moves.push(DIRS[via[cur]]);
          moves.reverse();
          return { solved: true, moves, explored: parent.length };
        }
        if (parent.length >= maxStates) return { solved: false, explored: parent.length };
        next.push({ id, state: result.state });
      }
    }
    frontier = next;
  }
  return { solved: false, explored: parent.length };
}

const ONEWAY = new Set([T.ONEWAY_UP, T.ONEWAY_RIGHT, T.ONEWAY_DOWN, T.ONEWAY_LEFT]);
const CONVEYOR = new Set([T.CONV_UP, T.CONV_RIGHT, T.CONV_DOWN, T.CONV_LEFT]);

/** Replays a solution and measures how it was solved. */
export function analyse(level, moves) {
  let state = createState(level);
  const used = new Set();
  let pushes = 0;
  let switches = 0;
  let lastCrateRest = -1;
  for (const dir of moves) {
    const before = state;
    const result = step(state, dir);
    state = result.state;
    const pushed = result.events.some((e) => e.type === 'push');
    if (pushed) {
      pushes++;
      const pushedFrom = state.player; // the drone ends where the container was
      const appeared = [...state.crates].filter((c) => !before.crates.has(c));
      if (pushedFrom !== lastCrateRest) switches++;
      lastCrateRest = appeared[0] ?? -1;
    }
    for (const e of result.events) {
      if (e.type === 'fill') used.add('fill');
      if (e.type === 'break') used.add('break');
      if (e.type === 'teleport') used.add('teleport');
      if (e.type === 'key') used.add('key');
      if (e.type === 'push' && e.twin) used.add('twin');
      if (e.type === 'slide') {
        const tile = before.terrain[e.from];
        if (tile === T.ICE) used.add('ice');
        if (CONVEYOR.has(tile)) used.add('conveyor');
      }
    }
    const cells = [state.player, ...state.crates];
    for (const c of cells) {
      if (state.terrain[c] === T.GATE || state.terrain[c] === T.GATE_KEY) used.add('gate');
      if (ONEWAY.has(state.terrain[c])) used.add('oneway');
    }
  }
  return { pushes, switches, used, solved: isSolved(state) };
}

function evaluate(g, sector) {
  const rows = toRows(g);
  const level = parseCompact(rows, { par: 999 });
  if (!validateLevel(level).ok) return null;
  const result = solveOptimal(level);
  if (!result.solved) return null;
  const stats = analyse(level, result.moves);
  const signatureMet = !sector.signature || sector.signature.some((m) => stats.used.has(m));
  const fitness =
    stats.pushes * 3 +
    stats.switches * 10 +
    result.moves.length * 0.15 +
    Math.log10(result.explored) * 10 +
    stats.used.size * 6 -
    // Past ~300 moves a level gets tedious rather than harder.
    Math.max(0, result.moves.length - 300) * 0.6 -
    (signatureMet ? 0 : 400);
  return { rows, moves: result.moves.map((d) => d[0]).join(''), explored: result.explored, ...stats, used: [...stats.used], signatureMet, fitness };
}

// --- search ------------------------------------------------------------------

function specFor(sector, slot, rng) {
  const d = slot / (CANDIDATES_PER_SECTOR - 1);
  const boxes = Math.min(sector.maxBoxes, 2 + Math.round(d * (sector.maxBoxes - 2)) + (rng() < 0.25 ? 1 : 0));
  const mechanics = [];
  if (sector.pool.length) {
    const count = 2 + Math.round(d * 3);
    // The signature mechanic is always present; the rest are drawn from the pool.
    const signatureMechanic = {
      fill: 'pit', break: 'fragile', ice: 'ice', conveyor: 'conveyor', teleport: 'teleport', gate: 'switch', oneway: 'oneway', key: 'key', twin: 'twins',
    }[sector.signature[0]];
    mechanics.push(signatureMechanic, signatureMechanic);
    for (let i = 0; i < count; i++) mechanics.push(pick(rng, sector.pool));
  }
  return {
    w: 5 + Math.round(d * 2) + randInt(rng, 2),
    h: 4 + Math.round(d * 2) + randInt(rng, 2),
    walls: 0.16 + rng() * 0.12,
    boxes: Math.min(boxes, sector.maxBoxes),
    mechanics,
  };
}

function evolve(sector, slot, seed, seconds) {
  const rng = mulberry32(seed);
  const deadline = Date.now() + seconds * 1000;

  // A solvable starting point first.
  let current = null;
  let currentEval = null;
  while (!currentEval && Date.now() < deadline) {
    current = randomRoom(specFor(sector, slot, rng), rng);
    currentEval = evaluate(current, sector);
  }
  if (!currentEval) return null;

  let best = current;
  let bestEval = currentEval;
  let temperature = 25;
  let evaluations = 0;
  while (Date.now() < deadline) {
    const candidate = mutate(current, sector, rng);
    const result = evaluate(candidate, sector);
    evaluations++;
    temperature = Math.max(0.5, temperature * 0.985);
    if (!result) continue;
    const delta = result.fitness - currentEval.fitness;
    if (delta >= 0 || rng() < Math.exp(delta / temperature)) {
      current = candidate;
      currentEval = result;
      if (result.fitness > bestEval.fitness) {
        best = candidate;
        bestEval = result;
      }
    }
  }
  return { sector: sector.id, slot, seed, evaluations, ...bestEval, size: `${best.w}x${best.h}` };
}

// --- orchestration --------------------------------------------------------------

const parFor = (optimal) => Math.ceil(optimal * 1.15) + 1;

if (!isMainThread) {
  const { jobs, seconds } = workerData;
  for (const job of jobs) {
    const sector = SECTORS.find((s) => s.id === job.sector);
    parentPort.postMessage(evolve(sector, job.slot, job.seed, seconds));
  }
} else {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    }),
  );
  const seconds = Number(args.seconds ?? 70);
  const only = args.only ? String(args.only).split(',') : null;
  const sectors = SECTORS.filter((s) => !only || only.includes(s.id));
  const baseSeed = Number(args.seed ?? 20261009);

  const jobs = [];
  for (const [si, sector] of sectors.entries()) {
    const count = Number(args.count ?? CANDIDATES_PER_SECTOR);
    for (let i = 0; i < count; i++) {
      // Spread this run's candidates over the whole difficulty range.
      const slot = count === 1 ? 0 : Math.round((i * (CANDIDATES_PER_SECTOR - 1)) / (count - 1));
      jobs.push({ sector: sector.id, slot, seed: baseSeed + si * 1000 + slot * 7 });
    }
  }
  // Every finished candidate is cached immediately, so a killed run resumes.
  const cachePath = String(args.cache ?? resolve(tmpdir(), 'kinetik-campaign-cache.jsonl'));
  const cached = !args.fresh && existsSync(cachePath)
    ? readFileSync(cachePath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
    : [];
  if (args.fresh) writeFileSync(cachePath, '');
  const results = cached.filter((r) => sectors.some((sector) => sector.id === r.sector));
  const pending = jobs.filter((j) => !results.some((r) => r.sector === j.sector && r.slot === j.slot && r.seed === j.seed));
  console.log(`cache: ${cachePath} (${results.length} already done)`);

  // Each search can hold a couple of hundred thousand positions; too many in
  // parallel and the OS kills the run for memory.
  const workers = Math.max(1, Math.min(Number(args.workers ?? 5), availableParallelism(), pending.length));
  const chunks = Array.from({ length: workers }, (_, i) => pending.filter((_, j) => j % workers === i));
  console.log(`${pending.length} candidates to go, ${workers} workers, ${seconds}s each (~${Math.ceil((pending.length / workers) * seconds / 60)} min)`);

  await Promise.all(
    chunks.map(
      (chunk) =>
        new Promise((done, fail) => {
          const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { jobs: chunk, seconds } });
          worker.on('message', (r) => {
            if (r) {
              results.push(r);
              appendFileSync(cachePath, `${JSON.stringify(r)}\n`);
              console.log(
                `  ${r.sector.padEnd(9)} #${String(r.slot).padStart(2)} ${r.size.padEnd(5)} moves ${String(r.moves.length).padStart(3)} pushes ${String(r.pushes).padStart(3)} switches ${String(r.switches).padStart(2)} explored ${String(r.explored).padStart(6)} uses [${r.used.join(',')}] fit ${r.fitness.toFixed(0)} (${r.evaluations} evals)`,
              );
            }
          });
          worker.on('error', fail);
          worker.on('exit', done);
        }),
    ),
  );

  const campaign = [];
  for (const sector of sectors) {
    const pool = results
      .filter((r) => r.sector === sector.id && r.signatureMet)
      .sort((a, b) => b.fitness - a.fitness);
    const unique = [];
    for (const r of pool) if (!unique.some((u) => u.rows.join('') === r.rows.join(''))) unique.push(r);
    // Keep an even ramp: while there are too many, drop whichever level is
    // closest in difficulty to the one below it (never the easiest or hardest).
    const chosen = unique.sort((a, b) => a.fitness - b.fitness);
    while (chosen.length > LEVELS_PER_SECTOR) {
      // A sector's opening level may be gentler, but never a walkover.
      if (chosen[0].pushes < MIN_OPENING_PUSHES) {
        chosen.shift();
        continue;
      }
      let drop = 1;
      for (let i = 2; i < chosen.length - 1; i++) {
        if (chosen[i].fitness - chosen[i - 1].fitness < chosen[drop].fitness - chosen[drop - 1].fitness) drop = i;
      }
      chosen.splice(drop, 1);
    }
    if (chosen.length < LEVELS_PER_SECTOR) console.log(`!! ${sector.id}: only ${chosen.length} usable levels`);
    campaign.push({
      id: sector.id,
      accent: sector.accent,
      levels: chosen.map((r) => ({
        rows: r.rows,
        par: parFor(r.moves.length),
        solution: r.moves,
        difficulty: Math.round(r.fitness),
      })),
    });
    console.log(`\n${sector.id}: moves ${chosen.map((r) => r.moves.length).join(', ')}`);
    if (args.show) for (const r of chosen) console.log(`\n  [${r.moves.length} moves, ${r.pushes} pushes]\n  ${r.rows.join('\n  ')}`);
  }

  if (args.write) {
    const existing = JSON.parse(readFileSync(dataPath, 'utf8'));
    const merged = existing.map((world) => campaign.find((c) => c.id === world.id) ?? world);
    writeFileSync(dataPath, `${JSON.stringify(merged, null, 2)}\n`);
    console.log(`\nwrote ${dataPath}`);
  }
}
