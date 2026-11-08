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
