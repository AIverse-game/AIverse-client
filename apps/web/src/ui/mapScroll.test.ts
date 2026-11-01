import { describe, expect, it } from 'vitest';
import { wheelScrollDelta } from './mapScroll';

describe('wheelScrollDelta', () => {
  const viewport = { width: 1000, height: 700 };

  it.each([
    [{ deltaX: 12, deltaY: 40, deltaMode: 0, shiftKey: false }, { x: 12, y: 40 }],
    [{ deltaX: 0, deltaY: 3, deltaMode: 1, shiftKey: false }, { x: 0, y: 48 }],
    [{ deltaX: 0, deltaY: 1, deltaMode: 2, shiftKey: false }, { x: 0, y: 700 }],
    [{ deltaX: 0, deltaY: 3, deltaMode: 1, shiftKey: true }, { x: 48, y: 0 }],
    [{ deltaX: 0, deltaY: 1, deltaMode: 2, shiftKey: true }, { x: 1000, y: 0 }],
  ])('converts wheel units to useful scroll distances', (event, expected) => {
    const movement = wheelScrollDelta(event, viewport);

    expect(movement).toEqual(expected);
  });
});
