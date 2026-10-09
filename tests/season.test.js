import { describe, it, expect } from 'vitest';
import { applySeasonReset } from '../src/state/seasonReset.js';
import { SEASON } from '../src/state/season.js';
import { read, write } from '../src/state/storage.js';
import { STARTING_TOKENS } from '../src/core/hints.js';
import { loadSave } from '../src/state/save.js';
import { parsePlayers } from '../server/players.js';

const keyFor = (profile) => (name) => `p:${profile}:${name}`;

describe('season reset', () => {
  it('wipes results earned before this season, once', () => {
    const k = keyFor('old');
    write(k('save'), { records: { assembly: { 'assembly-1': { completed: true, bestScore: 900 } } }, totals: { score: 900, moves: 40 } });
    write(k('hints'), 47);
    write(k('achievements'), ['first_clear', 'builder']);
    write(k('labyrinth'), { chapters: { crypt: { completed: true } }, endless: { bestDepth: 6 } });
    write(k('scoresPushed'), { 'assembly/assembly-1': 900 });
    write(k('worlds'), [{ id: 'mine', name: 'Mon secteur', levels: [] }]);
    write(k('settings'), { musicVolume: 12 });

    expect(applySeasonReset(k)).toBe(true);

    expect(loadSave(k('save')).records).toEqual({});
    expect(loadSave(k('save')).totals.score).toBe(0);
    expect(read(k('hints'), null)).toBe(STARTING_TOKENS);
    expect(read(k('achievements'), null)).toEqual([]);
    expect(read(k('labyrinth'), null)).toBeNull();
    expect(read(k('scoresPushed'), null)).toBeNull();
    // Creations and preferences survive.
    expect(read(k('worlds'), null)).toHaveLength(1);
    expect(read(k('settings'), null)).toEqual({ musicVolume: 12 });
    expect(read(k('season'), null)).toBe(SEASON);

    // Progress made after the reset is never wiped again this season.
    write(k('hints'), 9);
    expect(applySeasonReset(k)).toBe(false);
    expect(read(k('hints'), null)).toBe(9);
  });

  it('leaves a profile already on this season alone', () => {
    const k = keyFor('fresh');
    write(k('season'), SEASON);
    write(k('hints'), 5);
    expect(applySeasonReset(k)).toBe(false);
    expect(read(k('hints'), null)).toBe(5);
  });
});

describe('server player keys', () => {
  it('reads named keys', () => {
    const players = parsePlayers('Scotty:abc123, Anaïs:def456');
    expect(players.get('abc123')).toBe('Scotty');
    expect(players.get('def456')).toBe('Anaïs');
    expect(players.size).toBe(2);
  });

  it('still accepts bare keys, naming them after their prefix', () => {
    const players = parsePlayers('scotty-7f2k9,anais-x8a1z');
    expect(players.get('scotty-7f2k9')).toBe('Scotty');
    expect(players.get('anais-x8a1z')).toBe('Anais');
  });

  it('keeps everything after the first colon as the key', () => {
    expect(parsePlayers('Scotty:a:b').get('a:b')).toBe('Scotty');
  });

  it('ignores empty entries', () => {
    expect(parsePlayers(' , ,').size).toBe(0);
    expect(parsePlayers(undefined).size).toBe(0);
  });
});
