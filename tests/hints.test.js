import { describe, it, expect } from 'vitest';
import {
  hintAvailability,
  computeHint,
  awardForLevel,
  UNLOCK_AFTER_MOVES_OVER_PAR,
  UNLOCK_AFTER_SECONDS,
} from '../src/core/hints.js';
import { parseCompact } from '../src/core/level.js';
import { createState } from '../src/core/state.js';
import { step } from '../src/core/rules.js';

const build = (rows) => createState(parseCompact(rows));

describe('hint availability', () => {
  const base = { tokens: 3, par: 20, moves: 0, seconds: 0 };

  it('stays locked while the level has not put up a fight', () => {
    expect(hintAvailability(base).state).toBe('locked');
  });

  it('reports how much effort is still needed', () => {
    const result = hintAvailability({ ...base, moves: 22, seconds: 30 });
    expect(result.movesLeft).toBe(20 + UNLOCK_AFTER_MOVES_OVER_PAR - 22);
    expect(result.secondsLeft).toBe(UNLOCK_AFTER_SECONDS - 30);
  });

  it('unlocks once par is clearly exceeded', () => {
    const moves = base.par + UNLOCK_AFTER_MOVES_OVER_PAR;
    expect(hintAvailability({ ...base, moves }).state).toBe('ready');
  });

  it('unlocks on time spent even when under par', () => {
    expect(hintAvailability({ ...base, seconds: UNLOCK_AFTER_SECONDS }).state).toBe('ready');
  });

  it('reports when the player has no tokens', () => {
    const moves = base.par + UNLOCK_AFTER_MOVES_OVER_PAR;
    expect(hintAvailability({ ...base, tokens: 0, moves }).state).toBe('no_tokens');
  });
});

describe('computeHint', () => {
  const rows = ['########', '#.@$..*#', '#......#', '########'];

  it('suggests a move that is part of an optimal solution', () => {
    const hint = computeHint(build(rows));
    expect(hint.ok).toBe(true);
    expect(hint.direction).toBe('right');
    expect(hint.remaining).toBe(3);
  });

  it('stays correct after the player wanders off the route', () => {
    // Walk away from the container, then ask again.
    let state = build(rows);
    state = step(state, 'down').state;
    const hint = computeHint(state);
    expect(hint.ok).toBe(true);
    expect(hint.remaining).toBeGreaterThan(3);
  });

  it('reports when the position can no longer be solved', () => {
    // The only container is pushed into the pit, leaving the plate uncoverable.
    let state = build(['########', '#.@$o.*#', '#......#', '########']);
    state = step(state, 'right').state;
    expect(computeHint(state)).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('reports an already finished position', () => {
    let state = build(['#######', '#.@$*.#', '#.....#', '#######']);
    state = step(state, 'right').state;
    expect(computeHint(state)).toEqual({ ok: false, reason: 'already_solved' });
  });
});

describe('token awards', () => {
  it('rewards a first clear at three stars', () => {
    expect(awardForLevel({ stars: 3, firstCompletion: true })).toBe(1);
  });

  it('gives nothing for a weaker clear', () => {
    expect(awardForLevel({ stars: 2, firstCompletion: true })).toBe(0);
  });

  it('cannot be farmed by replaying a level', () => {
    expect(awardForLevel({ stars: 3, firstCompletion: false })).toBe(0);
  });
});
