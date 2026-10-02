import { describe, it, expect } from 'vitest';
import { parseCompact, validateLevel } from '../src/core/level.js';
import { createState, canPlayerEnter } from '../src/core/state.js';
import { T } from '../src/core/constants.js';
import { step } from '../src/core/rules.js';

describe('one-way doors', () => {
  it('is a legal level', () => {
    const level = parseCompact(['######', '#@.R&#', '#....#', '######'], { par: 3 });
    expect(validateLevel(level)).toEqual({ ok: true });
  });

  it('lets the drone enter while moving along the arrow', () => {
    // @ at x2, one-way-right tile at x3.
    const level = parseCompact(['######', '#@R.*#', '#....#', '######'], { par: 2 });
    const state = createState(level);
    const result = step(state, 'right');
    expect(result).not.toBeNull();
    expect(result.state.player).toBe(state.player + 1);
  });

  it('blocks entry when moving against the arrow', () => {
    // one-way-right tile at x2, drone approaching from the right at x3.
    const level = parseCompact(['######', '#.R@.#', '#....#', '######'], { par: 2 });
    const state = createState(level);
    const result = step(state, 'left');
    expect(result).toBeNull();
  });
});

describe('keys and locked gates', () => {
  // @ drone, $ crate (the key), k keyhole, q key-gate, * target beyond the gate.
  const level = parseCompact(['########', '#.@$k.q*', '#......#', '########'], { par: 4 });

  it('is a well-formed level', () => {
    expect(validateLevel(level)).toEqual({ ok: true });
  });

  it('blocks the key-gate before the keyhole is seated', () => {
    const state = createState(level);
    const gateIndex = state.player + 4; // x=6, four cells right of the drone
    expect(state.terrain[gateIndex]).toBe(T.GATE_KEY);
    expect(canPlayerEnter(state, gateIndex)).toBe(false);
  });

  it('seats the keyhole and opens the key-gate once the crate is pushed onto it', () => {
    const state = createState(level);
    const gateIndex = state.player + 4;
    const afterPush = step(state, 'right').state;
    const keyholeIndex = afterPush.player + 1; // crate now one cell ahead, on the keyhole
    expect(afterPush.terrain[keyholeIndex]).toBe(T.KEYHOLE_USED);
    expect(canPlayerEnter(afterPush, gateIndex)).toBe(true);
  });

  it('locks the crate in place once it has seated the keyhole', () => {
    const state = createState(level);
    const afterPush = step(state, 'right').state; // crate now on keyhole
    const again = step(afterPush, 'right'); // try to push it further right
    expect(again).toBeNull();
  });
});

describe('linked twin crates', () => {
  // '1'/'2' are twin crates A/B; pushing one mirrors the other (opposite direction).
  const level = parseCompact(['##########', '#.1@2..*.#', '#........#', '##########'], { par: 4 });

  it('is a well-formed level', () => {
    expect(validateLevel(level)).toEqual({ ok: true });
  });

  it('moves the twin in the mirrored direction when its partner is pushed', () => {
    const state = createState(level);
    const twinAIndex = state.player - 1; // crate '1'
    const twinBIndex = state.player + 1; // crate '2'
    expect(state.twins.get(twinAIndex)).toBe(twinBIndex);

    const result = step(state, 'right'); // drone pushes crate '2' right
    expect(result).not.toBeNull();
    const { state: next } = result;
    // '2' moved one cell right; its mirrored twin '1' moved one cell left.
    expect(next.crates.has(twinBIndex + 1)).toBe(true);
    expect(next.crates.has(twinAIndex - 1)).toBe(true);
    expect(next.twins.get(twinAIndex - 1)).toBe(twinBIndex + 1);
  });

  it('refuses the push if the mirrored destination is blocked', () => {
    // Pushing crate '2' right (open ahead) would mirror crate '1' one cell left —
    // straight into the boundary wall — so the whole move must be rejected.
    const tight = parseCompact(['##########', '#1.@2...##', '#........#', '##########'], { par: 4 });
    const state = createState(tight);
    const result = step(state, 'right');
    expect(result).toBeNull();
  });
});
