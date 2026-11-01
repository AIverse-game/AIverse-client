import { describe, expect, it } from 'vitest';
import {
  floatPose,
  IDLE_BOB_MS,
  IDLE_BOB_UNITS,
  MOVING_BOB_MS,
  MOVING_BOB_UNITS,
  stepFloat,
  type FloatState,
} from './residentFloat';

const resting: FloatState = { angle: 0, effort: 0 };

describe('stepFloat', () => {
  it('goes through a whole idle bob in the idle period', () => {
    const state = stepFloat(resting, IDLE_BOB_MS, false);

    expect(state.angle).toBeCloseTo(0);
    expect(state.effort).toBe(0);
  });

  it('bobs faster while moving than standing still', () => {
    const idle = stepFloat(resting, 100, false);
    const moving = stepFloat({ ...resting, effort: 1 }, 100, true);

    expect(moving.angle / idle.angle).toBeCloseTo(IDLE_BOB_MS / MOVING_BOB_MS);
  });

  it('keeps the angle continuous when the pace changes', () => {
    const state = { angle: 1, effort: 0 };

    const next = stepFloat(state, 16, true);

    // One frame later the angle has moved on by about a frame's worth, not jumped to a new phase.
    expect(next.angle - state.angle).toBeGreaterThan(0);
    expect(next.angle - state.angle).toBeLessThan(0.2);
  });

  it('eases to full effort when it starts moving and back when it stops', () => {
    const started = stepFloat(resting, 150, true);
    const arrived = stepFloat(started, 1000, true);
    const stopped = stepFloat(arrived, 1000, false);

    expect(started.effort).toBeCloseTo(0.5);
    expect(arrived.effort).toBe(1);
    expect(stopped.effort).toBe(0);
  });
});

describe('floatPose', () => {
  it('rises by the idle travel at the top of a standing bob and the moving travel at the top of a moving one', () => {
    const top = Math.PI / 2;

    expect(floatPose({ angle: top, effort: 0 }).lift).toBeCloseTo(IDLE_BOB_UNITS);
    expect(floatPose({ angle: top, effort: 1 }).lift).toBeCloseTo(MOVING_BOB_UNITS);
  });

  it('shrinks the shadow as the resident rises and widens it as it sinks', () => {
    const up = floatPose({ angle: Math.PI / 2, effort: 1 });
    const down = floatPose({ angle: -Math.PI / 2, effort: 1 });

    expect(up.shadow).toBeLessThan(1);
    expect(down.shadow).toBeGreaterThan(1);
  });
});
