import type { VisitorView } from '@aiverse/protocol';
import { describe, expect, it } from 'vitest';
import { catchUp, portalCrossing, portalHop, SNAP_DISTANCE, visitorPlace } from './visitorWalk';

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

  it('walks any gap when told not to jump, as a visitor coming from the entrance does', () => {
    const next = catchUp({ x: 0, y: 0 }, { x: SNAP_DISTANCE * 3, y: 0 }, 1, Infinity);

    expect(next).toEqual({ x: 1, y: 0 });
  });
});

describe('portalCrossing', () => {
  // 10 units to the portal at (10, 0), out at (60, 0); at 2.5 a second it gets there after 4 s.
  const hopper = through([0, 0, 10, 0], [60, 0, 60, 20]);

  it('finds the portal the visitor reaches in the time, with where it went in and came out', () => {
    expect(portalCrossing(hopper, 2.5, 3.9, 4.1)).toEqual({ exit: { x: 10, y: 0 }, entry: { x: 60, y: 0 } });
  });

  it('counts the moment it reaches the break as going through, as visitorPlace puts it out there', () => {
    expect(portalCrossing(hopper, 2.5, 3.9, 4)).not.toBeNull();
    expect(portalCrossing(hopper, 2.5, 4, 4.2)).toBeNull();
  });

  it('finds nothing before or after the portal', () => {
    expect(portalCrossing(hopper, 2.5, 1, 3)).toBeNull();
    expect(portalCrossing(hopper, 2.5, 5, 9)).toBeNull();
  });

  it('does not take a turn at the end of a bridge for a portal', () => {
    const turning = through([0, 0, 10, 0], [10, 0, 10, 20]);

    expect(portalCrossing(turning, 2.5, 3, 5)).toBeNull();
  });

  it('skips a leg of no length, as visitorPlace does, wherever it lies', () => {
    const stray = through([0, 0, 10, 0], [40, 40, 40, 40], [10, 0, 10, 20]);
    const atPortal = through([0, 0, 10, 0], [60, 0, 60, 0], [60, 0, 60, 20]);

    expect(portalCrossing(stray, 2.5, 3, 5)).toBeNull();
    expect(portalCrossing(atPortal, 2.5, 3, 5)).toEqual({ exit: { x: 10, y: 0 }, entry: { x: 60, y: 0 } });
  });

  it('gives the last of several portals passed in one go', () => {
    const twice = through([0, 0, 1, 0], [30, 0, 31, 0], [80, 0, 90, 0]);

    expect(portalCrossing(twice, 2.5, 0, 2)).toEqual({ exit: { x: 31, y: 0 }, entry: { x: 80, y: 0 } });
  });
});

describe('portalHop', () => {
  // As in portalCrossing: the portal at (10, 0) is reached 4 s after the message, out at (60, 0).
  const hopper = through([0, 0, 10, 0], [60, 0, 60, 20]);
  const gapLimit = 3000;

  it('goes from where the visitor is drawn to the far side when it passes the break in one message', () => {
    const shown = { x: 8, y: 0 };

    const hop = portalHop(hopper, 2.5, shown, { sameMessage: true, seconds: 3.9 }, 4.1, gapLimit);

    expect(hop).toEqual({ exit: { x: 8, y: 0 }, entry: { x: 60, y: 0 } });
  });

  it('does nothing while the visitor walks on in one message', () => {
    expect(portalHop(hopper, 2.5, { x: 5, y: 0 }, { sameMessage: true, seconds: 1 }, 2, gapLimit)).toBeNull();
  });

  it('takes a new message that puts it further off than it could walk as a portal passed in between', () => {
    const shown = { x: 10, y: 0 };

    const hop = portalHop(hopper, 2.5, shown, { sameMessage: false, messageGapMs: 2000 }, 6, gapLimit);

    expect(hop).toEqual({ exit: { x: 10, y: 0 }, entry: { x: 60, y: 5 } });
  });

  it('lets a new message that is near where it is drawn be walked to', () => {
    expect(portalHop(hopper, 2.5, { x: 3, y: 0 }, { sameMessage: false, messageGapMs: 2000 }, 2, gapLimit)).toBeNull();
  });

  it('does not take a far jump for a portal when the messages came too far apart to tell', () => {
    expect(portalHop(hopper, 2.5, { x: 0, y: 0 }, { sameMessage: false, messageGapMs: gapLimit + 1 }, 6, gapLimit)).toBeNull();
  });
});
