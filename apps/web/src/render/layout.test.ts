import { describe, expect, it } from 'vitest';
import { axisTicks, formatCoordinate } from './layout';

describe('axisTicks', () => {
  it.each([
    [100, [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]],
    [50, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]],
    [30, [0, 5, 10, 15, 20, 25, 30]],
    [1000, [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]],
    [2, [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2]],
  ])('uses round steps for a map of size %d', (size, expected) => {
    expect(axisTicks(size)).toEqual(expected);
  });

  it('never goes past the map edge', () => {
    expect(axisTicks(37).at(-1)).toBeLessThanOrEqual(37);
  });
});

describe('formatCoordinate', () => {
  it('keeps at most two decimals', () => {
    expect(formatCoordinate(20)).toBe('20');
    expect(formatCoordinate(12.5)).toBe('12.5');
    expect(formatCoordinate(1 / 3)).toBe('0.33');
  });
});
