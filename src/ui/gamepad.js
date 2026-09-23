/**
 * Gamepad support via the standard Gamepad API. There are no button-press
 * events — the browser only updates a Gamepad snapshot that has to be polled
 * — so this does its own edge detection (act once per press, not once per
 * frame the button stays held) exactly like a keyboard 'keydown' would.
 *
 * Uses the "standard" gamepad mapping every modern controller reports:
 * D-pad = buttons 12-15, left stick = axes 0-1, face buttons/shoulders for
 * the rest. The left stick is treated as an alternative to the D-pad, not a
 * combination of both, so a controller missing one still works fully with
 * the other.
 */

const DEADZONE = 0.5;

/** Pure: which actions a single gamepad snapshot currently holds down. */
export function actionsFromGamepad(pad, deadzone = DEADZONE) {
  const pressed = new Set();
  if (!pad) return pressed;

  const buttons = pad.buttons ?? [];
  const axes = pad.axes ?? [];
  const isDown = (i) => Boolean(buttons[i]?.pressed);

  if (isDown(12)) pressed.add('up');
  if (isDown(13)) pressed.add('down');
  if (isDown(14)) pressed.add('left');
  if (isDown(15)) pressed.add('right');

  const x = axes[0] ?? 0;
  const y = axes[1] ?? 0;
  if (y < -deadzone) pressed.add('up');
  if (y > deadzone) pressed.add('down');
  if (x < -deadzone) pressed.add('left');
  if (x > deadzone) pressed.add('right');

  if (isDown(1)) pressed.add('restart'); // B / Circle
  if (isDown(4)) pressed.add('undo'); // Left bumper
  if (isDown(5)) pressed.add('redo'); // Right bumper
  if (isDown(9)) pressed.add('back'); // Start / Options

  return pressed;
}

function firstConnectedPad() {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) if (pad) return pad;
  return null;
}

/**
 * Polls once a frame and calls `handlers[action]()` on each press edge.
 * `handlers` only needs the actions it cares about (see game.js for the set).
 */
export class GamepadWatcher {
  constructor(handlers) {
    this.handlers = handlers;
    this.previous = new Set();
    this.running = false;
    this.frame = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.tick();
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  tick() {
    const pressed = actionsFromGamepad(firstConnectedPad());
    for (const action of pressed) {
      if (!this.previous.has(action)) this.handlers[action]?.();
    }
    this.previous = pressed;
  }
}
