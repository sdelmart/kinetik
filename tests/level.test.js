import { describe, it, expect } from 'vitest';
import {
  parseCompact,
  validateLevel,
  createEmptyLevel,
  levelFromGrids,
  gridsFromLevel,
} from '../src/core/level.js';

const check = (rows) => validateLevel(parseCompact(rows));

describe('level validation', () => {
  it('accepts a well-formed level', () => {
    expect(check(['######', '#@$.*#', '#....#', '######'])).toEqual({ ok: true });
  });

  it('rejects a level without a drone', () => {
    expect(check(['######', '#.$.*#', '#....#', '######']).code).toBe('no_player');
  });

  it('rejects a level with several drones', () => {
    expect(check(['#######', '#@$@.*#', '#.....#', '#######']).code).toBe('many_players');
  });

  it('rejects a level without a plate', () => {
    expect(check(['######', '#@$..#', '#....#', '######']).code).toBe('no_target');
  });

  it('rejects fewer containers than plates', () => {
    expect(check(['#######', '#@$.**#', '#.....#', '#######']).code).toBe('not_enough_crates');
  });

  it('rejects a lone teleporter', () => {
    expect(check(['#######', '#@$a.*#', '#.....#', '#######']).code).toBe('teleporter_unpaired');
  });

  it('rejects a gate with no switch', () => {
    expect(check(['#######', '#@$g.*#', '#.....#', '#######']).code).toBe('gate_without_switch');
  });

  it('rejects a switch with no gate', () => {
    expect(check(['#######', '#@$s.*#', '#.....#', '#######']).code).toBe('switch_without_gate');
  });

  it('rejects rows of differing width', () => {
    expect(check(['######', '#@$.*#', '#....#', '#####']).code).toBe('ragged_rows');
  });

  it('rejects an unknown glyph', () => {
    expect(check(['######', '#@$Z*#', '#....#', '######']).code).toBe('unknown_tile');
  });

  it('rejects a non-positive par', () => {
    const level = parseCompact(['######', '#@$.*#', '#....#', '######'], { par: 0 });
    expect(validateLevel(level).code).toBe('invalid_par');
  });

  it('rejects a board that is too small', () => {
    expect(check(['###', '#@#', '###']).code).toBe('too_small');
  });
});

describe('level shapes', () => {
  it('creates an empty level enclosed by walls', () => {
    const level = createEmptyLevel(8, 6);
    expect(level.terrain[0]).toBe('########');
    expect(level.terrain[1]).toBe('#......#');
    expect(level.entities[1]).toBe('........');
  });

  it('round-trips through the editor grid representation', () => {
    const level = parseCompact(['#######', '#@$_o*#', '#######'], { par: 5, name: 'x' });
    const { terrainGrid, entityGrid } = gridsFromLevel(level);
    const back = levelFromGrids(terrainGrid, entityGrid, { par: 5, name: 'x', id: level.id });
    expect(back.terrain).toEqual(level.terrain);
    expect(back.entities).toEqual(level.entities);
  });

  it('splits the compact notation into two layers', () => {
    const level = parseCompact(['#####', '#@&.#', '#####']);
    expect(level.terrain[1]).toBe('#.*.#');
    expect(level.entities[1]).toBe('.@$..');
  });
});
