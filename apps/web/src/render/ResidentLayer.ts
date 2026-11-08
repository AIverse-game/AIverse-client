import type { Position, ResidentId, ResidentView } from '@aiverse/protocol';
import * as THREE from 'three';
import { createCharacter, type Character } from './characterModel';
import type { LabelLayer } from './LabelLayer';
import { CHARACTER_SCALE } from './LobbyLandmark';
import { walkPose, WALK_RATE } from './npcPose';
import { floatPose, stepFloat, type FloatState } from './residentFloat';

/** Residents who left the game stay on the map, faded. */
const LEFT_OPACITY = 0.35;
const MOVE_TWEEN_MS = 400;
/** Map units a resident bobs per unit of the float pose. */
const BOB = 0.025;
/** Where the name floats above the feet, in map units. */
const LABEL_HEIGHT = 32 * CHARACTER_SCALE + 0.35;
const SELECTION_COLOR = 0xfdf8ee;

/**
 * A walk the server reported, drawn from the wall clock rather than stepped per frame: the frame
 * rate must not change when the resident arrives.
 */
interface Walk {
  from: Position;
  to: Position;
  /** `performance.now()` when the walk was reported from `from`, and the milliseconds it takes. */
  start: number;
  duration: number;
}

interface Step {
  from: Position;
  to: Position;
  start: number;
}

interface Actor {
  id: ResidentId;
  root: THREE.Group;
  ground: THREE.Group;
  ring: THREE.Mesh;
  character: Character;
  target: THREE.Mesh;
  color: string;
  position: Position;
  shown: Position;
  walk: Walk | null;
  step: Step | null;
  float: FloatState;
  heading: number;
  height: number;
}

function labelText(view: ResidentView): string {
  return view.walking ? `${view.name} · 行走中` : view.name;
}

const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

/** The residents: block characters that bob, walk where the server says they walk and carry their names. */
export class ResidentLayer {
  private readonly root = new THREE.Group();
  private readonly actors = new Map<ResidentId, Actor>();
  private selected: ResidentId | null = null;

  constructor(
    scene: THREE.Scene,
    private readonly labels: LabelLayer,
    /** Height of the floor under a map position, which is higher on the lobby's spawn pad. */
    private readonly groundHeight: (x: number, y: number) => number,
  ) {
    scene.add(this.root);
  }

  sync(views: readonly ResidentView[], resized: boolean): void {
    const present = new Set<ResidentId>();
    for (const view of views) {
      present.add(view.id);
      const actor = this.actors.get(view.id);
      if (!actor) {
        const created = this.create(view);
        this.actors.set(view.id, created);
        this.startWalk(created, view);
        continue;
      }
      if (actor.color !== view.color) this.recolour(actor, view.color);
      actor.character.setOpacity(view.left ? LEFT_OPACITY : 1);
      this.labels.set(`r:${view.id}`, labelText(view), view.left ? 'resident left' : 'resident');
      const moved = actor.position.x !== view.position.x || actor.position.y !== view.position.y;
      actor.position = view.position;
      if (view.walking) {
        // Every snapshot restarts the walk from where the server says the resident is.
        actor.step = null;
        this.startWalk(actor, view);
        continue;
      }
      actor.walk = null;
      if (resized) {
        actor.step = null;
        actor.shown = { ...view.position };
      } else if (moved) {
        actor.step = { from: { ...actor.shown }, to: view.position, start: performance.now() };
      }
    }
    for (const [id, actor] of this.actors) {
      if (present.has(id)) continue;
      this.root.remove(actor.root);
      this.release(actor);
      this.labels.remove(`r:${id}`);
      this.actors.delete(id);
    }
  }

  setSelected(id: ResidentId | null): void {
    this.selected = id;
    for (const actor of this.actors.values()) actor.ring.visible = actor.id === id;
  }

  /** The invisible boxes to test a pointer ray against; each remembers its resident in `userData`. */
  targets(): THREE.Object3D[] {
    return [...this.actors.values()].map((actor) => actor.target);
  }

