/** A point of the lobby plaza in model units, the demo's, with the spawn pad at the origin. */
export interface LobbyPoint {
  x: number;
  z: number;
}

export type PatrolStage = 'wait' | 'spawn' | 'pause' | 'walk' | 'despawn';

export interface PatrolFrame extends LobbyPoint {
  stage: PatrolStage;
  /** How far through the current stage, from 0 to 1. */
  share: number;
  /** 0 while the character is not there, growing to 1 as it spawns and back down as it leaves. */
  scale: number;
  moving: boolean;
}

type Part = { kind: 'wait' | 'spawn' | 'pause' | 'despawn'; at: LobbyPoint; duration: number } | { kind: 'walk'; from: LobbyPoint; to: LobbyPoint; duration: number };

export interface Patrol {
  parts: Part[];
  length: number;
}

/** Walking speed in model units per second, the demo's. */
export const PATROL_SPEED = 7;
const WAIT = 0.8;
const SPAWN = 1.2;
const LOOK_AROUND = 1;
const LINGER = 1.8;
const DESPAWN = 0.7;
const ORIGIN: LobbyPoint = { x: 0, z: 0 };

/**
 * A newcomer's round of the lobby: it appears in the beam of the spawn pad, looks around, walks to
 * each stop and lingers, then walks back and vanishes into the light. The demo ended the round by
 * walking into a portal; the lobby no longer has portals, so the pad takes them back.
 */
export function buildPatrol(stops: LobbyPoint[]): Patrol {
  const parts: Part[] = [
    { kind: 'wait', at: ORIGIN, duration: WAIT },
    { kind: 'spawn', at: ORIGIN, duration: SPAWN },
    { kind: 'pause', at: ORIGIN, duration: LOOK_AROUND },
  ];
  let here = ORIGIN;
  for (const stop of [...stops, ORIGIN]) {
    parts.push({ kind: 'walk', from: here, to: stop, duration: Math.hypot(stop.x - here.x, stop.z - here.z) / PATROL_SPEED });
    if (stop !== ORIGIN) parts.push({ kind: 'pause', at: stop, duration: LINGER });
    here = stop;
  }
  parts.push({ kind: 'despawn', at: ORIGIN, duration: DESPAWN });
  return { parts, length: parts.reduce((total, part) => total + part.duration, 0) };
}

/** Where the character is `time` seconds into the endlessly repeating round. */
export function patrolFrame(patrol: Patrol, time: number): PatrolFrame {
  let left = ((time % patrol.length) + patrol.length) % patrol.length;
  for (const part of patrol.parts) {
    if (left >= part.duration) {
      left -= part.duration;
      continue;
    }
    const share = part.duration > 0 ? left / part.duration : 1;
    if (part.kind === 'walk') {
      return {
        x: part.from.x + (part.to.x - part.from.x) * share,
        z: part.from.z + (part.to.z - part.from.z) * share,
        scale: 1,
        moving: true,
        stage: 'walk',
        share,
      };
    }
    const scale = part.kind === 'wait' ? 0 : part.kind === 'spawn' ? share : part.kind === 'despawn' ? 1 - share : 1;
    return { ...part.at, scale, moving: false, stage: part.kind, share };
  }
  return { ...ORIGIN, scale: 0, moving: false, stage: 'wait', share: 0 };
}

/** Where to stand in front of the lobby's leaderboard, shop and two benches, in the demo's layout. */
export const LOBBY_STOPS: LobbyPoint[] = [
  { x: -15, z: -15 },
  { x: 20, z: -13 },
  { x: -11, z: 14 },
  { x: 11, z: 14 },
];
