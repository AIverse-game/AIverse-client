import { describe, expect, it } from 'vitest';
import { WALK_SWING, walkPose } from './npcPose';

describe('walkPose', () => {
  it('swings no more than the walking swing while walking', () => {
    const swings = Array.from({ length: 200 }, (_, i) => walkPose(i * 0.1, true));

    expect(Math.max(...swings.map((pose) => Math.abs(pose.arm)))).toBeLessThanOrEqual(WALK_SWING);
    expect(Math.max(...swings.map((pose) => Math.abs(pose.arm)))).toBeGreaterThan(WALK_SWING * 0.95);
  });

  it('swings each leg against the arm on its side', () => {
    const pose = walkPose(1, true);

    expect(pose.leg).toBeCloseTo(-pose.arm);
    expect(pose.arm).not.toBe(0);
  });

  it('keeps the limbs still when standing and only turns the head', () => {
    const pose = walkPose(3, false);

    expect(pose.arm).toBe(0);
    expect(pose.leg).toBe(0);
    expect(Math.abs(pose.head)).toBeLessThan(0.15);
  });
});
