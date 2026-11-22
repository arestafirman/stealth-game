// A tiny seeded random generator (mulberry32) so a run with a given seed
// plays out exactly the same way every time. The game uses it for the small
// cosmetic jitter — guard pause lengths, loot sparkle — never for anything
// the player cannot learn. Screenshot staging passes seed 1.
export function makeRandom(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick an integer in [min, max] from a seeded generator.
export function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
