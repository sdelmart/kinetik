import { describe, it, expect } from 'vitest';
import { actionsFromGamepad } from '../src/ui/gamepad.js';

const button = (pressed) => ({ pressed });
const pad = (overrides = {}) => ({
  buttons: Array.from({ length: 17 }, () => button(false)),
  axes: [0, 0, 0, 0],
  ...overrides,
});

describe('actionsFromGamepad', () => {
  it('returns nothing for a disconnected pad', () => {
    expect(actionsFromGamepad(null)).toEqual(new Set());
  });

  it('returns nothing when idle', () => {
    expect(actionsFromGamepad(pad())).toEqual(new Set());
  });

  it('reads each D-pad button independently', () => {
    const cases = [
      [12, 'up'],
      [13, 'down'],
      [14, 'left'],
      [15, 'right'],
    ];
    for (const [index, action] of cases) {
      const buttons = Array.from({ length: 17 }, () => button(false));
      buttons[index] = button(true);
      expect(actionsFromGamepad(pad({ buttons })).has(action), action).toBe(true);
    }
  });

  it('reads the left stick past the deadzone', () => {
    expect(actionsFromGamepad(pad({ axes: [0, -0.9, 0, 0] })).has('up')).toBe(true);
    expect(actionsFromGamepad(pad({ axes: [0, 0.9, 0, 0] })).has('down')).toBe(true);
    expect(actionsFromGamepad(pad({ axes: [-0.9, 0, 0, 0] })).has('left')).toBe(true);
    expect(actionsFromGamepad(pad({ axes: [0.9, 0, 0, 0] })).has('right')).toBe(true);
  });

  it('ignores stick drift inside the deadzone', () => {
    expect(actionsFromGamepad(pad({ axes: [0.2, -0.2, 0, 0] }))).toEqual(new Set());
  });

  it('maps face and shoulder buttons to their actions', () => {
    const buttons = Array.from({ length: 17 }, () => button(false));
    buttons[1] = button(true); // B / Circle
    buttons[4] = button(true); // LB
    buttons[5] = button(true); // RB
    buttons[9] = button(true); // Start
    const actions = actionsFromGamepad(pad({ buttons }));
    expect(actions).toEqual(new Set(['restart', 'undo', 'redo', 'back']));
  });

  it('can report a diagonal as two simultaneous actions', () => {
    const actions = actionsFromGamepad(pad({ axes: [0.9, -0.9, 0, 0] }));
    expect(actions).toEqual(new Set(['up', 'right']));
  });

  it('tolerates a pad missing buttons or axes entirely', () => {
    expect(actionsFromGamepad({})).toEqual(new Set());
  });
});
