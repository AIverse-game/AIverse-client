import { describe, expect, it } from 'vitest';
import { FLOOR_TILES_PER_SIDE, floorVariant } from './mapFloor';

describe('floorVariant', () => {
  it('always chooses one of the four images, the same one for the same tile', () => {
    const variants = Array.from({ length: FLOOR_TILES_PER_SIDE ** 2 }, (_, i) => floorVariant(i % FLOOR_TILES_PER_SIDE, Math.floor(i / FLOOR_TILES_PER_SIDE)));

    expect(variants.every((variant) => Number.isInteger(variant) && variant >= 0 && variant <= 3)).toBe(true);
    expect(floorVariant(2, 3)).toBe(floorVariant(2, 3));
    expect(new Set(variants).size).toBeGreaterThan(1);
  });

  it('keeps the busy panels rare', () => {
    const variants = Array.from({ length: 400 }, (_, i) => floorVariant(i % 20, Math.floor(i / 20)));

    const quiet = variants.filter((variant) => variant === 1 || variant === 2).length;
    expect(quiet).toBeGreaterThan(variants.length / 2);
  });
});
