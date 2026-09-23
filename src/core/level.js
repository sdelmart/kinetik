import {
  FORMAT_VERSION,
  T,
  E,
  TERRAIN_GLYPHS,
  ENTITY_GLYPHS,
  GLYPH_BY_TERRAIN,
  GLYPH_BY_ENTITY,
  MIN_SIZE,
  MAX_SIZE,
} from './constants.js';

/**
 * A level is stored as two aligned layers of single-character rows:
 * `terrain` (the board) and `entities` (what stands on it).
 */

export function createEmptyLevel(width = 12, height = 9, name = '') {
  const terrain = [];
  const entities = [];
  for (let y = 0; y < height; y++) {
    const edge = y === 0 || y === height - 1;
    terrain.push(
      Array.from({ length: width }, (_, x) =>
        edge || x === 0 || x === width - 1 ? '#' : '.',
      ).join(''),
    );
    entities.push('.'.repeat(width));
  }
  return { format: FORMAT_VERSION, id: randomId(), name, par: 20, terrain, entities };
}

export function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Authoring shorthand: one grid where `@ $ + &` carry both the entity and its
 * floor/target terrain. Built-in levels are written this way; the editor emits
 * the canonical two-layer form directly.
 */
export function parseCompact(rows, meta = {}) {
  const terrain = [];
  const entities = [];
  for (const row of rows) {
    let t = '';
    let e = '';
    for (const ch of row) {
      switch (ch) {
        case '@':
          t += '.';
          e += '@';
          break;
        case '$':
          t += '.';
          e += '$';
          break;
        case '+':
          t += '*';
          e += '@';
          break;
        case '&':
          t += '*';
          e += '$';
          break;
        case ' ':
          t += '.';
          e += '.';
          break;
        default:
          t += ch;
          e += '.';
      }
    }
    terrain.push(t);
    entities.push(e);
  }
  return {
    format: FORMAT_VERSION,
    id: meta.id ?? randomId(),
    name: meta.name ?? '',
    par: meta.par ?? 20,
    terrain,
    entities,
  };
}

export function levelSize(level) {
  return { width: level.terrain[0]?.length ?? 0, height: level.terrain.length };
}

function countGlyph(rows, glyph) {
  let n = 0;
  for (const row of rows) for (const ch of row) if (ch === glyph) n++;
  return n;
}

/**
 * @returns {{ok: true} | {ok: false, code: string}} `code` is an i18n key.
 */
export function validateLevel(level) {
  if (!level || typeof level !== 'object') return fail('invalid_shape');
  if (level.format !== FORMAT_VERSION) return fail('invalid_format');
  if (!Array.isArray(level.terrain) || !Array.isArray(level.entities)) return fail('invalid_shape');
  if (level.terrain.length !== level.entities.length) return fail('layer_mismatch');

  const { width, height } = levelSize(level);
  if (height < MIN_SIZE || width < MIN_SIZE) return fail('too_small');
  if (height > MAX_SIZE || width > MAX_SIZE) return fail('too_large');

  for (let y = 0; y < height; y++) {
    if (level.terrain[y].length !== width || level.entities[y].length !== width) {
      return fail('ragged_rows');
    }
    for (let x = 0; x < width; x++) {
      const tg = level.terrain[y][x];
      const eg = level.entities[y][x];
      if (!(tg in TERRAIN_GLYPHS)) return fail('unknown_tile');
      if (!(eg in ENTITY_GLYPHS)) return fail('unknown_tile');
      if (ENTITY_GLYPHS[eg] !== E.NONE && TERRAIN_GLYPHS[tg] === T.WALL) return fail('entity_in_wall');
    }
  }

  const players = countGlyph(level.entities, '@');
  if (players !== 1) return fail(players === 0 ? 'no_player' : 'many_players');

  const crates = countGlyph(level.entities, '$');
  const targets = countGlyph(level.terrain, '*');
  if (targets === 0) return fail('no_target');
  if (crates < targets) return fail('not_enough_crates');

  const teleA = countGlyph(level.terrain, 'a');
  const teleB = countGlyph(level.terrain, 'b');
  if (teleA > 1 || teleB > 1) return fail('teleporter_duplicate');
  if (teleA !== teleB) return fail('teleporter_unpaired');

  const gates = countGlyph(level.terrain, 'g');
  const switches = countGlyph(level.terrain, 's');
  if (gates > 0 && switches === 0) return fail('gate_without_switch');
  if (switches > 0 && gates === 0) return fail('switch_without_gate');

  if (!Number.isFinite(level.par) || level.par <= 0) return fail('invalid_par');

  return { ok: true };
}

function fail(code) {
  return { ok: false, code };
}

export function cloneLevel(level) {
  return {
    format: level.format,
    id: level.id,
    name: level.name,
    par: level.par,
    terrain: [...level.terrain],
    entities: [...level.entities],
  };
}

/** Builds a level from mutable grids (used by the editor). */
export function levelFromGrids(terrainGrid, entityGrid, meta = {}) {
  return {
    format: FORMAT_VERSION,
    id: meta.id ?? randomId(),
    name: meta.name ?? '',
    par: meta.par ?? 20,
    terrain: terrainGrid.map((row) => row.map((c) => GLYPH_BY_TERRAIN[c]).join('')),
    entities: entityGrid.map((row) => row.map((c) => GLYPH_BY_ENTITY[c]).join('')),
  };
}

export function gridsFromLevel(level) {
  return {
    terrainGrid: level.terrain.map((row) => [...row].map((ch) => TERRAIN_GLYPHS[ch])),
    entityGrid: level.entities.map((row) => [...row].map((ch) => ENTITY_GLYPHS[ch])),
  };
}
