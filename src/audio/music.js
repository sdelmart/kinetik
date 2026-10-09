import { audioContext, getMusicBus, noise, unlock } from './engine.js';

/**
 * Procedural music. Each track is a set of short patterns (bass, arpeggio,
 * lead phrases, drums) played over a chord progression and laid out by a
 * shared song arrangement — intro, groove, theme, breakdown, peak — so a
 * track builds and changes over a couple of minutes instead of repeating one
 * bar forever. Melody notes are snapped to the chord underneath them so a
 * phrase stays consonant across the whole progression, and everything goes
 * through a limiter so the stacked layers never clip. Still no audio files:
 * everything is synthesised.
 */

const midi = (semitone) => 440 * 2 ** ((semitone - 69) / 12);
const _ = null;

const minor = (root) => ({ root, third: 3 });
const major = (root) => ({ root, third: 4 });

/**
 * Which layers play in each section, and which pattern variant ('a' / 'b')
 * they use. A missing layer is silent. `once` sections only open the very
 * first pass; `fill` sections end on a snare roll into the next section.
 */
export const ARRANGEMENT = [
  { name: 'intro', bars: 4, once: true, layers: { pad: 'a', hat: 'a' } },
  { name: 'build', bars: 4, layers: { pad: 'a', arp: 'a', hat: 'a', kick: 'b' }, fill: true },
  { name: 'groove', bars: 8, layers: { bass: 'a', arp: 'a', kick: 'a', snare: 'a', hat: 'a' }, fill: true },
  { name: 'theme', bars: 8, layers: { bass: 'a', pad: 'a', lead: 'a', kick: 'a', snare: 'a', hat: 'a' }, fill: true },
  { name: 'breakdown', bars: 4, layers: { pad: 'a', arp: 'b', lead: 'b' } },
  { name: 'peak', bars: 8, layers: { bass: 'b', pad: 'a', arp: 'b', lead: 'b', kick: 'a', snare: 'a', hat: 'b' }, fill: true },
  { name: 'cooldown', bars: 4, layers: { bass: 'a', pad: 'a', kick: 'b', hat: 'a' } },
];

const REPEAT_SECTIONS = ARRANGEMENT.filter((s) => !s.once);
const barsIn = (sections) => sections.reduce((n, s) => n + s.bars, 0);
const FIRST_PASS_BARS = barsIn(ARRANGEMENT);
const REPEAT_PASS_BARS = barsIn(REPEAT_SECTIONS);

/** Where a given bar (counted from the start of the track) falls in the song. */
export function arrangementPosition(bar) {
  let pass = 0;
  let barInPass = bar;
  let sections = ARRANGEMENT;
  if (bar >= FIRST_PASS_BARS) {
    const k = bar - FIRST_PASS_BARS;
    pass = 1 + Math.floor(k / REPEAT_PASS_BARS);
    barInPass = k % REPEAT_PASS_BARS;
    sections = REPEAT_SECTIONS;
  }
  let start = 0;
  for (const section of sections) {
    if (barInPass < start + section.bars) {
      return { pass, barInPass, section, barInSection: barInPass - start };
    }
    start += section.bars;
  }
  return { pass, barInPass, section: sections[sections.length - 1], barInSection: 0 };
}

