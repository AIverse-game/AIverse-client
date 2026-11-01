/** Milliseconds for the marker to turn once around its vertical axis. */
export const MARKER_TURN_MS = 3200;
/** Milliseconds for one up-and-down bob. */
export const MARKER_BOB_MS = 2400;
/** Bob travel either way, as a fraction of the marker's height. */
export const MARKER_BOB_AMPLITUDE = 0.06;
/** Narrowest the turning marker gets, so it never vanishes edge-on. */
const MARKER_MIN_WIDTH = 0.1;

export interface MarkerPose {
  /** Horizontal scale as a fraction of the marker's full width; the picture is symmetric, so a turn reads as |cos|. */
  width: number;
  /** Rise above its resting height as a fraction of the marker's height; negative is below. */
  lift: number;
}

/** Where a pool's floating marker is `timeMs` into its spin and bob; `phase` in [0, 1) offsets one marker from another. */
export function markerPose(timeMs: number, phase = 0): MarkerPose {
  const turn = (timeMs / MARKER_TURN_MS + phase) * 2 * Math.PI;
  const bob = (timeMs / MARKER_BOB_MS + phase) * 2 * Math.PI;
  return {
    width: Math.max(Math.abs(Math.cos(turn)), MARKER_MIN_WIDTH),
    lift: Math.sin(bob) * MARKER_BOB_AMPLITUDE,
  };
}
