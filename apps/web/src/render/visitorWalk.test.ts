import type { VisitorView } from '@aiverse/protocol';
import { describe, expect, it } from 'vitest';
import { catchUp, SNAP_DISTANCE, visitorPlace } from './visitorWalk';

const through = (...legs: [number, number, number, number][]): VisitorView => ({
  id: 1,
  position: { x: legs[0]![0], y: legs[0]![1] },
  legs: legs.map(([sx, sy, ex, ey]) => ({ start: { x: sx, y: sy }, end: { x: ex, y: ey } })),
});

describe('visitorPlace', () => {
  it('walks along the first leg at the given speed, facing the way it goes', () => {
    const visitor = through([0, 0, 10, 0]);

    const place = visitorPlace(visitor, 2.5, 2);

    expect(place).toEqual({ x: 5, y: 0, heading: Math.PI / 2, moving: true });
  });

  it('carries on into the next leg, which may start elsewhere after a portal', () => {
    const visitor = through([0, 0, 10, 0], [60, 0, 60, 20]);

    const place = visitorPlace(visitor, 2.5, 6);

    expect(place).toEqual({ x: 60, y: 5, heading: 0, moving: true });
  });

  it('stops at the end of the last leg once they are used up', () => {
    const visitor = through([0, 0, 10, 0], [60, 0, 60, 20]);

    const place = visitorPlace(visitor, 2.5, 1000);

    expect(place).toEqual({ x: 60, y: 20, heading: 0, moving: false });
  });

  it('stands still where it is sent when it has no legs, and keeps no heading', () => {
    const visitor: VisitorView = { id: 2, position: { x: 7, y: 9 }, legs: [] };

    const place = visitorPlace(visitor, 2.5, 30);

    expect(place).toEqual({ x: 7, y: 9, heading: null, moving: false });
  });

  it('does not run backwards when the clock reads before the message', () => {
    const visitor = through([0, 0, 10, 0]);

    const place = visitorPlace(visitor, 2.5, -3);

    expect(place.x).toBe(0);
  });
});

describe('catchUp', () => {
  it('moves a step towards a target that is further off', () => {
    const shown = { x: 0, y: 0 };

    const next = catchUp(shown, { x: 3, y: 4 }, 2);

    expect(next.x).toBeCloseTo(1.2);
    expect(next.y).toBeCloseTo(1.6);
  });

  it('lands on the target when it is within a step', () => {
    const next = catchUp({ x: 1, y: 1 }, { x: 2, y: 1 }, 2);

    expect(next).toEqual({ x: 2, y: 1 });
  });

  it('jumps when the target is too far to have been walked to, as after a portal', () => {
    const next = catchUp({ x: 0, y: 0 }, { x: SNAP_DISTANCE + 1, y: 0 }, 0.1);

    expect(next).toEqual({ x: SNAP_DISTANCE + 1, y: 0 });
  });

  it('still walks when the target is exactly the snap distance away', () => {
    const next = catchUp({ x: 0, y: 0 }, { x: SNAP_DISTANCE, y: 0 }, 1);

    expect(next).toEqual({ x: 1, y: 0 });
  });
});