export const MUSIC_TRACKS = [
  { id: 'shuffle', shuffle: true },
  {
    id: 'pulse',
    bpm: 112,
    root: 45,
    progression: [minor(0), major(-4), major(3), major(-2)],
    timbre: { bass: 'sawtooth', bassFilter: 560, lead: 'square', leadFilter: 2400, arp: 'triangle', pad: 1100 },
    bass: {
      a: [0, _, 0, _, 12, _, 0, _, 0, _, 0, _, 12, _, 7, _],
      b: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 7, 7, 12, _],
    },
    arp: {
      a: [0, 2, 3, 2, 1, 2, 3, 2, 0, 2, 3, 4, 3, 2, 1, 2],
      b: [0, _, 3, _, 2, _, 4, _, 0, _, 3, _, 2, 4, 3, 2],
    },
    lead: {
      a: [24, _, _, 27, _, 29, _, 31, _, _, 29, _, 27, _, 24, _, 22, _, _, 24, _, 27, _, _, 29, _, 27, _, 24, _, _, _],
      b: [31, _, 34, _, 36, _, 34, 31, _, 29, _, 31, _, 27, _, _, 29, _, 31, _, 34, _, 31, _, 29, _, 27, _, 24, _, _, _],
    },
    kick: { a: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], b: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] },
    snare: { a: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] },
    hat: { a: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], b: [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1] },
  },
  {
    id: 'drift',
    bpm: 84,
    root: 41,
    progression: [minor(0), minor(5), major(-4), minor(7)],
    timbre: { bass: 'triangle', bassFilter: 420, lead: 'triangle', leadFilter: 1800, arp: 'sine', pad: 900 },
    bass: {
      a: [0, _, _, _, _, _, _, _, 7, _, _, _, _, _, _, _],
      b: [0, _, _, 0, _, _, 12, _, 7, _, _, 7, _, _, 5, _],
    },
    arp: {
      a: [0, _, 2, _, 3, _, 2, _, 1, _, 2, _, 3, _, 4, _],
      b: [0, 2, 3, 4, 3, 2, 1, 2, 0, 2, 3, 4, 3, 2, 4, 3],
    },
    lead: {
      a: [_, _, 24, _, _, _, 27, _, 29, _, _, _, 27, _, _, _, _, _, 31, _, 29, _, 27, _, 24, _, _, _, _, _, _, _],
      b: [36, _, _, 34, _, _, 31, _, _, _, 29, _, 31, _, _, _, 34, _, _, 31, _, _, 29, _, 27, _, _, _, 24, _, _, _],
    },
    kick: { a: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], b: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    snare: { a: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] },
    hat: { a: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], b: [1, 0, 1, 1, 1, 0, 2, 0, 1, 0, 1, 1, 1, 0, 2, 0] },
  },
  {
    id: 'forge',
    bpm: 138,
    root: 38,
    progression: [minor(0), minor(0), major(-4), major(-2)],
    timbre: { bass: 'sawtooth', bassFilter: 720, lead: 'sawtooth', leadFilter: 2200, arp: 'square', pad: 1300 },
    bass: {
      a: [0, 0, _, 0, 0, _, 0, _, 0, 0, _, 0, 12, _, 0, _],
      b: [0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 7, 12, 7, 12],
    },
    arp: {
      a: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3],
      b: [3, 2, 1, 0, 3, 2, 1, 0, 4, 3, 2, 1, 4, 3, 2, 1],
    },
    lead: {
      a: [24, _, 24, _, 27, _, 24, _, 29, _, _, 27, _, 24, _, _, 24, _, 24, _, 27, _, 29, _, 31, _, _, 29, _, 27, _, _],
      b: [36, _, _, 34, 36, _, 31, _, 34, _, _, 31, 29, _, 27, _, 29, _, 31, _, 34, _, 36, _, 39, _, 36, _, 34, _, 31, _],
    },
    kick: { a: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0], b: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] },
    snare: { a: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1] },
    hat: { a: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], b: [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 1] },
  },
  {
    id: 'vapor',
    bpm: 70,
    root: 44,
    progression: [minor(0), minor(5), major(-2), major(3)],
    timbre: { bass: 'triangle', bassFilter: 380, lead: 'triangle', leadFilter: 1500, arp: 'sine', pad: 800 },
    bass: {
      a: [0, _, _, _, _, _, _, _, _, _, _, _, _, _, 7, _],
      b: [0, _, _, _, _, _, 12, _, _, _, 7, _, _, _, _, _],
    },
    arp: {
      a: [0, _, _, 2, _, _, 3, _, _, 4, _, _, 3, _, _, _],
      b: [0, _, 2, _, 3, _, 4, _, 3, _, 2, _, 1, _, 2, _],
    },
    lead: {
      a: [36, _, _, _, 34, _, _, _, 31, _, _, _, 29, _, 31, _, 34, _, _, _, _, _, _, _, 27, _, 29, _, 31, _, _, _],
      b: [31, _, 34, _, 36, _, _, _, 39, _, 36, _, 34, _, _, _, 31, _, _, 29, _, _, 27, _, 29, _, _, _, _, _, _, _],
    },
    kick: { a: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], b: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0] },
    snare: { a: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] },
    hat: { a: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0], b: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2, 0] },
  },
  {
    id: 'grind',
    bpm: 152,
    root: 33,
    progression: [minor(0), major(1), minor(0), major(-2)],
    timbre: { bass: 'square', bassFilter: 620, lead: 'sawtooth', leadFilter: 2600, arp: 'square', pad: 1200 },
    bass: {
      a: [0, 0, 0, _, 0, 0, _, 0, 0, 0, 0, _, 12, _, 0, 0],
      b: [0, 12, 0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 7, 7],
    },
    arp: {
      a: [0, _, 1, _, 2, _, 1, _, 0, _, 1, _, 2, _, 3, _],
      b: [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 4, 3, 2, 1],
    },
    lead: {
      a: [_, _, 24, _, _, 25, _, _, 24, _, _, _, 22, _, _, _, _, _, 24, _, _, 27, _, _, 25, _, 24, _, 22, _, _, _],
      b: [36, _, 37, _, 36, _, 34, _, 32, _, 34, _, 36, _, _, _, 39, _, 37, _, 36, _, 34, _, 37, _, 36, _, 34, _, 32, _],
    },
    kick: { a: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0], b: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
    snare: { a: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] },
    hat: { a: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1], b: [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 2, 1] },
  },
  { id: 'silence', silent: true },
];

