// Seeded randomness for Ember Lanes: one tiny generator, so a game with the
// same seed always deals the same cards and the same seed always gives the
// same screenshot. No Math.random anywhere in the game logic.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle driven by the seeded generator. Returns the array. */
export function shuffleInPlace(items, rand) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

/** Pick one element of an array with the seeded generator. */
export function pickOne(items, rand) {
  return items[Math.floor(rand() * items.length)];
}
