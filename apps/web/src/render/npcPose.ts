export interface NpcPose {
  /** Swing of the left arm in radians; the right arm swings the opposite way. */
  arm: number;
  /** Swing of the left leg in radians; the right leg swings the opposite way. */
  leg: number;
  /** Turn of the head in radians. */
  head: number;
}

/** The demo character swings its limbs 0.7 rad. */
export const WALK_SWING = 0.7;
/** Walk-cycle phase advance per second. */
export const WALK_RATE = 10;

/** Limb and head angles of the demo character at a point of its walk cycle, or of its idle look-around. */
export function walkPose(phase: number, moving: boolean): NpcPose {
  if (!moving) return { arm: 0, leg: 0, head: Math.sin(phase * 0.25) * 0.12 };
  const swing = Math.sin(phase) * WALK_SWING;
  return { arm: swing, leg: -swing, head: Math.sin(phase * 0.5) * 0.15 };
}
