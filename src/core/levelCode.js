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
import { validateLevel, randomId } from './level.js';

/**
 * Encodes a single level as a short, copy-paste-friendly text code — an
 * alternative to exporting a whole sector as a JSON file, for sharing one
 * level in a chat message or a forum post.
 *
 * Every cell is exactly one character: a terrain type (16 possible) and an
 * entity (3 possible: none/drone/container) combine into one index in
 * [0, 48), which indexes directly into a 64-symbol alphabet. That alphabet
 * (base64url, no padding) has no characters that need escaping in a URL or a
 * chat message, and the fixed 1-char-per-cell width makes the format trivial
 * to validate: reject anything whose body length isn't exactly width×height.
 */
const CODE_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const ENTITY_COUNT = Object.keys(E).length; // 3
const VERSION = 'K1';

export function encodeLevel(level) {
  const height = level.terrain.length;
  const width = level.terrain[0]?.length ?? 0;

  let body = '';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const terrainIndex = TERRAIN_GLYPHS[level.terrain[y][x]] ?? T.FLOOR;
      const entityIndex = ENTITY_GLYPHS[level.entities[y][x]] ?? E.NONE;
      body += CODE_ALPHABET[terrainIndex * ENTITY_COUNT + entityIndex];
    }
  }

  return [VERSION, width.toString(36), height.toString(36), level.par.toString(36), body].join('.');
}

/**
 * @returns {{ok: true, level: object} | {ok: false, reason: string}} `reason`
 * is either `'invalid_code'` (malformed input) or a `validateLevel` code
 * (well-formed but not a legal level — e.g. no drone).
 */
export function decodeLevel(code) {
  const parts = String(code ?? '').trim().split('.');
  if (parts.length !== 5 || parts[0] !== VERSION) return { ok: false, reason: 'invalid_code' };

  const [, widthStr, heightStr, parStr, body] = parts;
  const width = parseInt(widthStr, 36);
  const height = parseInt(heightStr, 36);
  const par = parseInt(parStr, 36);

  if (!Number.isInteger(width) || !Number.isInteger(height) || !Number.isInteger(par)) {
    return { ok: false, reason: 'invalid_code' };
  }
  if (width < MIN_SIZE || width > MAX_SIZE || height < MIN_SIZE || height > MAX_SIZE) {
    return { ok: false, reason: 'invalid_code' };
  }
  if (par <= 0 || body.length !== width * height) {
    return { ok: false, reason: 'invalid_code' };
  }

  const terrain = [];
  const entities = [];
  for (let y = 0; y < height; y++) {
    let terrainRow = '';
    let entityRow = '';
    for (let x = 0; x < width; x++) {
      const combined = CODE_ALPHABET.indexOf(body[y * width + x]);
      if (combined < 0) return { ok: false, reason: 'invalid_code' };

      const terrainGlyph = GLYPH_BY_TERRAIN[Math.floor(combined / ENTITY_COUNT)];
      const entityGlyph = GLYPH_BY_ENTITY[combined % ENTITY_COUNT];
      if (terrainGlyph === undefined || entityGlyph === undefined) {
        return { ok: false, reason: 'invalid_code' };
      }
      terrainRow += terrainGlyph;
      entityRow += entityGlyph;
    }
    terrain.push(terrainRow);
    entities.push(entityRow);
  }

  const level = { format: FORMAT_VERSION, id: randomId(), name: '', par, terrain, entities };
  const check = validateLevel(level);
  return check.ok ? { ok: true, level } : { ok: false, reason: check.code };
}
