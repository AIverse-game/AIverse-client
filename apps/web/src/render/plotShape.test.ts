import { describe, expect, it } from 'vitest';
import { ARCADE_SLAB } from './arcadeModel';
import { floorHeightAt, plotShape } from './plotShape';

/** The game hall's shell reached 39 model units over its slab before it was lowered. */
const OLD_ARCADE_TOP = 39;

const at = (col: number, row: number) => ({ x0: col * 10, z0: row * 10, x1: col * 10 + 10, z1: row * 10 + 10 });

describe('plotShape', () => {
  it('centres the model on its parcel and scales its width to the plot', () => {
    const shape = plotShape('ad', at(8, 7));

    expect(shape.centre).toEqual({ x: 85, y: 75 });
    expect(shape.side).toBeCloseTo(7.6);
    expect(shape.scale).toBeCloseTo(7.6 / 28);
  });

  it('raises the model by its slab and reaches up to its top', () => {
    const shape = plotShape('workspace', at(0, 0));

    expect(shape.floor).toBeCloseTo(3 * shape.scale);
    expect(shape.height).toBeCloseTo(22 * shape.scale);
  });

  it('fills almost the whole parcel with the arcade and the workspace and leaves a margin round the others', () => {
    expect(plotShape('game_hall', at(0, 0)).side).toBeCloseTo(9.5);
    expect(plotShape('workspace', at(0, 0)).side).toBeCloseTo(9.4);
    expect(plotShape('portal', at(0, 0)).side).toBeCloseTo(7.6);
  });

  it('draws the mall 7.5 wide and twice as long, the same wherever it stands in its block', () => {
    const island = { x0: 2, z0: 2, x1: 28, z1: 28 };
    const lands = [{ x0: 0, z0: 0, x1: 10, z1: 20 }, { x0: 10, z0: 10, x1: 20, z1: 30 }, { x0: 20, z0: 0, x1: 30, z1: 20 }];

    const shapes = lands.map((land) => plotShape('mall', land, island));

    for (const shape of shapes) {
      expect(shape.side).toBeCloseTo(7.5);
      expect(shape.depth).toBeCloseTo(15);
    }
    expect(shapes[1]!.centre).toEqual({ x: 15, y: 19 });
    expect(shapes[0]!.centre.x - shapes[0]!.side / 2).toBeGreaterThanOrEqual(island.x0);
  });

  it('turns the mall a quarter when it runs east to west, so it covers 15 across and 7.5 down', () => {
    const island = { x0: 2, z0: 2, x1: 28, z1: 28 };
    const lands = [{ x0: 0, z0: 0, x1: 20, z1: 10 }, { x0: 10, z0: 10, x1: 30, z1: 20 }, { x0: 0, z0: 20, x1: 20, z1: 30 }];

    const shapes = lands.map((land) => plotShape('mall', land, island, 'east_west'));

    for (const shape of shapes) {
      expect(shape.extent.x).toBeCloseTo(15);
      expect(shape.extent.z).toBeCloseTo(7.5);
      expect(shape.turn).toBeCloseTo(Math.PI / 2);
    }
    expect(plotShape('mall', lands[0]!, island).turn).toBe(0);
    expect(plotShape('mall', { x0: 0, z0: 0, x1: 10, z1: 20 }, island).extent).toEqual({ x: shapes[0]!.extent.z, z: shapes[0]!.extent.x });
  });

  it('keeps a venue on its island, centred on the part of its square the island covers', () => {
    const square = { x0: 0, z0: 0, x1: 20, z1: 20 };
    const island = { x0: 2, z0: 2, x1: 28, z1: 28 };

    const shape = plotShape('workspace', square, island);

    expect(shape.centre).toEqual({ x: 11, y: 11 });
    expect(shape.side).toBeCloseTo(18 * 0.94);
  });

  it('draws a venue the same size wherever it stands in its block and never past the island', () => {
    const island = { x0: 2, z0: 2, x1: 28, z1: 28 };
    const squares = [{ x0: 0, z0: 0, x1: 20, z1: 20 }, { x0: 10, z0: 10, x1: 30, z1: 30 }, { x0: 10, z0: 0, x1: 30, z1: 20 }];

    const shapes = squares.map((square) => plotShape('game_hall', square, island));

    for (const shape of shapes) {
      expect(shape.side).toBeCloseTo(shapes[0]!.side);
      expect(shape.centre.x - shape.side / 2).toBeGreaterThanOrEqual(island.x0);
      expect(shape.centre.x + shape.side / 2).toBeLessThanOrEqual(island.x1);
      expect(shape.centre.y - shape.side / 2).toBeGreaterThanOrEqual(island.z0);
      expect(shape.centre.y + shape.side / 2).toBeLessThanOrEqual(island.z1);
    }
  });

  it('draws the garden 7.2 wide, the same wherever it stands in its block, and inside its island', () => {
    const island = { x0: 2, z0: 2, x1: 28, z1: 28 };
    const parcels = [at(0, 0), at(1, 1), at(2, 2), at(2, 0)];

    const shapes = parcels.map((parcel) => plotShape('garden', parcel, island));

    for (const shape of shapes) {
      expect(shape.side).toBeCloseTo(7.2);
      expect(shape.centre.x - shape.side / 2).toBeGreaterThanOrEqual(island.x0);
      expect(shape.centre.x + shape.side / 2).toBeLessThanOrEqual(island.x1);
      expect(shape.centre.y - shape.side / 2).toBeGreaterThanOrEqual(island.z0);
      expect(shape.centre.y + shape.side / 2).toBeLessThanOrEqual(island.z1);
    }
    expect(shapes[1]!.centre).toEqual({ x: 15, y: 15 });
  });

  it('keeps the garden inside its parcel when there is no island to fit', () => {
    const shape = plotShape('garden', at(3, 4));

    expect(shape.centre).toEqual({ x: 35, y: 45 });
    expect(shape.extent.x).toBeLessThan(10);
    expect(shape.floor).toBeGreaterThan(0);
    expect(shape.height).toBeGreaterThan(shape.floor);
  });

  it('draws the mall taller than the game hall, and than the hall was before its shell was lowered', () => {
    const island = { x0: 2, z0: 2, x1: 28, z1: 28 };

    const mall = plotShape('mall', { x0: 0, z0: 0, x1: 10, z1: 20 }, island);
    const hall = plotShape('game_hall', { x0: 0, z0: 0, x1: 20, z1: 20 }, island);

    const hallBefore = (ARCADE_SLAB + OLD_ARCADE_TOP) * hall.scale;
    expect(hall.height).toBeLessThan(hallBefore);
    expect(mall.height).toBeGreaterThan(hallBefore);
    expect(mall.height).toBeGreaterThan(hall.height);
  });
});

