import { describe, expect, it } from 'vitest';
import { lobbyGroundHeight, lobbyPlacement } from './lobbyModel';

describe('lobbyPlacement', () => {
  it('spreads the 60-unit plaza over the middle block of the map', () => {
    const placement = lobbyPlacement({ size: 150, parcelSize: 10, blockCells: 3 });

    expect(placement.centre).toEqual({ x: 75, y: 75 });
    expect(placement.scale).toBeCloseTo(28 / 60);
  });
});

describe('lobbyGroundHeight', () => {
  it('is two steps up on the spawn pad and level elsewhere', () => {
    expect(lobbyGroundHeight(0, 0)).toBe(0.8);
    expect(lobbyGroundHeight(6.5, 0)).toBe(0.4);
    expect(lobbyGroundHeight(10, 10)).toBe(0);
  });
});
