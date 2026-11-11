import type { VisitorView } from '@aiverse/protocol';

export interface VisitorPlace {
  x: number;
  y: number;
  /** Yaw that faces the way it walks, as the residents' is; null while it has not walked anywhere. */
  heading: number | null;
  /** Whether it is still on its way, so it swings its limbs. */
  moving: boolean;
}

/**
 * Where a visitor is `seconds` after the server sent it: along its remaining legs at `speed`, and at
 * the end of the last one once they are used up. A leg that starts elsewhere than the last ended
 * is a portal, crossed in no time.
 */
export function visitorPlace(visitor: VisitorView, speed: number, seconds: number): VisitorPlace {
  let walked = Math.max(seconds, 0) * speed;
  let last: VisitorView['legs'][number] | null = null;
  for (const leg of visitor.legs) {
    const dx = leg.end.x - leg.start.x;
    const dy = leg.end.y - leg.start.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    last = leg;
    if (walked < length) {
      const share = walked / length;
      return { x: leg.start.x + dx * share, y: leg.start.y + dy * share, heading: Math.atan2(dx, dy), moving: true };
    }
    walked -= length;
  }
  if (!last) return { ...visitor.position, heading: null, moving: false };
  return { ...last.end, heading: Math.atan2(last.end.x - last.start.x, last.end.y - last.start.y), moving: false };
}

/** A visitor catches up with where the server says it is this many times as fast as it walks. */
export const CATCH_UP_FACTOR = 3;
/** Further off than this, the visitor is not walking to the spot but was sent there through a portal: it jumps. */
export const SNAP_DISTANCE = 8;

/**
 * Where a visitor shown at `shown` appears after `step` map units of catching up with `target`.
 * A visitor stood still between two messages while the server had already sent it off, so the next
 * message puts it up to a few units ahead; walking the gap keeps it from jumping there. A gap wider
 * than `snapDistance` is jumped; one that walks in from the entrance passes Infinity, to walk it all.
 */
export function catchUp(
  shown: { x: number; y: number },
  target: { x: number; y: number },
  step: number,
  snapDistance = SNAP_DISTANCE,
): { x: number; y: number } {
  const dx = target.x - shown.x;
  const dy = target.y - shown.y;
  const gap = Math.hypot(dx, dy);
  if (gap <= step || gap > snapDistance) return { x: target.x, y: target.y };
  return { x: shown.x + (dx / gap) * step, y: shown.y + (dy / gap) * step };
}

/** How far apart, in map units, the end of one leg and the start of the next must be to be a portal and not one walk. */
const PORTAL_GAP = 1e-6;

export interface PortalCrossing {
  /** Where the visitor went into the portal network: the end of the leg before the break. */
  exit: { x: number; y: number };
  /** Where it came out: the start of the leg after it. */
  entry: { x: number; y: number };
}

/**
 * The last portal the visitor goes through after more than `from` and up to `to` seconds since the
 * server sent it, walking at `speed`; null when it goes through none in that time. A portal is a leg
 * that starts elsewhere than the one before ended, as in `visitorPlace`, which puts it at the far
 * side from the moment it reaches the break.
 */
export function portalCrossing(visitor: VisitorView, speed: number, from: number, to: number): PortalCrossing | null {
  const start = Math.max(from, 0) * speed;
  const end = Math.max(to, 0) * speed;
  if (end <= start) return null;
  let walked = 0;
  let last: VisitorView['legs'][number] | null = null;
  let crossing: PortalCrossing | null = null;
  for (const leg of visitor.legs) {
    if (walked > end) break;
    const length = Math.hypot(leg.end.x - leg.start.x, leg.end.y - leg.start.y);
    if (length === 0) continue;
    if (last && Math.hypot(leg.start.x - last.end.x, leg.start.y - last.end.y) > PORTAL_GAP && walked > start && walked <= end) {
      crossing = { exit: { ...last.end }, entry: { ...leg.start } };
    }
    last = leg;
    walked += length;
  }
  return crossing;
}

/** What a visitor's last frame was drawn from: the same message, so many seconds after it came, or a message that came so many ms before this one. */
export type LastDrawn = { sameMessage: true; seconds: number } | { sameMessage: false; messageGapMs: number };

/**
 * Whether a visitor drawn at `shown` goes through a portal this frame, `seconds` after its message
 * came, and if so from where it is drawn to where it comes out; null when it does not. Within one
 * message that is a leg break passed since the last frame. A new message that puts it further off
 * than it could have walked means it went through between messages, unless the messages came too
 * far apart to tell (`maxMessageGapMs`), when it may simply have walked there.
 */
export function portalHop(
  visitor: VisitorView,
  speed: number,
  shown: { x: number; y: number },
  last: LastDrawn,
  seconds: number,
  maxMessageGapMs: number,
): PortalCrossing | null {
  if (last.sameMessage) {
    const crossing = portalCrossing(visitor, speed, last.seconds, seconds);
    return crossing && { exit: { ...shown }, entry: crossing.entry };
  }
  if (last.messageGapMs > maxMessageGapMs) return null;
  const target = visitorPlace(visitor, speed, seconds);
  return Math.hypot(target.x - shown.x, target.y - shown.y) > SNAP_DISTANCE ? { exit: { ...shown }, entry: { x: target.x, y: target.y } } : null;
}
