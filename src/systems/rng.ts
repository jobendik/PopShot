// ============================ GAMEPLAY RNG ==========================
// One seeded generator for everything that can change the outcome of a run:
// ball launch directions, hazard timing, boss attack choice, pickup rolls,
// Panic wave composition. Cosmetic randomness (particles, shake) keeps using
// Math.random via utils.rand — it never feeds back into the simulation.
//
// Combined with the fixed-timestep loop this makes a level fully reproducible
// from (seed, inputs): the Daily Challenge seeds from the UTC date so every
// player gets the same bounces, and the regression tests can replay scenarios.

let state = 0x9e3779b9;

/** Reseed. Any 32-bit integer; 0 is remapped so the stream never sticks. */
export function seedRng(seed: number) {
  state = (seed >>> 0) || 0x9e3779b9;
}

/** A fresh non-deterministic seed for ordinary (non-Daily) runs. */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

/** mulberry32 — tiny, fast, well distributed. Returns [0, 1). */
export function grand01(): number {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const grand = (a: number, b: number) => a + grand01() * (b - a);
export const grandi = (a: number, b: number) => Math.floor(grand(a, b + 1));
export const gchance = (p: number) => grand01() < p;
export function gpick<T>(arr: readonly T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(grand01() * arr.length))];
}

/** FNV-1a string hash → 32-bit seed (shared with the Daily picker). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
