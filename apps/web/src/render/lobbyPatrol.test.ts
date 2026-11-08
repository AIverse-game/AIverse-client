import { describe, expect, it } from 'vitest';
import { buildPatrol, LOBBY_STOPS, patrolFrame, PATROL_SPEED } from './lobbyPatrol';

describe('patrolFrame', () => {
  const patrol = buildPatrol(LOBBY_STOPS);

  it('has nobody at the spawn pad before the beam lights', () => {
    const frame = patrolFrame(patrol, 0.1);

    expect(frame.scale).toBe(0);
  });

  it('grows the newcomer in the beam on the pad, standing still', () => {
    const frame = patrolFrame(patrol, 0.8 + 0.6);

    expect(frame).toMatchObject({ x: 0, z: 0, moving: false });
    expect(frame.scale).toBeCloseTo(0.5);
  });

  it('walks at the demo speed to the first stop', () => {
    const [first] = LOBBY_STOPS;
    const walkStart = 0.8 + 1.2 + 1;
    const seconds = 2;

    const frame = patrolFrame(patrol, walkStart + seconds);

    expect(frame.moving).toBe(true);
    expect(Math.hypot(frame.x, frame.z)).toBeCloseTo(seconds * PATROL_SPEED);
    expect(frame.x / Math.hypot(frame.x, frame.z)).toBeCloseTo(first!.x / Math.hypot(first!.x, first!.z));
  });

  it('stands at each stop for a while', () => {
    const walkStart = 0.8 + 1.2 + 1;
    const [first] = LOBBY_STOPS;
    const arrived = walkStart + Math.hypot(first!.x, first!.z) / PATROL_SPEED;

    const frame = patrolFrame(patrol, arrived + 0.9);

    expect(frame).toMatchObject({ x: first!.x, z: first!.z, moving: false, scale: 1 });
  });

  it('ends back on the pad, shrinking into the light, then starts the same round again', () => {
    const end = patrol.length;

    const leaving = patrolFrame(patrol, end - 0.35);
    const again = patrolFrame(patrol, end + 0.1);

    expect(leaving).toMatchObject({ x: 0, z: 0, moving: false });
    expect(leaving.scale).toBeCloseTo(0.5);
    expect(again).toEqual(patrolFrame(patrol, 0.1));
  });
});
