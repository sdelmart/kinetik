import { describe, it, expect } from 'vitest';
import { ARRANGEMENT, MUSIC_TRACKS, arrangementPosition, snapToChord } from '../src/audio/music.js';

const firstPassBars = ARRANGEMENT.reduce((n, s) => n + s.bars, 0);
const repeatBars = ARRANGEMENT.filter((s) => !s.once).reduce((n, s) => n + s.bars, 0);

describe('arrangementPosition', () => {
  it('opens the first pass with the intro', () => {
    const pos = arrangementPosition(0);
    expect(pos.section.name).toBe('intro');
    expect(pos.pass).toBe(0);
  });

  it('walks through every section in order on the first pass', () => {
    const names = [];
    for (let bar = 0; bar < firstPassBars; bar++) {
      const { section } = arrangementPosition(bar);
      if (names[names.length - 1] !== section.name) names.push(section.name);
    }
    expect(names).toEqual(ARRANGEMENT.map((s) => s.name));
  });

  it('skips the intro on later passes and counts them', () => {
    const second = arrangementPosition(firstPassBars);
    expect(second.pass).toBe(1);
    expect(second.barInPass).toBe(0);
    expect(second.section.name).not.toBe('intro');

    const third = arrangementPosition(firstPassBars + repeatBars);
    expect(third.pass).toBe(2);
    expect(third.barInPass).toBe(0);
  });
});

describe('track definitions', () => {
  const playable = MUSIC_TRACKS.filter((t) => !t.silent && !t.shuffle);

  it('offers shuffle and silence alongside the real tracks', () => {
    expect(MUSIC_TRACKS.some((t) => t.shuffle)).toBe(true);
    expect(MUSIC_TRACKS.some((t) => t.silent)).toBe(true);
    expect(playable.length).toBeGreaterThanOrEqual(5);
  });

  it('gives every layer used by the arrangement a pattern on every track', () => {
    const layers = new Set(ARRANGEMENT.flatMap((s) => Object.keys(s.layers)));
    layers.delete('pad');
    for (const track of playable) {
      for (const layer of layers) {
        expect(track[layer]?.a, `${track.id}.${layer}.a`).toBeTruthy();
      }
      expect(track.progression.length, `${track.id} progression`).toBeGreaterThan(0);
    }
  });

  it('keeps bar-length patterns at 16 steps and lead phrases a whole number of bars', () => {
    for (const track of playable) {
      for (const layer of ['bass', 'arp', 'kick', 'snare', 'hat']) {
        for (const pattern of Object.values(track[layer])) expect(pattern, `${track.id}.${layer}`).toHaveLength(16);
      }
      for (const phrase of Object.values(track.lead)) expect(phrase.length % 16, `${track.id}.lead`).toBe(0);
    }
  });
});

describe('snapToChord', () => {
  const pc = (n) => ((n % 12) + 12) % 12;

  it('leaves chord tones untouched', () => {
    const aMinor = { root: 0, third: 3 };
    for (const note of [24, 27, 31, 36]) expect(snapToChord(note, aMinor)).toBe(note);
  });

  it('moves a clashing note to the nearest chord tone', () => {
    const fMajorUnderA = { root: -4, third: 4 }; // F A C relative to A
    expect(snapToChord(31, fMajorUnderA)).toBe(32); // E over F major -> F
    expect(snapToChord(29, fMajorUnderA)).toBe(27); // D -> C
  });

  it('only ever lands on a tone of the chord, for every track and chord', () => {
    for (const track of MUSIC_TRACKS.filter((t) => t.progression)) {
      for (const chord of track.progression) {
        const tones = [0, chord.third, 7].map((i) => pc(chord.root + i));
        for (const phrase of Object.values(track.lead)) {
          for (const note of phrase) {
            if (note === null) continue;
            const snapped = snapToChord(note, chord);
            expect(tones, `${track.id} ${note}`).toContain(pc(snapped));
            expect(Math.abs(snapped - note)).toBeLessThanOrEqual(2);
          }
        }
      }
    }
  });
});