  /** `now` is `performance.now()` and `elapsed` the milliseconds since the last frame. */
  update(now: number, elapsed: number): void {
    for (const actor of this.actors.values()) {
      const moving = this.advance(actor, now);
      actor.float = stepFloat(actor.float, elapsed, moving);
      const pose = floatPose(actor.float);
      const target = this.groundHeight(actor.shown.x, actor.shown.y);
      actor.height += (target - actor.height) * Math.min(1, elapsed / 70);
      actor.root.position.set(actor.shown.x, actor.height, actor.shown.y);
      actor.character.root.position.y = pose.lift * BOB;
      actor.ground.scale.setScalar(Math.max(pose.shadow, 0.5));
      actor.character.root.rotation.y = actor.heading;
      actor.character.setPose(walkPose((now / 1000) * WALK_RATE, moving));
      this.labels.move(`r:${actor.id}`, actor.shown.x, actor.height + LABEL_HEIGHT, actor.shown.y);
    }
  }

  dispose(): void {
    for (const [id, actor] of this.actors) {
      this.release(actor);
      this.labels.remove(`r:${id}`);
    }
    this.actors.clear();
    this.root.removeFromParent();
  }

  private create(view: ResidentView): Actor {
    const root = new THREE.Group();
    const character = createCharacter(parseInt(view.color.slice(1), 16));
    character.root.scale.setScalar(CHARACTER_SCALE);
    character.setOpacity(view.left ? LEFT_OPACITY : 1);
    const ground = new THREE.Group();
    const disc = (radius: number, color: number, opacity: number, height: number) => {
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = height;
      return mesh;
    };
    ground.add(disc(0.9, 0x000000, 0.3, 0.04), disc(0.55, parseInt(view.color.slice(1), 16), 0.9, 0.05));
    const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.15, 32), new THREE.MeshBasicMaterial({ color: SELECTION_COLOR, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    ring.visible = view.id === this.selected;
    const target = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
    target.position.y = 1.3;
    target.userData = { residentId: view.id };
    root.add(character.root, ground, ring, target);
    this.root.add(root);
    this.labels.set(`r:${view.id}`, labelText(view), view.left ? 'resident left' : 'resident');
    return {
      id: view.id, root, ground, ring, character, target, color: view.color, position: view.position,
      shown: { ...view.position }, walk: null, step: null,
      // Residents start at different points of the bob, so they do not rise and fall together.
      float: { angle: Math.random() * 2 * Math.PI, effort: 0 }, heading: 0, height: this.groundHeight(view.position.x, view.position.y),
    };
  }

  /** Frees the character and the actor's own discs, ring and pick box. */
  private release(actor: Actor): void {
    actor.character.dispose();
    for (const part of [actor.ground, actor.ring, actor.target]) {
      part.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
      });
    }
  }

  private recolour(actor: Actor, color: string): void {
    const coat = parseInt(color.slice(1), 16);
    const position = actor.character.root.parent;
    actor.character.root.removeFromParent();
    actor.character.dispose();
    actor.character = createCharacter(coat);
    actor.character.root.scale.setScalar(CHARACTER_SCALE);
    position?.add(actor.character.root);
    const tint = actor.ground.children[1] as THREE.Mesh;
    (tint.material as THREE.MeshBasicMaterial).color.setHex(coat);
    actor.color = color;
  }

  private startWalk(actor: Actor, view: ResidentView): void {
    if (!view.walking) return;
    const { target, remainingSeconds } = view.walking;
    const start = performance.now();
    actor.walk = { from: { ...view.position }, to: target, start, duration: remainingSeconds * 1000 };
    this.advance(actor, start);
  }

  /** Puts the resident where it is by now and says whether it is on its way somewhere. */
  private advance(actor: Actor, now: number): boolean {
    const { walk, step } = actor;
    if (walk) {
      const share = walk.duration > 0 ? Math.min(Math.max((now - walk.start) / walk.duration, 0), 1) : 1;
      const { from, to } = walk;
      actor.shown = { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
      if (to.x !== from.x || to.y !== from.y) actor.heading = Math.atan2(to.x - from.x, to.y - from.y);
      return now < walk.start + walk.duration;
    }
    if (step) {
      const share = easeInOut(Math.min((now - step.start) / MOVE_TWEEN_MS, 1));
      actor.shown = { x: step.from.x + (step.to.x - step.from.x) * share, y: step.from.y + (step.to.y - step.from.y) * share };
      if (step.to.x !== step.from.x || step.to.y !== step.from.y) actor.heading = Math.atan2(step.to.x - step.from.x, step.to.y - step.from.y);
      if (now - step.start >= MOVE_TWEEN_MS) actor.step = null;
      return now - step.start < MOVE_TWEEN_MS;
    }
    return false;
  }
}