const PLAYABLE = MUSIC_TRACKS.filter((t) => !t.silent && !t.shuffle);

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.2;
const STEPS_PER_BAR = 16;

let timer = null;
let requestedId = null;
let activeTrack = null;
let nextNoteTime = 0;
let bar = 0;
let step = 0;

// --- effects: one echo and one reverb send, shared by every voice ---------

let fx = null;

function impulse(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return buffer;
}

function effects() {
  const ctx = audioContext();
  const bus = getMusicBus();
  if (!ctx || !bus) return null;
  if (fx?.ctx === ctx) return fx;

  const out = ctx.createDynamicsCompressor();
  out.threshold.value = -14;
  out.knee.value = 8;
  out.ratio.value = 8;
  out.attack.value = 0.004;
  out.release.value = 0.2;
  const trim = ctx.createGain();
  trim.gain.value = 0.8;
  out.connect(trim);
  trim.connect(bus);

  const delay = ctx.createDelay(2);
  const feedback = ctx.createGain();
  feedback.gain.value = 0.22;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2800;
  const delayOut = ctx.createGain();
  delayOut.gain.value = 0.22;
  delay.connect(tone);
  tone.connect(feedback);
  feedback.connect(delay);
  tone.connect(delayOut);
  delayOut.connect(out);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 1.8);
  const reverbOut = ctx.createGain();
  reverbOut.gain.value = 0.16;
  reverb.connect(reverbOut);
  reverbOut.connect(bus);

  fx = { ctx, delay, reverb, out };
  return fx;
}

/** Everything goes through one limiter so stacked layers can't clip into distortion. */
function output() {
  return effects()?.out ?? null;
}

function send(node, target, amount) {
  if (!target || !amount) return;
  const gain = node.context.createGain();
  gain.gain.value = amount;
  node.connect(gain);
  gain.connect(target);
}

// --- instruments -----------------------------------------------------------

function voice({ freq, time, duration, type, gain, filter, attack = 0.012, detune = 0, echo = 0, space = 0 }) {
  const ctx = audioContext();
  const bus = output();
  if (!ctx || !bus) return;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(gain, time + attack);
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

  const sends = effects();
  send(amp, sends?.delay, echo);
  send(amp, sends?.reverb, space);

  osc.start(time);
  osc.stop(time + duration + 0.05);
}

function noiseHit({ time, decay, frequency, gain, type = 'highpass', space = 0 }) {
  const ctx = audioContext();
  const bus = output();
  if (!ctx || !bus) return;

  const source = noise();
  if (!source) return;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, time);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + decay);

  source.connect(filter);
  filter.connect(amp);
  amp.connect(bus);
  send(amp, effects()?.reverb, space);
  source.start(time);
  source.stop(time + decay + 0.02);
}

function kickDrum(time, gain = 0.5) {
  const ctx = audioContext();
  const bus = output();
  if (!ctx || !bus) return;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, time);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);

  osc.connect(amp);
  amp.connect(bus);
  osc.start(time);
  osc.stop(time + 0.26);
}

function snareDrum(time, gain = 0.09) {
  noiseHit({ time, decay: 0.12, frequency: 2200, gain, type: 'bandpass', space: 0.15 });
  voice({ freq: 185, time, duration: 0.07, type: 'triangle', gain: gain * 0.8 });
}

function crash(time) {
  noiseHit({ time, decay: 0.9, frequency: 6500, gain: 0.025, space: 0.2 });
}

function padChord(chord, root, time, duration, brightness) {
  for (const interval of [0, chord.third, 7]) {
    const freq = midi(root + chord.root + interval + 12);
    for (const detune of [-5, 5]) {
      voice({ freq, time, duration, type: 'triangle', gain: 0.022, filter: brightness, attack: 0.5, detune, space: 0.3 });
    }
  }
}

/**
 * Moves a melody note onto the nearest tone of the chord underneath it, so
 * a phrase written once stays consonant over every chord of the progression.
 */
export function snapToChord(note, chord) {
  const tones = [0, chord.third, 7].map((i) => (((chord.root + i) % 12) + 12) % 12);
  for (let offset = 0; offset <= 6; offset++) {
    for (const candidate of [note - offset, note + offset]) {
      if (tones.includes(((candidate % 12) + 12) % 12)) return candidate;
    }
  }
  return note;
}

