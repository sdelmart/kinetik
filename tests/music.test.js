import { describe, it, expect } from 'vitest';
import { ARRANGEMENT, MUSIC_TRACKS, arrangementPosition } from '../src/audio/music.js';

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
