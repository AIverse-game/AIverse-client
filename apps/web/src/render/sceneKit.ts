import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Colours of the neon scene, taken from the materials of the demo models. */
export const PALETTE = {
  floor: 0x4a3e6e,
  base: 0x3b3157,
  dark: 0x2e2645,
  rim: 0x4d4175,
  pillar: 0x433865,
  desk: 0x5a4a86,
  furn: 0x2f2a45,
  counter: 0x433865,
  wall: 0x463a6a,
  chair: 0x993556,
  chair2: 0x534ab7,
  carpet: 0x3c3489,
  rug: 0x56407a,
  sofa: 0x534ab7,
  pillow: 0xd4537e,
  pot: 0x8a4a2e,
  mug: 0xd4537e,
  mugB: 0x1d9e75,
  board: 0xcfc9e8,
  trunk: 0x633806,
  leafA: 0x3b6d11,
  leafB: 0x639922,
  pinkA: 0xd4537e,
  pinkB: 0x993556,
  robot: 0xb4b2a9,
  awnA: 0xd4537e,
  awnB: 0x534ab7,
  screen: 0x120f26,
  cyan: 0x22e5f0,
  pink: 0xe05bf0,
  amber: 0xffc24a,
  violet: 0x7f77dd,
} as const;

// The demos were written for Three.js r128, which neither converted colours nor used physical light
// units. Matching its output keeps their colours as authored.
THREE.ColorManagement.enabled = false;
/** r128 treated light intensities as if multiplied by pi; newer releases do not. */
export const LIGHT_SCALE = Math.PI;

const lambert = new Map<number, THREE.MeshLambertMaterial>();
const basic = new Map<number, THREE.MeshBasicMaterial>();

/** Shared lit material of a colour; models share them, so they are never disposed with a model. */
export function lam(color: number): THREE.MeshLambertMaterial {
  let material = lambert.get(color);
  if (!material) lambert.set(color, (material = new THREE.MeshLambertMaterial({ color })));
  return material;
}

/** Shared unlit material, for lights, screens and neon. */
export function glow(color: number): THREE.MeshBasicMaterial {
  let material = basic.get(color);
  if (!material) basic.set(color, (material = new THREE.MeshBasicMaterial({ color })));
  return material;
}

export function glassMaterial(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
}

/** A small pixel texture drawn with 2D canvas calls, sampled without smoothing like the demos'. */
export function canvasTex(width: number, height: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

/** A deterministic generator in (0, 1), so models look the same every time they are built. */
export function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

/** What the map keeps of a model: its root, a per-frame animation and the cleanup. */
export interface ModelHandle {
  root: THREE.Object3D;
  /** `time` is seconds on a steady clock, `dt` the seconds since the last frame. */
  update(time: number, dt: number): void;
  dispose(): void;
}

/**
 * Builds a model the way the demos do, with centred boxes and groups, but merges the boxes by
 * material so a room of furniture costs a few draw calls. Anything that animates or needs its own
 * material goes in with `add`.
 */
export class ModelBuilder {
  readonly root = new THREE.Group();
  private readonly frames: THREE.Matrix4[] = [new THREE.Matrix4()];
  private readonly batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private readonly owned: Array<{ dispose(): void }> = [];
  private readonly parts: ModelBuilder[] = [];

  /** A part in its own frame, like a Three.js group: moved by (x, y, z), turned about y. */
  group(x: number, y: number, z: number, ry: number, build: () => void): void {
    const frame = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    this.frames.push(this.frame().clone().multiply(frame));
    build();
    this.frames.pop();
  }

  box(w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number): void {
    this.geometry(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  }

  /** An eight-sided column like the demos' round pads; the bottom radius is the first. */
  cylinder(bottom: number, top: number, h: number, material: THREE.Material, x: number, y: number, z: number): void {
    this.geometry(new THREE.CylinderGeometry(top, bottom, h, 8), material, x, y, z);
  }

  /** An object that is not merged, such as something that moves; its position is in the current group. */
  add<T extends THREE.Object3D>(object: T, x = object.position.x, y = object.position.y, z = object.position.z): T {
    object.position.set(x, y, z);
    object.updateMatrix();
    object.applyMatrix4(this.frame());
    this.root.add(object);
    return object;
  }

  /** A part built apart, such as a board that bobs, placed in the current group and released with this model. */
  attach(part: ModelBuilder, x: number, y: number, z: number, ry = 0): THREE.Object3D {
    this.parts.push(part);
    const root = part.finish();
    root.rotation.y = ry;
    return this.add(root, x, y, z);
  }

  /** Releases a texture or geometry along with the model. */
  own<T extends { dispose(): void }>(resource: T): T {
    this.owned.push(resource);
    return resource;
  }

  /** Merges the boxes into a few meshes and returns the finished root. */
  finish(): THREE.Group {
    for (const [material, geometries] of this.batches) {
      const merged = mergeGeometries(geometries, false);
      for (const geometry of geometries) geometry.dispose();
      if (!merged) continue;
      this.owned.push(merged);
      this.root.add(new THREE.Mesh(merged, material));
    }
    this.batches.clear();
    return this.root;
  }

  disposeAll(): void {
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh && !this.owned.includes(object.geometry)) object.geometry.dispose();
    });
    for (const resource of this.owned) resource.dispose();
    for (const part of this.parts) part.disposeAll();
  }

  private frame(): THREE.Matrix4 {
    return this.frames[this.frames.length - 1]!;
  }

  private geometry(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): void {
    geometry.applyMatrix4(this.frame().clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z)));
    const batch = this.batches.get(material);
    if (batch) batch.push(geometry);
    else this.batches.set(material, [geometry]);
  }
}

let floorTexture: THREE.CanvasTexture | null = null;

/** The tiled plinth every demo stands on: sides in `side`, the paving on top, `thickness` tall with its top at y = 0. */
export function floorPlate(size: number, thickness: number, side: number = PALETTE.base): { mesh: THREE.Mesh; dispose(): void } {
  floorTexture ??= canvasTex(32, 32, (g) => {
    g.fillStyle = '#4a3e6e'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#3a3058'; g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32);
  });
  const paving = floorTexture.clone();
  paving.needsUpdate = true;
  paving.wrapS = paving.wrapT = THREE.RepeatWrapping;
  paving.repeat.set(size * 0.3, size * 0.3);
  const top = new THREE.MeshLambertMaterial({ map: paving });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, thickness, size), [lam(side), lam(side), top, lam(PALETTE.dark), lam(side), lam(side)]);
  mesh.position.y = -thickness / 2;
  return { mesh, dispose: () => { mesh.geometry.dispose(); top.dispose(); paving.dispose(); } };
}
