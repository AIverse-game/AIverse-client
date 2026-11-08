import type { MapGridSpec } from '@aiverse/protocol';
import * as THREE from 'three';
import { createCharacter, type Character } from './characterModel';
import { createLobby, LOBBY_LIFT, lobbyGroundHeight, lobbyPlacement, type LobbyHandle, type LobbyPlacement } from './lobbyModel';
import { buildPatrol, LOBBY_STOPS, patrolFrame, type Patrol } from './lobbyPatrol';
import { walkPose, WALK_RATE } from './npcPose';

/** Map units tall a character is drawn, a resident and a newcomer alike. */
export const CHARACTER_SCALE = 0.065;

interface Newcomer {
  character: Character;
  patrol: Patrol;
  /** Seconds into its round at time zero, so the two newcomers are not in step. */
  offset: number;
  heading: number;
  height: number;
}

/**
 * The spawn lobby in the middle of the map, where residents are born, and the NPC newcomers who
 * walk its round. It is scenery: the server knows nothing of it and it takes no clicks.
 */
export class LobbyLandmark {
  private readonly scene: THREE.Scene;
  private handle: LobbyHandle | null = null;
  private placement: LobbyPlacement | null = null;
  private newcomers: Newcomer[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  build(map: MapGridSpec): void {
    this.dispose();
    const placement = (this.placement = lobbyPlacement(map));
    this.handle = createLobby();
    this.handle.root.position.set(placement.centre.x, LOBBY_LIFT, placement.centre.y);
    this.handle.root.scale.setScalar(placement.scale);
    this.scene.add(this.handle.root);
    const rounds = [LOBBY_STOPS, [...LOBBY_STOPS].reverse()];
    this.newcomers = rounds.map((stops, index) => {
      const patrol = buildPatrol(stops);
      const character = createCharacter(0xd85a30);
      character.root.scale.setScalar(CHARACTER_SCALE);
      character.root.visible = false;
      this.scene.add(character.root);
      return { character, patrol, offset: (index * patrol.length) / rounds.length, heading: 0, height: 0 };
    });
  }

  /** Height of the lobby floor under a map position, which is higher on the spawn pad, in map units. */
  groundHeight(x: number, y: number): number {
    const { placement } = this;
    if (!placement) return 0;
    const half = placement.scale * 30;
    if (Math.abs(x - placement.centre.x) > half || Math.abs(y - placement.centre.y) > half) return 0;
    const local = lobbyGroundHeight((x - placement.centre.x) / placement.scale, (y - placement.centre.y) / placement.scale);
    return LOBBY_LIFT + local * placement.scale;
  }

  update(time: number, dt: number): void {
    const { handle, placement } = this;
    if (!handle || !placement) return;
    handle.update(time, dt);
    let flash = 0;
    for (const newcomer of this.newcomers) {
      const at = time + newcomer.offset;
      const frame = patrolFrame(newcomer.patrol, at);
      const ahead = patrolFrame(newcomer.patrol, at + 0.05);
      const { character } = newcomer;
      if (frame.stage === 'walk' && (ahead.x !== frame.x || ahead.z !== frame.z)) newcomer.heading = Math.atan2(ahead.x - frame.x, ahead.z - frame.z);
      else if (frame.stage === 'pause' && frame.x === 0 && frame.z === 0) newcomer.heading = Math.sin(at * 2.5) * 0.5;
      const spin = frame.stage === 'spawn' ? (1 - frame.share) * Math.PI * 4 : 0;
      if (frame.stage === 'spawn') flash = Math.max(flash, Math.sin(frame.share * Math.PI));
      const x = placement.centre.x + frame.x * placement.scale, z = placement.centre.y + frame.z * placement.scale;
      const target = this.groundHeight(x, z);
      newcomer.height += (target - newcomer.height) * Math.min(1, dt * 14);
      character.root.visible = frame.scale > 0;
      character.root.position.set(x, newcomer.height, z);
      character.root.scale.setScalar(CHARACTER_SCALE * Math.max(frame.scale, 0.001));
      character.root.rotation.y = newcomer.heading + spin;
      character.setPose(walkPose(at * WALK_RATE, frame.moving));
    }
    handle.flashBeam(flash);
  }

  dispose(): void {
    if (this.handle) {
      this.scene.remove(this.handle.root);
      this.handle.dispose();
      this.handle = null;
    }
    for (const { character } of this.newcomers) {
      this.scene.remove(character.root);
      character.dispose();
    }
    this.newcomers = [];
  }
}