describe('floorHeightAt', () => {
  const hall = plotShape('game_hall', { x0: 0, z0: 0, x1: 20, z1: 20 });

  it('is the plinth top anywhere over what the model covers, edges included', () => {
    const { centre, extent, floor } = hall;

    const heights = [
      floorHeightAt(hall, centre.x, centre.y),
      floorHeightAt(hall, centre.x - extent.x / 2, centre.y + extent.z / 2),
      floorHeightAt(hall, centre.x + extent.x / 2 - 0.01, centre.y - extent.z / 2 + 0.01),
    ];

    expect(floor).toBeGreaterThan(0);
    expect(heights).toEqual([floor, floor, floor]);
  });

  it('is zero off the plinth', () => {
    const { centre, extent } = hall;

    expect(floorHeightAt(hall, centre.x + extent.x / 2 + 0.01, centre.y)).toBe(0);
    expect(floorHeightAt(hall, centre.x, centre.y - extent.z / 2 - 0.01)).toBe(0);
  });

  it('follows a mall turned east to west, which covers more across than down', () => {
    const mall = plotShape('mall', { x0: 0, z0: 0, x1: 20, z1: 10 }, undefined, 'east_west');

    expect(floorHeightAt(mall, mall.centre.x + mall.extent.x / 2 - 0.1, mall.centre.y)).toBe(mall.floor);
    expect(floorHeightAt(mall, mall.centre.x, mall.centre.y + mall.extent.z / 2 + 0.1)).toBe(0);
  });
});
