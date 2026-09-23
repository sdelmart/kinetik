import { describe, it, expect } from 'vitest';
import { parseCompact } from '../src/core/level.js';
import { createState, isSolved, toIndex, gatesOpen } from '../src/core/state.js';
import { step } from '../src/core/rules.js';
import { T } from '../src/core/constants.js';

const build = (rows) => createState(parseCompact(rows));
const at = (state, x, y) => toIndex(state, x, y);
const run = (state, dirs) => {
  let s = state;
  for (const d of dirs) {
    const result = step(s, d);
    if (!result) return null;
    s = result.state;
  }
  return s;
};

describe('basic movement', () => {
  const rows = ['#######', '#.....#', '#.@$.*#', '#.....#', '#######'];

  it('moves the drone into free ground', () => {
    const s = run(build(rows), ['down']);
    expect(s.player).toBe(at(s, 2, 3));
    expect(s.moves).toBe(1);
  });

  it('refuses to walk into a wall', () => {
    expect(step(build(rows), 'up')).not.toBeNull();
    const top = run(build(rows), ['up']);
    expect(step(top, 'up')).toBeNull();
  });

  it('pushes a container and counts the push', () => {
    const s = run(build(rows), ['right']);
    expect(s.crates.has(at(s, 4, 2))).toBe(true);
    expect(s.pushes).toBe(1);
  });

  it('solves when every plate is covered', () => {
    const s = run(build(rows), ['right', 'right']);
    expect(isSolved(s)).toBe(true);
  });

  it('refuses to push two stacked containers', () => {
    const s = build(['#######', '#.@$$.#', '#######']);
    expect(step(s, 'right')).toBeNull();
  });

  it('refuses to push a container into a wall', () => {
    const s = build(['#####', '#.@$#', '#####']);
    expect(step(s, 'right')).toBeNull();
  });
});

describe('every direction behaves identically', () => {
  it('pushes the same way whichever way the drone faces', () => {
    const cases = [
      { rows: ['#####', '#...#', '#.$.#', '#.@.#', '#####'], dir: 'up', dx: 0, dy: -1 },
      { rows: ['#####', '#.@.#', '#.$.#', '#...#', '#####'], dir: 'down', dx: 0, dy: 1 },
      { rows: ['######', '#....#', '#.$@.#', '#....#', '######'], dir: 'left', dx: -1, dy: 0 },
      { rows: ['######', '#....#', '#.@$.#', '#....#', '######'], dir: 'right', dx: 1, dy: 0 },
    ];
    for (const { rows, dir, dx, dy } of cases) {
      const start = build(rows);
      const crate = [...start.crates][0];
      const result = step(start, dir);
      expect(result, `direction ${dir}`).not.toBeNull();
      const moved = [...result.state.crates][0];
      expect(moved - crate, `direction ${dir}`).toBe(dy * start.width + dx);
      expect(result.state.pushes).toBe(1);
    }
  });
});

describe('pits', () => {
  it('fills a pit with a container and makes it crossable', () => {
    const s = run(build(['#######', '#@$o*.#', '#######']), ['right']);
    expect(s.crates.size).toBe(0);
    expect(s.terrain[at(s, 3, 1)]).toBe(T.PIT_FILLED);
  });

  it('never lets the drone walk into an open pit', () => {
    expect(step(build(['#####', '#@o.#', '#####']), 'right')).toBeNull();
  });

  it('lets the drone cross a filled pit', () => {
    const s = run(build(['########', '#@$o..*#', '########']), ['right', 'right']);
    expect(s.player).toBe(at(s, 3, 1));
  });
});

describe('fragile plates', () => {
  const rows = ['######', '#@~..#', '#....#', '#..*#', '######'];

  it('collapses only once the plate is left empty', () => {
    const one = run(build(['#####', '#@~.#', '#####']), ['right']);
    expect(one.terrain[at(one, 2, 1)]).toBe(T.FRAGILE);

    const two = run(build(['#####', '#@~.#', '#####']), ['right', 'right']);
    expect(two.terrain[at(two, 2, 1)]).toBe(T.BROKEN);
  });

  it('lets the drone follow a container across a plate', () => {
    const s = run(build(['########', '#@$~..*#', '########']), ['right', 'right', 'right']);
    expect(s).not.toBeNull();
    expect(s.player).toBe(at(s, 4, 1));
    expect(s.terrain[at(s, 3, 1)]).toBe(T.BROKEN);
  });

  it('blocks the way back once a plate has collapsed', () => {
    const s = run(build(['#####', '#@~.#', '#####']), ['right', 'right']);
    expect(step(s, 'left')).toBeNull();
  });
});

describe('grease', () => {
  it('slides a container until it meets something solid', () => {
    const s = run(build(['#########', '#@$___.*#', '#########']), ['right']);
    expect(s.crates.has(at(s, 6, 1))).toBe(true);
  });

  it('stops a slide on the first non-slippery tile', () => {
    const s = run(build(['########', '#@$__*.#', '########']), ['right']);
    expect(s.crates.has(at(s, 5, 1))).toBe(true);
  });
});

describe('conveyors', () => {
  it('carries a container along the belt', () => {
    const s = run(build(['#########', '#@$>>>.*#', '#########']), ['right']);
    expect(s.crates.has(at(s, 6, 1))).toBe(true);
  });

  it('follows a bend in the belt', () => {
    const s = run(build(['######', '#@$>v#', '#...v#', '#...*#', '######']), ['right']);
    expect(s.crates.has(at(s, 4, 3))).toBe(true);
  });

  it('stops when the belt is blocked', () => {
    const s = run(build(['#######', '#@$>>##', '#######']), ['right']);
    expect(s.crates.has(at(s, 4, 1))).toBe(true);
  });
});

describe('teleporters', () => {
  it('moves a container from one pad to its pair', () => {
    const s = run(build(['##########', '#@$a...b*#', '##########']), ['right']);
    expect(s.crates.has(at(s, 7, 1))).toBe(true);
  });

  it('leaves the container in place when the exit is blocked', () => {
    // A container already sitting on the far pad, which needs the two-layer form.
    const blocked = createState({
      format: 1,
      id: 'tele-blocked',
      name: '',
      par: 5,
      terrain: ['########', '#..a.b*#', '########'],
      entities: ['........', '.@$..$..', '........'],
    });
    const s = run(blocked, ['right']);
    expect(s.crates.has(at(s, 3, 1))).toBe(true);
  });
});

describe('switches and gates', () => {
  const rows = ['########', '#@$.g.*#', '#..s...#', '########'];

  it('keeps the gate shut while no switch is held', () => {
    const s = build(rows);
    expect(gatesOpen(s)).toBe(false);
  });

  it('opens the gate while the drone stands on the switch', () => {
    const s = run(build(rows), ['down', 'right', 'right']);
    expect(gatesOpen(s)).toBe(true);
  });

  it('blocks movement through a closed gate', () => {
    const s = run(build(['######', '#@.g.#', '#....#', '######']), ['right', 'right']);
    expect(s).toBeNull();
  });
});

describe('move accounting', () => {
  it('counts walking but not blocked attempts', () => {
    const start = build(['#####', '#.@.#', '#####']);
    expect(step(start, 'up')).toBeNull();
    const s = run(start, ['right']);
    expect(s.moves).toBe(1);
    expect(s.pushes).toBe(0);
  });

  it('never mutates the state it was given', () => {
    const start = build(['######', '#@$..#', '######']);
    const before = [...start.crates];
    step(start, 'right');
    expect([...start.crates]).toEqual(before);
    expect(start.moves).toBe(0);
  });
});
