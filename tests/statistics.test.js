import { describe, it, expect } from 'vitest';
import { findNotable } from '../src/ui/screens/statistics.js';
import { BUILTIN_WORLDS } from '../src/core/worlds.js';

const assembly = BUILTIN_WORLDS.find((w) => w.id === 'assembly');
const [levelA, levelB] = assembly.levels;

function saveWith(records) {
  return { records: { assembly: records }, totals: {} };
}

describe('findNotable', () => {
  it('returns nulls when nothing has been played', () => {
    const { mostReplayed, toughest, fastest } = findNotable(saveWith({}));
    expect(mostReplayed).toBeNull();
    expect(toughest).toBeNull();
    expect(fastest).toBeNull();
  });

  it('picks the level with the highest play count', () => {
    const { mostReplayed } = findNotable(
      saveWith({
        [levelA.id]: { playCount: 2, bestStars: 3 },
        [levelB.id]: { playCount: 5, bestStars: 3 },
      }),
    );
    expect(mostReplayed.level.id).toBe(levelB.id);
  });

  it('picks the level with the fewest stars as toughest', () => {
    const { toughest } = findNotable(
      saveWith({
        [levelA.id]: { playCount: 1, bestStars: 3 },
        [levelB.id]: { playCount: 1, bestStars: 1 },
      }),
    );
    expect(toughest.level.id).toBe(levelB.id);
  });

  it('picks the fastest level by time-per-par, not raw time', () => {
    // The level with the larger par is given the larger raw time but the
    // better pace (time / par), and must still be picked as fastest.
    const [small, large] = [levelA, levelB].sort((a, b) => a.par - b.par);
    expect(large.par).toBeGreaterThan(small.par);
    const smallTime = small.par; // pace 1.0
    const largeTime = Math.max(smallTime + 1, Math.floor(large.par * 0.9)); // pace < 1, raw time larger
    expect(largeTime / large.par).toBeLessThan(1);
    const { fastest } = findNotable(
      saveWith({
        [small.id]: { bestTime: smallTime, bestStars: 3 },
        [large.id]: { bestTime: largeTime, bestStars: 3 },
      }),
    );
    expect(fastest.level.id).toBe(large.id);
  });

  it('ignores a record with no recorded time for the fastest pick', () => {
    const { fastest } = findNotable(
      saveWith({
        [levelA.id]: { bestStars: 3 }, // no bestTime
        [levelB.id]: { bestTime: 5, bestStars: 3 },
      }),
    );
    expect(fastest.level.id).toBe(levelB.id);
  });
});
