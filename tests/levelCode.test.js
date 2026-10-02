import { describe, it, expect } from 'vitest';
import { encodeLevel, decodeLevel } from '../src/core/levelCode.js';
import { parseCompact } from '../src/core/level.js';
import { BUILTIN_WORLDS } from '../src/core/worlds.js';

describe('level codes', () => {
  it('round-trips a simple level exactly', () => {
    const level = parseCompact(['######', '#@$.*#', '#....#', '######'], { par: 5 });
    const { level: decoded } = decodeLevel(encodeLevel(level));
    expect(decoded.terrain).toEqual(level.terrain);
    expect(decoded.entities).toEqual(level.entities);
    expect(decoded.par).toBe(level.par);
  });

  it('round-trips every campaign level (all mechanics, all sectors)', () => {
    for (const world of BUILTIN_WORLDS) {
      for (const level of world.levels) {
        const { ok, level: decoded } = decodeLevel(encodeLevel(level));
        expect(ok, `${world.id}/${level.id}`).toBe(true);
        expect(decoded.terrain, level.id).toEqual(level.terrain);
        expect(decoded.entities, level.id).toEqual(level.entities);
        expect(decoded.par, level.id).toBe(level.par);
      }
    }
  });

  it('round-trips a container sitting on a non-floor tile', () => {
    // The compact `$`/`@` shorthand only covers floor and target; a crate
    // parked on ice, a switch, etc. (which the editor allows) needs the full
    // two-layer form to even express, so this exercises a combination the
    // shorthand notation itself can't reach.
    const level = {
      format: 1,
      id: 'x',
      name: '',
      par: 4,
      terrain: ['#######', '#.._.*#', '#.....#', '#######'],
      entities: ['.......', '..@$...', '.......', '.......'],
    };
    const { ok, level: decoded } = decodeLevel(encodeLevel(level));
    expect(ok).toBe(true);
    expect(decoded.terrain).toEqual(level.terrain);
    expect(decoded.entities).toEqual(level.entities);
  });

  it('produces exactly two characters per cell, plus a short header', () => {
    const level = parseCompact(['######', '#@$.*#', '#....#', '######'], { par: 5 });
    const code = encodeLevel(level);
    const [, , , , body] = code.split('.');
    expect(body.length).toBe(6 * 4 * 2);
  });

  it('rejects garbage input instead of throwing', () => {
    expect(decodeLevel('not a code')).toEqual({ ok: false, reason: 'invalid_code' });
    expect(decodeLevel('')).toEqual({ ok: false, reason: 'invalid_code' });
    expect(decodeLevel(null)).toEqual({ ok: false, reason: 'invalid_code' });
    expect(decodeLevel(undefined)).toEqual({ ok: false, reason: 'invalid_code' });
  });

  it('rejects a wrong-version code', () => {
    const level = parseCompact(['######', '#@$.*#', '#....#', '######'], { par: 5 });
    const code = encodeLevel(level).replace(/^K2/, 'K9');
    expect(decodeLevel(code)).toEqual({ ok: false, reason: 'invalid_code' });
  });

  it('still decodes a legacy K1 code (pre-expansion mechanic set)', () => {
    // K1 packed terrain×entity (combined = terrainIndex*3 + entityIndex) into
    // one character; rebuild that packing by hand to keep exercising the
    // legacy path even as the current (wider) constants grow past it.
    const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const level = parseCompact(['######', '#@$.*#', '#....#', '######'], { par: 5 });
    const TERRAIN_INDEX = { '#': 1, '.': 0, '*': 2 };
    const ENTITY_INDEX = { '.': 0, '@': 1, $: 2 };
    let body = '';
    for (let y = 0; y < level.terrain.length; y++) {
      for (let x = 0; x < level.terrain[y].length; x++) {
        const combined = TERRAIN_INDEX[level.terrain[y][x]] * 3 + ENTITY_INDEX[level.entities[y][x]];
        body += ALPHABET[combined];
      }
    }
    const code = ['K1', '6', '4', '5', body].join('.');
    const { ok, level: decoded } = decodeLevel(code);
    expect(ok).toBe(true);
    expect(decoded.terrain).toEqual(level.terrain);
    expect(decoded.entities).toEqual(level.entities);
  });

  it('rejects a body whose length does not match width×height', () => {
    const level = parseCompact(['######', '#@$.*#', '#....#', '######'], { par: 5 });
    const code = encodeLevel(level);
    expect(decodeLevel(`${code}XX`)).toEqual({ ok: false, reason: 'invalid_code' });
  });

  it('rejects a body containing a character outside the alphabet', () => {
    const level = parseCompact(['######', '#@$.*#', '#....#', '######'], { par: 5 });
    const parts = encodeLevel(level).split('.');
    parts[4] = `!${parts[4].slice(1)}`;
    expect(decodeLevel(parts.join('.')).ok).toBe(false);
  });

  it('rejects an out-of-range board size', () => {
    // width/height 2 is below MIN_SIZE
    expect(decodeLevel('K1.2.2.5.AAAA')).toEqual({ ok: false, reason: 'invalid_code' });
  });

  it('rejects a well-formed but illegal level (no drone)', () => {
    const level = parseCompact(['######', '#.$.*#', '#....#', '######'], { par: 5 });
    const { ok, reason } = decodeLevel(encodeLevel(level));
    expect(ok).toBe(false);
    expect(reason).toBe('no_player');
  });

  it('assigns a fresh id and blank name rather than reusing the source level', () => {
    const level = parseCompact(['######', '#@$.*#', '#....#', '######'], { par: 5, name: 'Secret' });
    const { level: decoded } = decodeLevel(encodeLevel(level));
    expect(decoded.id).not.toBe(level.id);
    expect(decoded.name).toBe('');
  });
});
