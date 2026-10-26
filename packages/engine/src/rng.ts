// Mulberry32: a tiny seeded PRNG whose whole state is one uint32, so it can live
// inside the match state and make every resolution reproducible.

export function seedRandom(seed: number): number {
  return seed >>> 0;
}

/** Returns a value in [0, 1) and the next generator state. */
export function nextRandom(state: number): [value: number, next: number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}
