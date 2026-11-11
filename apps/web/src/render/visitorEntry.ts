/**
 * How a visitor comes into town, after the spawn of `demos/neon_spawn_lobby.html`: it grows out of the
 * spawn pad's beam while spinning down from two turns, and the beam brightens and dims as it does.
 * Times are in seconds.
 */

/** Seconds from the first sight of a visitor until it stands full size, the same as the lobby newcomer's spawn. */
export const ENTRY_SECONDS = 1.2;
/** Smallest size it is drawn at, so its matrix stays invertible on the first frame. */
const MIN_SIZE = 0.001;

export interface EntryPose {
  /** Share of its full size, growing from almost nothing to 1. */
  size: number;
  /** Extra yaw on top of its heading, unwinding from four half turns to none. */
  spin: number;
  /** How bright the spawn beam is lit for it, rising to 1 halfway and back to 0. */
  beam: number;
}

/** The visitor `age` seconds after it was first seen; null once it has fully appeared. */
export function entryPose(age: number): EntryPose | null {
  if (age >= ENTRY_SECONDS) return null;
  const k = Math.max(age, 0) / ENTRY_SECONDS;
  return { size: Math.max(k, MIN_SIZE), spin: (1 - k) * Math.PI * 4, beam: Math.sin(k * Math.PI) };
}

/** Two messages further apart than this, in ms, were not seen one after the other (a tab in the background, a stalled link): nobody counts as just come in. */
export const ARRIVAL_GAP_MS = 3000;
/** A new visitor further than this from the entrance, in map units, came in a while ago and simply appears. */
export const ARRIVAL_REACH = 8;

interface Sighting {
  /** When it arrived, on the `performance.now()` clock. */
  receivedAt: number;
  visitors: readonly { id: number; position: { x: number; y: number } }[];
}

/**
 * The visitors of `after` that have just come into town through `entrance`: not in `before`, the
 * message seen just before it, and still near the entrance. None when there is no message before
 * (the page has just opened) or the two are too far apart in time to tell.
 */
export function newArrivals(before: Sighting | null, after: Sighting, entrance: { x: number; y: number } | null): number[] {
  if (!before || !entrance || after.receivedAt - before.receivedAt > ARRIVAL_GAP_MS) return [];
  const known = new Set(before.visitors.map((visitor) => visitor.id));
  return after.visitors
    .filter(({ id, position }) => !known.has(id) && Math.hypot(position.x - entrance.x, position.y - entrance.y) <= ARRIVAL_REACH)
    .map((visitor) => visitor.id);
}
