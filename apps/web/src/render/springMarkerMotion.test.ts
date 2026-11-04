import { describe, expect, it } from 'vitest';
import { MARKER_BOB_AMPLITUDE, MARKER_BOB_MS, MARKER_TURN_MS, markerPose } from './springMarkerMotion';

describe('markerPose', () => {
  it('starts facing the viewer at its resting height', () => {
    const pose = markerPose(0);

    expect(pose.width).toBe(1);
    expect(pose.lift).toBeCloseTo(0);
  });

  it('turns edge-on a quarter turn in but never narrows past the minimum', () => {
    const pose = markerPose(MARKER_TURN_MS / 4);

    expect(pose.width).toBeCloseTo(0.1);
  });

  it('is back at its start after a whole turn and a whole bob of the same length', () => {
    const lcm = MARKER_TURN_MS * 3;
    expect(lcm % MARKER_BOB_MS).toBe(0);

    expect(markerPose(lcm).width).toBeCloseTo(markerPose(0).width);
    expect(markerPose(lcm).lift).toBeCloseTo(markerPose(0).lift);
  });

  it('peaks and troughs at the bob amplitude', () => {
    expect(markerPose(MARKER_BOB_MS / 4).lift).toBeCloseTo(MARKER_BOB_AMPLITUDE);
    expect(markerPose((MARKER_BOB_MS * 3) / 4).lift).toBeCloseTo(-MARKER_BOB_AMPLITUDE);
  });

  it('offsets one marker from another by the phase', () => {
    const pose = markerPose(0, 0.25);

    expect(pose.lift).toBeCloseTo(MARKER_BOB_AMPLITUDE);
    expect(pose.width).toBeCloseTo(0.1);
  });
});
