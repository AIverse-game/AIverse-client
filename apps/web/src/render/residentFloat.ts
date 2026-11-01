/** Milliseconds for one up-and-down bob while standing still, and while moving. */
export const IDLE_BOB_MS = 2400;
export const MOVING_BOB_MS = 650;
/** Bob travel either way, in figure units, standing still and moving. */
export const IDLE_BOB_UNITS = 1.5;
export const MOVING_BOB_UNITS = 3.5;
/** Milliseconds the bob takes to go from one pace to the other. */
const EASE_MS = 300;
/** How much the shadow shrinks, per figure unit the resident rises. */
const SHADOW_SHRINK_PER_UNIT = 0.03;

/** Where a resident is in its bob; `effort` is 0 standing still and 1 moving, easing between. */
export interface FloatState {
  angle: number;
  effort: number;
}

export interface FloatPose {
  /** Figure units the resident floats above its resting height; negative is below. */
  lift: number;
  /** Scale of the shadow on the ground, smaller as the resident rises. */
  shadow: number;
}

const mix = (from: number, to: number, share: number) => from + (to - from) * share;

/** Advances a resident's bob by `dtMs`, speeding it up while it moves; the angle never jumps when the pace changes. */
export function stepFloat(state: FloatState, dtMs: number, moving: boolean): FloatState {
  const step = dtMs / EASE_MS;
  const target = moving ? 1 : 0;
  const effort = state.effort < target ? Math.min(state.effort + step, target) : Math.max(state.effort - step, target);
  const period = mix(IDLE_BOB_MS, MOVING_BOB_MS, effort);
  return { angle: (state.angle + (dtMs / period) * 2 * Math.PI) % (2 * Math.PI), effort };
}

export function floatPose({ angle, effort }: FloatState): FloatPose {
  const lift = Math.sin(angle) * mix(IDLE_BOB_UNITS, MOVING_BOB_UNITS, effort);
  return { lift, shadow: 1 - lift * SHADOW_SHRINK_PER_UNIT };
}
