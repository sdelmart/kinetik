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
 * v2 (current): each cell is two characters, one indexing the terrain type
 * and one indexing the entity, each into a 64-symbol alphabet (base64url, no
 * padding — nothing that needs escaping in a URL or a chat message). Two
 * independent alphabets avoid ever outgrowing 64 values as new tile or
 * entity kinds are added, unlike packing both into a single combined index.
 *
 * v1 codes (prefix `K1`) packed terrain×entity into one combined index and
 * are still decoded for levels shared before the mechanic set grew past what
 * that packing could hold.
 */
const CODE_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LEGACY_ENTITY_COUNT = 3; // frozen: none/drone/container, as encoded by K1
const VERSION = 'K2';

export function encodeLevel(level) {
  const height = level.terrain.length;
  const width = level.terrain[0]?.length ?? 0;

  let body = '';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const terrainIndex = TERRAIN_GLYPHS[level.terrain[y][x]] ?? T.FLOOR;
      const entityIndex = ENTITY_GLYPHS[level.entities[y][x]] ?? E.NONE;
      body += CODE_ALPHABET[terrainIndex] + CODE_ALPHABET[entityIndex];
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
  if (parts.length !== 5 || (parts[0] !== VERSION && parts[0] !== 'K1')) {
    return { ok: false, reason: 'invalid_code' };
  }
  const legacy = parts[0] === 'K1';

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
  const expectedLength = legacy ? width * height : width * height * 2;
  if (par <= 0 || body.length !== expectedLength) {
    return { ok: false, reason: 'invalid_code' };
  }

  const terrain = [];
  const entities = [];
  for (let y = 0; y < height; y++) {
    let terrainRow = '';
    let entityRow = '';
    for (let x = 0; x < width; x++) {
      let terrainGlyph;
      let entityGlyph;
      if (legacy) {
        const combined = CODE_ALPHABET.indexOf(body[y * width + x]);
        if (combined < 0) return { ok: false, reason: 'invalid_code' };
        terrainGlyph = GLYPH_BY_TERRAIN[Math.floor(combined / LEGACY_ENTITY_COUNT)];
        entityGlyph = GLYPH_BY_ENTITY[combined % LEGACY_ENTITY_COUNT];
      } else {
        const cell = (y * width + x) * 2;
        const terrainIndex = CODE_ALPHABET.indexOf(body[cell]);
        const entityIndex = CODE_ALPHABET.indexOf(body[cell + 1]);
        if (terrainIndex < 0 || entityIndex < 0) return { ok: false, reason: 'invalid_code' };
        terrainGlyph = GLYPH_BY_TERRAIN[terrainIndex];
        entityGlyph = GLYPH_BY_ENTITY[entityIndex];
      }
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
