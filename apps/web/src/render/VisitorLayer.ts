import * as THREE from 'three';
import type { VisitorSnapshot } from '../state/store';
import { CharacterCrowd } from './characterCrowd';
import { CHARACTER_HEIGHT, CHARACTER_SCALE } from './LobbyLandmark';
import { walkPose, WALK_RATE } from './npcPose';
import { glitchFrame } from './portalGlitch';
import { ARRIVAL_GAP_MS, entryPose, newArrivals } from './visitorEntry';
import { catchUp, CATCH_UP_FACTOR, portalHop, visitorPlace, type LastDrawn, type PortalCrossing } from './visitorWalk';

/** Body colours visitors are given by id, muted so they read as passers-by next to the residents. */
const COATS = [0x5aa9e6, 0x7fc8a9, 0xf2c14e, 0xc792ea, 0xe08e79, 0x9aa5b1] as const;
const SHADOW_RADIUS = 0.7;
/** Figures of one coat the crowd holds before it is rebuilt larger. */
const MIN_CAPACITY = 64;
/** A visitor climbs onto or down from a plinth in about this many milliseconds, as a resident does, instead of jumping. */
const HEIGHT_TWEEN_MS = 70;
/** Frames further apart than this, in ms, were not drawn one after the other (a tab in the background): nobody is shown going through a portal then. */
const STEADY_MS = 500;

/** A spot on the map with the height of the floor there. */
export interface FloorSpot {
  x: number;
  y: number;
  height: number;
}

interface Hop {
  /** When it went through, on the `performance.now()` clock. */
  at: number;
  /** Where it was drawn when it went in, for the ghost it leaves there. */
  exit: FloorSpot;
  /** The way it faced going in, which the ghost keeps. */
  heading: number;
}

/**
 * The scripted visitors: block characters like the residents', walking the legs the server sent
 * them with. They are scenery to click through, with no names and no selection, so the whole crowd is
 * drawn as instances. A visitor stays where its last leg ends until the next message moves it on, and
 * is gone once a message leaves it out.
 *
 * A visitor that was not in the message before and is still near the entrance has just come into
 * town (`newArrivals`): it appears in the beam of the spawn pad at the entrance, see `entryPose`, then
 * walks out to where the server has it by now. The visitors of the first message, or of one that comes
 * long after the last one drawn, were already in town and are just there.
 *
 * A visitor that goes through a portal glitches across, see `glitchFrame`: it jumps to the far side
 * at once, shaking and dropping out for a moment, while a ghost of it twitches at the portal it went
 * into; `onPortal` is told both spots, for the torn slices laid over them. A visitor that a new
 * message puts too far off to have walked there went through a portal between messages, and glitches
 * from where it was drawn too, see `portalHop`.
 */
