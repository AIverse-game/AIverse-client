import { describe, expect, it } from 'vitest';
import { axisTicks, formatCoordinate, MAP_PIXELS, MARGIN, projectMap } from './layout';

describe('projectMap', () => {
  it('puts the origin at the top-left and the far corner at the bottom-right', () => {
    const { toScreen, scale } = projectMap(100);
    expect(scale).toBe(MAP_PIXELS / 100);
    expect(toScreen({ x: 0, y: 0 })).toEqual({ x: MARGIN, y: MARGIN });
    expect(toScreen({ x: 100, y: 100 })).toEqual({ x: MARGIN + MAP_PIXELS, y: MARGIN + MAP_PIXELS });
    // x moves right only, y moves down only.
    expect(toScreen({ x: 25, y: 0 })).toEqual({ x: MARGIN + MAP_PIXELS / 4, y: MARGIN });
    expect(toScreen({ x: 0, y: 25 })).toEqual({ x: MARGIN, y: MARGIN + MAP_PIXELS / 4 });
  });

  it('scales any map size to the same canvas square', () => {
    expect(projectMap(40).toScreen({ x: 40, y: 20 })).toEqual({ x: MARGIN + MAP_PIXELS, y: MARGIN + MAP_PIXELS / 2 });
  });

  it('maps canvas points back to map positions, and nothing outside the map', () => {
    const { toMap, toScreen } = projectMap(100);
    const screen = toScreen({ x: 12.5, y: 80 });
    expect(toMap(screen.x, screen.y)).toEqual({ x: 12.5, y: 80 });
    expect(toMap(MARGIN - 1, MARGIN)).toBeNull();
    expect(toMap(MARGIN, MARGIN + MAP_PIXELS + 1)).toBeNull();
  });
});

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
