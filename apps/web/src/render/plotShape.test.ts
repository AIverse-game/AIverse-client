import { describe, expect, it } from 'vitest';
import { plotShape } from './plotShape';

describe('plotShape', () => {
  it('centres the model on its parcel and scales its width to the plot', () => {
    const shape = plotShape('ad', 8, 7, 10);

    expect(shape.centre).toEqual({ x: 85, y: 75 });
    expect(shape.side).toBeCloseTo(7.6);
    expect(shape.scale).toBeCloseTo(7.6 / 28);
  });

  it('raises the model by its slab and reaches up to its top', () => {
    const shape = plotShape('workspace', 0, 0, 10);

    expect(shape.floor).toBeCloseTo(3 * shape.scale);
    expect(shape.height).toBeCloseTo(22 * shape.scale);
  });

  it('fills almost the whole parcel with the arcade and the workspace and leaves a margin round the others', () => {
    expect(plotShape('game_hall', 0, 0, 10).side).toBeCloseTo(9.5);
    expect(plotShape('workspace', 0, 0, 10).side).toBeCloseTo(9.4);
    expect(plotShape('portal', 0, 0, 10).side).toBeCloseTo(7.6);
  });
});