export class VisitorLayer {
  private crowd: CharacterCrowd | null = null;
  private capacity = 0;
  private snapshot: VisitorSnapshot | null = null;
  /** The way each visitor last faced, kept for when it stands still. */
  private readonly headings = new Map<number, number>();
  /** Where each visitor is drawn, which trails the server's position while it catches up after a message. */
  private readonly shown = new Map<number, { x: number; y: number }>();
  /** How high each visitor stands now, easing toward the floor under it. */
  private readonly heights = new Map<number, number>();
  /** When each visitor that has just come into town was first seen, on the `performance.now()` clock. */
  private readonly arrivals = new Map<number, number>();
  /** Visitors still walking out from the entrance, who walk however far behind they are instead of jumping. */
  private readonly entering = new Set<number>();
  /** Where visitors come into town: the middle of the map, on the lobby's spawn pad. */
  private entrance: { x: number; y: number } | null = null;
  /** Visitors who have just gone through a portal. */
  private readonly hops = new Map<number, Hop>();
  private beam = 0;
  /** Which way is sideways on screen, along the floor; visitors going through a portal shake along it. */
  private readonly sideways = new THREE.Vector3(1, 0, 0);
  private lastUpdate: number | null = null;
  /** The snapshot drawn last frame and how many seconds after it arrived, to tell what was passed since. */
  private drawn: { snapshot: VisitorSnapshot; seconds: number } | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    /** Height of the floor under a map position, which is higher on the lobby's spawn pad. */
    private readonly groundHeight: (x: number, y: number) => number,
    /** Told where a visitor went into a portal and where it came out, with the visitor's id. */
    private readonly onPortal: (exit: FloorSpot, entry: FloorSpot, id: number) => void = () => {},
  ) {}

  /** Sets where visitors come in, the middle of a map of side `size`. */
  setMapSize(size: number): void {
    this.entrance = { x: size / 2, y: size / 2 };
  }

  /** Starts playing a new snapshot; the same one again changes nothing. */
  sync(snapshot: VisitorSnapshot | null): void {
    if (snapshot === this.snapshot) return;
    const before = this.snapshot;
    this.snapshot = snapshot;
    if (!snapshot) {
      this.forget();
      return;
    }
    const present = new Set(snapshot.visitors.map((visitor) => visitor.id));
    for (const map of [this.headings, this.shown, this.heights, this.arrivals, this.hops]) {
      for (const id of map.keys()) if (!present.has(id)) map.delete(id);
    }
    for (const id of this.entering) if (!present.has(id)) this.entering.delete(id);
    if (this.entrance) {
      for (const id of newArrivals(before, snapshot, this.entrance)) {
        this.arrivals.set(id, snapshot.receivedAt);
        this.entering.add(id);
        this.shown.set(id, { ...this.entrance });
        this.heights.delete(id);
      }
    }
    if (snapshot.visitors.length > this.capacity) this.rebuild(snapshot.visitors.length);
  }

  /** How brightly the spawn beam is lit for the visitors coming in this frame, from 0 to 1. */
  entranceBeam(): number {
    return this.beam;
  }

  /** `now` is `performance.now()`; `camera` says which way is sideways on screen. */
  update(now: number, camera?: THREE.Camera): void {
    this.beam = 0;
    if (camera) {
      const e = camera.matrixWorld.elements;
      this.sideways.set(e[0]!, 0, e[2]!);
      if (this.sideways.lengthSq() < 1e-6) this.sideways.set(1, 0, 0);
      this.sideways.normalize();
    }
    const { crowd, snapshot } = this;
    if (!crowd || !snapshot) return;
    const seconds = (now - snapshot.receivedAt) / 1000;
    const steady = this.lastUpdate !== null && now - this.lastUpdate < STEADY_MS;
    const elapsed = Math.min(Math.max(now - (this.lastUpdate ?? now), 0), 100);
    const step = (snapshot.speed * CATCH_UP_FACTOR * elapsed) / 1000;
    const last: LastDrawn | null = !this.drawn ? null
      : this.drawn.snapshot === snapshot ? { sameMessage: true, seconds: this.drawn.seconds }
        : { sameMessage: false, messageGapMs: snapshot.receivedAt - this.drawn.snapshot.receivedAt };
    this.lastUpdate = now;
    this.drawn = { snapshot, seconds };
    crowd.begin();
    for (const visitor of snapshot.visitors) {
      const target = visitorPlace(visitor, snapshot.speed, seconds);
      const arrived = this.arrivals.get(visitor.id);
      const entry = arrived === undefined ? null : entryPose((now - arrived) / 1000);
      if (arrived !== undefined && !entry) this.arrivals.delete(visitor.id);
      const shownBefore = this.shown.get(visitor.id);
      const entering = this.entering.has(visitor.id);
      // One walking out from the entrance is left to walk; it does not glitch.
      const crossing = steady && !entering && shownBefore && last ? portalHop(visitor, snapshot.speed, shownBefore, last, seconds, ARRIVAL_GAP_MS) : null;
      if (crossing) this.hop(visitor.id, crossing, now);
      const before = crossing ? undefined : shownBefore;
      // While it appears it stays on the pad; then it walks out however far it has to.
      const at = entry && before ? before : before ? catchUp(before, target, step, entering ? Infinity : undefined) : { x: target.x, y: target.y };
      if (entering && !entry && at.x === target.x && at.y === target.y) this.entering.delete(visitor.id);
      this.shown.set(visitor.id, at);
      const place = { ...target, ...at, moving: !entry && (target.moving || at.x !== target.x || at.y !== target.y) };
      // With no legs left to face along, it faces the way it is catching up.
      const slid = before !== undefined && (at.x !== before.x || at.y !== before.y);
      // While it appears it turns to face where it will walk, once it has somewhere to go.
      const towards = entry && Math.hypot(target.x - at.x, target.y - at.y) > 0.01 ? Math.atan2(target.x - at.x, target.y - at.y) : null;
      const heading = towards ?? target.heading ?? (slid ? Math.atan2(at.x - before.x, at.y - before.y) : null);
      if (heading !== null) this.headings.set(visitor.id, heading);
      // Visitors are told apart by their own phase of the walk cycle, so they do not march in step.
      const phase = (now / 1000) * WALK_RATE + visitor.id * 1.7;
      const floor = this.groundHeight(place.x, place.y);
      const heightBefore = this.heights.get(visitor.id);
      const height = heightBefore === undefined ? floor : heightBefore + (floor - heightBefore) * Math.min(1, elapsed / HEIGHT_TWEEN_MS);
      this.heights.set(visitor.id, height);
      if (entry) this.beam = Math.max(this.beam, entry.beam);
      const yaw = this.headings.get(visitor.id) ?? 0;
      const hop = this.hops.get(visitor.id);
      const glitch = hop ? glitchFrame((now - hop.at) / 1000, visitor.id) : null;
      if (hop && !glitch) this.hops.delete(visitor.id);
      // Shaken left and right on screen, as the torn slices are; the ghost the other way.
      const shake = (glitch?.shake ?? 0) * CHARACTER_HEIGHT;
      const { x: sx, z: sz } = this.sideways;
      const coat = visitor.id % COATS.length;
      if (!glitch || glitch.shown) {
        crowd.add(
          coat, place.x + sx * shake, height, place.y + sz * shake,
          yaw + (entry?.spin ?? 0), walkPose(phase, place.moving), entry?.size ?? 1,
        );
      }
      if (hop && glitch?.ghost) {
        crowd.add(coat, hop.exit.x - sx * shake, hop.exit.height, hop.exit.y - sz * shake, hop.heading, walkPose(phase, false));
      }
    }
    crowd.end();
  }

  /** Puts a visitor through a portal: it is drawn on the far side straight away and glitches at both ends. */
  private hop(id: number, crossing: PortalCrossing, now: number): void {
    const spot = ({ x, y }: { x: number; y: number }): FloorSpot => ({ x, y, height: this.groundHeight(x, y) });
    const exit = { ...spot(crossing.exit), height: this.heights.get(id) ?? this.groundHeight(crossing.exit.x, crossing.exit.y) };
    this.hops.set(id, { at: now, exit, heading: this.headings.get(id) ?? 0 });
    this.heights.delete(id);
    this.onPortal(exit, spot(crossing.entry), id);
  }

  dispose(): void {
    this.crowd?.dispose();
    this.crowd = null;
    this.forget();
  }

  private forget(): void {
    this.headings.clear();
    this.shown.clear();
    this.heights.clear();
    this.arrivals.clear();
    this.entering.clear();
    this.hops.clear();
    this.drawn = null;
  }

  private rebuild(count: number): void {
    this.crowd?.dispose();
    this.capacity = Math.max(MIN_CAPACITY, count * 2);
    this.crowd = new CharacterCrowd(this.scene, COATS, this.capacity, CHARACTER_SCALE, SHADOW_RADIUS);
  }
}
