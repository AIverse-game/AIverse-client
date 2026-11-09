import { describe, expect, it } from 'vitest';
import { MACHINES, machinesFor } from './arcadeMachineModels';
import { ARCADE_SPAN, MACHINE_SCALE } from './arcadeModel';

/** How far the widest machine, the holographic stage, reaches from its centre: its 6.4 base and the 6.8 its front pads stick out, in demo units. */
const WIDEST_REACH = 6.8;

describe('machinesFor', () => {
  it.each([[0, []], [1, ['arcade']], [3, ['arcade', 'claw', 'holo']], [5, ['arcade', 'claw', 'holo', 'race', 'dance']]])(
    'puts one more machine in the hall for each of %i games',
    (contents, kinds) => {
      expect(machinesFor(contents).map((spec) => spec.kind)).toEqual(kinds);
    },
  );

  it('never shows more than the five machines', () => {
    expect(machinesFor(9)).toHaveLength(5);
  });

  it('shows none for a negative count', () => {
    expect(machinesFor(-2)).toHaveLength(0);
  });
});

describe('MACHINES', () => {
  it('stand with their widest part inside the hall walls once scaled', () => {
    for (const { position } of MACHINES) {
      expect((Math.abs(position.x) + WIDEST_REACH) * MACHINE_SCALE).toBeLessThan(ARCADE_SPAN / 2);
      expect((Math.abs(position.z) + WIDEST_REACH) * MACHINE_SCALE).toBeLessThan(ARCADE_SPAN / 2);
    }
  });
});
