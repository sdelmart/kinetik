/**
 * A tiny deterministic PRNG (mulberry32) so a maze can be regenerated bit-for-bit
 * from its seed — the same trick the Sokoban daily challenge uses for its level
 * pick, applied here to an entire generated board instead of an index.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Converts any string into a 32-bit seed (xfnv1a), so chapters can key off a name. */
export function seedFromString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function randInt(rng, maxExclusive) {
  return Math.floor(rng() * maxExclusive);
}

export function pick(rng, array) {
  return array[randInt(rng, array.length)];
}

/** Fisher-Yates, using the given rng so it stays reproducible. */
export function shuffle(rng, array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