// --- sequencing ------------------------------------------------------------

const pick = (patterns, variant) => (variant ? (patterns?.[variant] ?? patterns?.a ?? null) : null);
const at = (pattern, index) => (pattern ? pattern[index % pattern.length] : null);

function scheduleStep(track, time) {
  const { barInPass, section, barInSection } = arrangementPosition(bar);
  const layers = section.layers;
  const root = track.root;
  const chord = track.progression[barInPass % track.progression.length];
  const stepSeconds = 60 / track.bpm / 4;
  const sectionStep = barInSection * STEPS_PER_BAR + step;
  const t = track.timbre;

  if (barInSection === 0 && step === 0 && bar > 0 && layers.kick) crash(time);

  if (layers.pad && step === 0) {
    padChord(chord, root, time, stepSeconds * STEPS_PER_BAR * 1.05, t.pad);
  }

  const bassNote = at(pick(track.bass, layers.bass), step);
  if (bassNote !== null) {
    voice({
      freq: midi(root + chord.root + bassNote),
      time,
      duration: stepSeconds * 1.8,
      type: t.bass,
      gain: 0.15,
      filter: t.bassFilter,
    });
  }

  const arpIndex = at(pick(track.arp, layers.arp), step);
  if (arpIndex !== null) {
    const tones = [0, chord.third, 7, 12, chord.third + 12];
    voice({
      freq: midi(root + chord.root + 24 + tones[arpIndex % tones.length]),
      time,
      duration: stepSeconds * 1.2,
      type: t.arp,
      gain: 0.028,
      filter: 2600,
      echo: 0.2,
    });
  }

  const leadNote = at(pick(track.lead, layers.lead), sectionStep);
  if (leadNote !== null) {
    voice({
      freq: midi(root + snapToChord(leadNote, chord)),
      time,
      duration: stepSeconds * 2.2,
      type: t.lead,
      gain: 0.045,
      filter: t.leadFilter,
      echo: 0.25,
      space: 0.2,
    });
  }

  // Last beat of a `fill` section: snare roll into the next one, kick drops out.
  if (section.fill && barInSection === section.bars - 1 && step >= 12) {
    snareDrum(time, 0.06 + (step - 12) * 0.03);
    if (step === 12) kickDrum(time);
    return;
  }

  if (at(pick(track.kick, layers.kick), step)) kickDrum(time);
  if (at(pick(track.snare, layers.snare), step)) snareDrum(time);

  const hat = at(pick(track.hat, layers.hat), step) ?? 0;
  const ghost = layers.hat === 'b' && !hat && Math.random() < 0.15;
  if (hat || ghost) {
    noiseHit({
      time,
      decay: hat === 2 ? 0.18 : 0.035,
      frequency: 8000,
      gain: ghost ? 0.012 : 0.028 + Math.random() * 0.01,
    });
  }
}

function startTrack(track, ctx, time, skipIntro = false) {
  activeTrack = track;
  bar = skipIntro ? FIRST_PASS_BARS : 0;
  step = 0;
  nextNoteTime = time;
  effects()?.delay.delayTime.setValueAtTime((60 / track.bpm) * 0.75, time);
}

function randomOther(current) {
  const choices = PLAYABLE.filter((t) => t !== current);
  return choices[Math.floor(Math.random() * choices.length)];
}

function tick() {
  const ctx = audioContext();
  if (!ctx || !activeTrack) return;

  while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(activeTrack, nextNoteTime);
    nextNoteTime += 60 / activeTrack.bpm / 4;
    step++;
    if (step === STEPS_PER_BAR) {
      step = 0;
      bar++;
      // Shuffle: hand over to another track each time one finishes a full pass.
      if (requestedId === 'shuffle' && arrangementPosition(bar).barInPass === 0) {
        startTrack(randomOther(activeTrack), ctx, nextNoteTime, true);
      }
    }
  }
}

export function playTrack(id) {
  const track = MUSIC_TRACKS.find((t) => t.id === id) ?? MUSIC_TRACKS[0];
  if (requestedId === track.id && (timer || track.silent)) return;

  stopMusic();
  requestedId = track.id;
  if (track.silent) return;

  const ctx = unlock();
  if (!ctx) {
    requestedId = null;
    return;
  }

  startTrack(track.shuffle ? randomOther(null) : track, ctx, ctx.currentTime + 0.08);
  tick();
  timer = setInterval(tick, LOOKAHEAD_MS);
}

export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null;
  activeTrack = null;
  requestedId = null;
}

export const currentTrackId = () => requestedId;
