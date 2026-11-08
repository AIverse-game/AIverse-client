import * as THREE from 'three';
import type { VisitorSnapshot } from '../state/store';
import { CharacterCrowd } from './characterCrowd';
import { CHARACTER_SCALE } from './LobbyLandmark';
import { walkPose, WALK_RATE } from './npcPose';
import { visitorPlace } from './visitorWalk';

/** Body colours visitors are given by id, muted so they read as passers-by next to the residents. */
const COATS = [0x5aa9e6, 0x7fc8a9, 0xf2c14e, 0xc792ea, 0xe08e79, 0x9aa5b1] as const;
const SHADOW_RADIUS = 0.7;
/** Figures of one coat the crowd holds before it is rebuilt larger. */
const MIN_CAPACITY = 64;

/**
 * The scripted visitors: block characters like the residents', walking the legs the server sent
 * them with. They are scenery to click through, with no names and no selection, so the whole crowd is
 * drawn as instances. A visitor stays where its last leg ends until the next message moves it on, and
 * is gone once a message leaves it out.
 */
export class VisitorLayer {
  private crowd: CharacterCrowd | null = null;
  private capacity = 0;
  private snapshot: VisitorSnapshot | null = null;
  /** The way each visitor last faced, kept for when it stands still. */
  private readonly headings = new Map<number, number>();

  constructor(
    private readonly scene: THREE.Scene,
    /** Height of the floor under a map position, which is higher on the lobby's spawn pad. */
    private readonly groundHeight: (x: number, y: number) => number,
  ) {}

  /** Starts playing a new snapshot; the same one again changes nothing. */
  sync(snapshot: VisitorSnapshot | null): void {
    if (snapshot === this.snapshot) return;
    this.snapshot = snapshot;
    if (!snapshot) {
      this.headings.clear();
      return;
    }
    const present = new Set(snapshot.visitors.map((visitor) => visitor.id));
    for (const id of this.headings.keys()) if (!present.has(id)) this.headings.delete(id);
    if (snapshot.visitors.length > this.capacity) this.rebuild(snapshot.visitors.length);
  }

  /** `now` is `performance.now()`. */
  update(now: number): void {
    const { crowd, snapshot } = this;
    if (!crowd || !snapshot) return;
    const seconds = (now - snapshot.receivedAt) / 1000;
    crowd.begin();
    for (const visitor of snapshot.visitors) {
      const place = visitorPlace(visitor, snapshot.speed, seconds);
      if (place.heading !== null) this.headings.set(visitor.id, place.heading);
      // Visitors are told apart by their own phase of the walk cycle, so they do not march in step.
      const phase = (now / 1000) * WALK_RATE + visitor.id * 1.7;
      crowd.add(
        visitor.id % COATS.length, place.x, this.groundHeight(place.x, place.y), place.y,
        this.headings.get(visitor.id) ?? 0, walkPose(phase, place.moving),
      );
    }
    crowd.end();
  }

  dispose(): void {
    this.crowd?.dispose();
    this.crowd = null;
    this.headings.clear();
  }

  private rebuild(count: number): void {
    this.crowd?.dispose();
    this.capacity = Math.max(MIN_CAPACITY, count * 2);
    this.crowd = new CharacterCrowd(this.scene, COATS, this.capacity, CHARACTER_SCALE, SHADOW_RADIUS);
  }
}
