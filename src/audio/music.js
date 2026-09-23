import { audioContext, getMusicBus, noise, unlock } from './engine.js';

/**
 * Procedural music. Each track is a small pattern definition played by a
 * look-ahead scheduler, so the loops never need audio files and can run
 * indefinitely without a seam.
 */

const SCALE = [0, 3, 5, 7, 10]; // minor pentatonic, forgiving under any rhythm
const midi = (semitone) => 440 * 2 ** ((semitone - 69) / 12);

export const MUSIC_TRACKS = [
  {
    id: 'pulse',
    bpm: 112,
    root: 45,
    steps: 16,
    bass: [0, null, 0, null, 3, null, 0, null, 5, null, 3, null, 0, null, -2, null],
    lead: [12, null, 15, 17, null, 12, null, 19, null, 17, 15, null, 12, null, null, 10],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
    hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
  },
  {
    id: 'drift',
    bpm: 84,
    root: 41,
    steps: 16,
    bass: [0, null, null, null, 5, null, null, null, 3, null, null, null, 7, null, null, null],
    lead: [19, null, null, 17, null, null, 15, null, null, 12, null, null, 15, null, 17, null],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  },
  {
    id: 'forge',
    bpm: 138,
    root: 38,
    steps: 16,
    bass: [0, 0, null, 0, 3, null, 3, null, 5, 5, null, 5, 7, null, 10, null],
    lead: [null, 24, null, 22, null, 19, null, 22, null, 24, null, 27, null, 22, null, 19],
    kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  {
    id: 'vapor',
    bpm: 70,
    root: 44,
    steps: 16,
    bass: [0, null, null, null, null, null, 7, null, 5, null, null, null, null, null, 3, null],
    lead: [24, null, 22, null, 19, null, 17, null, 19, null, 22, null, 24, null, 27, null],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    hat: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  },
  {
    id: 'grind',
    bpm: 152,
    root: 33,
    steps: 16,
    bass: [0, 0, 0, null, 0, 0, null, 0, 3, 3, null, 3, 5, null, 7, 7],
    lead: [null, null, 19, null, null, 17, null, null, 15, null, null, 19, null, 22, null, null],
    kick: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0],
    hat: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1],
  },
  { id: 'silence', silent: true },
];

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.2;

let timer = null;
let activeTrack = null;
let nextNoteTime = 0;
let stepIndex = 0;

function voice({ freq, time, duration, type, gain, filter }) {
  const ctx = audioContext();
  const bus = getMusicBus();
  if (!ctx || !bus) return;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(gain, time + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  let node = osc;
  if (filter) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = filter;
    osc.connect(lp);
    node = lp;
  }
  node.connect(amp);
  amp.connect(bus);

  osc.start(time);
  osc.stop(time + duration + 0.05);
}

function percussion({ time, decay, frequency, gain, highpass }) {
  const ctx = audioContext();
  const bus = getMusicBus();
  if (!ctx || !bus) return;

  const source = noise();
  if (!source) return;
  const filter = ctx.createBiquadFilter();
  filter.type = highpass ? 'highpass' : 'lowpass';
  filter.frequency.value = frequency;

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, time);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + decay);

  source.connect(filter);
  filter.connect(amp);
  amp.connect(bus);
  source.start(time);
  source.stop(time + decay + 0.02);
}

function kickDrum(time) {
  const ctx = audioContext();
  const bus = getMusicBus();
  if (!ctx || !bus) return;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.5, time);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);

  osc.connect(amp);
  amp.connect(bus);
  osc.start(time);
  osc.stop(time + 0.26);
}

function scheduleStep(track, index, time) {
  const bass = track.bass[index];
  if (bass !== null && bass !== undefined) {
    voice({
      freq: midi(track.root + bass),
      time,
      duration: 0.28,
      type: 'sawtooth',
      gain: 0.16,
      filter: 520,
    });
  }

  const lead = track.lead[index];
  if (lead !== null && lead !== undefined) {
    voice({
      freq: midi(track.root + lead),
      time,
      duration: 0.22,
      type: 'square',
      gain: 0.055,
      filter: 2600,
    });
  }

  if (track.kick[index]) kickDrum(time);
  if (track.hat[index]) {
    percussion({ time, decay: 0.04, frequency: 7000, gain: 0.05, highpass: true });
  }
}

function tick() {
  const ctx = audioContext();
  if (!ctx || !activeTrack) return;

  const stepDuration = 60 / activeTrack.bpm / 4;
  while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(activeTrack, stepIndex % activeTrack.steps, nextNoteTime);
    stepIndex++;
    nextNoteTime += stepDuration;
  }
}

export function playTrack(id) {
  const track = MUSIC_TRACKS.find((t) => t.id === id) ?? MUSIC_TRACKS[0];
  if (activeTrack?.id === track.id) return;

  stopMusic();
  if (track.silent) {
    activeTrack = track;
    return;
  }

  const ctx = unlock();
  if (!ctx) return;

  activeTrack = track;
  stepIndex = 0;
  nextNoteTime = ctx.currentTime + 0.08;
  tick();
  timer = setInterval(tick, LOOKAHEAD_MS);
}

export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null;
  activeTrack = null;
}

export const currentTrackId = () => activeTrack?.id ?? null;
