import { describe, expect, it } from 'vitest';
import {
  axisTicks,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  formatCoordinate,
  HEADROOM,
  MAP_DISPLAY_SCALE,
  MARGIN,
  projectMap,
  collectorPositionOnSpring,
  SLAB_DEPTH,
} from './layout';

describe('projectMap', () => {
  const size = 100;
  const { toScreen, scaleAt, toMap } = projectMap(size);
  const origin = toScreen({ x: 0, y: 0 });
  const east = toScreen({ x: size, y: 0 });
  const south = toScreen({ x: 0, y: size });
  const far = toScreen({ x: size, y: size });

  it('turns the map so the origin is the top corner, x runs down-right and y down-left', () => {
    expect(origin.y).toBeLessThan(Math.min(east.y, south.y));
    expect(far.y).toBeGreaterThan(Math.max(east.y, south.y));
    expect(east.x).toBeGreaterThan(origin.x);
    expect(south.x).toBeLessThan(origin.x);
    // The camera looks straight along the diagonal, so the picture is symmetric.
    expect(origin.x).toBeCloseTo(far.x);
    expect(east.y).toBeCloseTo(south.y);
    expect(east.x - origin.x).toBeCloseTo(origin.x - south.x);
  });

  it('draws the far side smaller than the near side', () => {
    expect(scaleAt({ x: 0, y: 0 })).toBeLessThan(1);
    expect(scaleAt({ x: size / 2, y: size / 2 })).toBeCloseTo(1);
    expect(scaleAt({ x: size, y: size })).toBeGreaterThan(1);
    // The far half of the diamond is shorter on screen than the near half.
    expect(east.y - origin.y).toBeLessThan(far.y - east.y);
  });

  it('fits the whole slab inside the margins, with headroom above the far corner', () => {
    const points = [origin, east, south, far, toScreen({ x: size, y: size }, -SLAB_DEPTH * size)];
    for (const { x, y } of points) {
      expect(x).toBeGreaterThanOrEqual(MARGIN - 1e-6);
      expect(x).toBeLessThanOrEqual(CANVAS_WIDTH - MARGIN + 1e-6);
      expect(y).toBeGreaterThanOrEqual(MARGIN + HEADROOM - 1e-6);
      expect(y).toBeLessThanOrEqual(CANVAS_HEIGHT - MARGIN + 1e-6);
    }
  });

  it('gives the ground a wider footprint while leaving sprite dimensions independent', () => {
    expect(east.x - south.x).toBeGreaterThan(1080 * MAP_DISPLAY_SCALE);
  });

  it('draws any map size as the same picture', () => {
    const small = projectMap(40).toScreen({ x: 40, y: 20 });
    const large = toScreen({ x: 100, y: 50 });
    expect(small.x).toBeCloseTo(large.x);
    expect(small.y).toBeCloseTo(large.y);
  });

  it('lifts raised points straight up the screen', () => {
    const ground = toScreen({ x: 50, y: 50 });
    const raised = toScreen({ x: 50, y: 50 }, 5);
    expect(raised.x).toBeCloseTo(ground.x);
    expect(raised.y).toBeLessThan(ground.y);
  });

  it('maps canvas points back to ground positions, and nothing outside the map', () => {
    for (const position of [
      { x: 12.5, y: 80 },
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ]) {
      const screen = toScreen(position);
      const back = toMap(screen.x, screen.y)!;
      expect(back.x).toBeCloseTo(position.x, 6);
      expect(back.y).toBeCloseTo(position.y, 6);
    }
    expect(toMap(origin.x, origin.y - 5)).toBeNull();
    expect(toMap(far.x, far.y + 5)).toBeNull();
    // The top-left canvas corner is off the map; far above it is past the horizon.
    expect(toMap(0, 0)).toBeNull();
    expect(toMap(origin.x, -1e6)).toBeNull();
  });
});

describe('collectorPositionOnSpring', () => {
  it.each([
    { position: { x: 75, y: 75 }, radius: 4 },
    { position: { x: 20, y: 110 }, radius: 2 },
  ])('keeps the marker base within the spring at $position and radius $radius', (spring) => {
    const position = collectorPositionOnSpring(spring);

    expect(Math.hypot(position.x - spring.position.x, position.y - spring.position.y)).toBeLessThan(spring.radius);
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
