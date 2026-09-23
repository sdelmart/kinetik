import { audioContext, getSfxBus, noise } from './engine.js';

/** Short synthesised cues, one function per game event. */

function tone({ type = 'square', from, to, duration, gain = 0.12, delay = 0 }) {
  const ctx = audioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) return;

  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to !== undefined && to !== from) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
  }

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(amp);
  amp.connect(bus);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function burst({ duration = 0.12, frequency = 1800, gain = 0.15, highpass = false, delay = 0 }) {
  const ctx = audioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) return;

  const start = ctx.currentTime + delay;
  const source = noise();
  if (!source) return;

  const filter = ctx.createBiquadFilter();
  filter.type = highpass ? 'highpass' : 'lowpass';
  filter.frequency.value = frequency;

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter);
  filter.connect(amp);
  amp.connect(bus);
  source.start(start);
  source.stop(start + duration + 0.02);
}

export const sfx = {
  move: () => tone({ type: 'triangle', from: 320, to: 260, duration: 0.05, gain: 0.05 }),
  push: () => {
    tone({ type: 'sawtooth', from: 180, to: 120, duration: 0.11, gain: 0.1 });
    burst({ duration: 0.07, frequency: 900, gain: 0.07 });
  },
  blocked: () => tone({ type: 'square', from: 110, to: 90, duration: 0.08, gain: 0.06 }),
  fill: () => {
    tone({ type: 'sine', from: 240, to: 70, duration: 0.3, gain: 0.16 });
    burst({ duration: 0.22, frequency: 600, gain: 0.12 });
  },
  break: () => {
    burst({ duration: 0.28, frequency: 2600, gain: 0.18, highpass: true });
    tone({ type: 'sawtooth', from: 160, to: 55, duration: 0.24, gain: 0.08 });
  },
  slide: () => burst({ duration: 0.16, frequency: 3200, gain: 0.06, highpass: true }),
  teleport: () => {
    tone({ type: 'sine', from: 420, to: 1500, duration: 0.18, gain: 0.1 });
    tone({ type: 'sine', from: 900, to: 320, duration: 0.2, gain: 0.07, delay: 0.06 });
  },
  gate: () => tone({ type: 'square', from: 220, to: 480, duration: 0.14, gain: 0.08 }),
  click: () => tone({ type: 'square', from: 700, to: 700, duration: 0.03, gain: 0.05 }),
  error: () => tone({ type: 'sawtooth', from: 150, to: 90, duration: 0.2, gain: 0.1 }),
  undo: () => tone({ type: 'triangle', from: 300, to: 420, duration: 0.07, gain: 0.06 }),
  win: () => {
    [523, 659, 784, 1047].forEach((freq, i) =>
      tone({ type: 'square', from: freq, duration: 0.22, gain: 0.1, delay: i * 0.085 }),
    );
  },
  worldWin: () => {
    [392, 523, 659, 784, 1047, 1319].forEach((freq, i) =>
      tone({ type: 'square', from: freq, duration: 0.3, gain: 0.11, delay: i * 0.1 }),
    );
  },
};

/** Maps rules-engine events onto cues, so the caller stays declarative. */
export function playEvents(events) {
  const kinds = new Set(events.map((e) => e.type));
  if (kinds.has('break')) sfx.break();
  if (kinds.has('fill')) sfx.fill();
  if (kinds.has('teleport')) sfx.teleport();
  if (kinds.has('slide')) sfx.slide();
  if (kinds.has('push') && !kinds.has('fill')) sfx.push();
  if (!kinds.has('push') && kinds.has('move')) sfx.move();
}
