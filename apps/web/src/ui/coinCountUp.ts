/**
 * How a coin amount in the panels moves to a new value, after the coin effect over facilities: the
 * number runs up (or down) to it quickly and settles, while the coin beside it makes one full turn.
 * Times are in milliseconds.
 */

/** Milliseconds the number takes to reach its new value. */
export const COUNT_MS = 800;
/** Milliseconds the red gain stays beside the amount. */
export const GAIN_MS = 2400;

const easeOut = (k: number): number => 1 - (1 - k) ** 3;

/** The whole number shown `elapsed` ms after the amount started moving from `from` to `to`. */
export function countUp(from: number, to: number, elapsed: number): number {
  const k = Math.min(Math.max(elapsed / COUNT_MS, 0), 1);
  return Math.round(from + (to - from) * easeOut(k));
}

/** How far the coin has turned `elapsed` ms after the amount started moving, in radians: one turn, slowing to a stop. */
export function coinTurn(elapsed: number): number {
  const k = Math.min(Math.max(elapsed / COUNT_MS, 0), 1);
  return 2 * Math.PI * easeOut(k);
}
