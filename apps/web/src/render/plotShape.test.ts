import { describe, expect, it } from 'vitest';
import { plotShape } from './plotShape';

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
});
