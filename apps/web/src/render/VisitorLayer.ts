import * as THREE from 'three';
import type { VisitorSnapshot } from '../state/store';
import { CharacterCrowd } from './characterCrowd';
import { CHARACTER_SCALE } from './LobbyLandmark';
import { walkPose, WALK_RATE } from './npcPose';
import { catchUp, CATCH_UP_FACTOR, visitorPlace } from './visitorWalk';

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
  /** Where each visitor is drawn, which trails the server's position while it catches up after a message. */
  private readonly shown = new Map<number, { x: number; y: number }>();
  private lastUpdate: number | null = null;

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
      this.shown.clear();
      return;
    }
    const present = new Set(snapshot.visitors.map((visitor) => visitor.id));
    for (const id of this.headings.keys()) if (!present.has(id)) this.headings.delete(id);
    for (const id of this.shown.keys()) if (!present.has(id)) this.shown.delete(id);
    if (snapshot.visitors.length > this.capacity) this.rebuild(snapshot.visitors.length);
  }

  /** `now` is `performance.now()`. */
  update(now: number): void {
    const { crowd, snapshot } = this;
    if (!crowd || !snapshot) return;
    const seconds = (now - snapshot.receivedAt) / 1000;
    const step = snapshot.speed * CATCH_UP_FACTOR * Math.min(Math.max((now - (this.lastUpdate ?? now)) / 1000, 0), 0.1);
    this.lastUpdate = now;
    crowd.begin();
    for (const visitor of snapshot.visitors) {
      const target = visitorPlace(visitor, snapshot.speed, seconds);
      const before = this.shown.get(visitor.id);
      const at = before ? catchUp(before, target, step) : { x: target.x, y: target.y };
      this.shown.set(visitor.id, at);
      const place = { ...target, ...at, moving: target.moving || at.x !== target.x || at.y !== target.y };
      // With no legs left to face along, it faces the way it is catching up.
      const slid = before !== undefined && (at.x !== before.x || at.y !== before.y);
      const heading = target.heading ?? (slid ? Math.atan2(at.x - before.x, at.y - before.y) : null);
      if (heading !== null) this.headings.set(visitor.id, heading);
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
    this.shown.clear();
  }

  private rebuild(count: number): void {
    this.crowd?.dispose();
    this.capacity = Math.max(MIN_CAPACITY, count * 2);
    this.crowd = new CharacterCrowd(this.scene, COATS, this.capacity, CHARACTER_SCALE, SHADOW_RADIUS);
  }
}
