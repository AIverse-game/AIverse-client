import * as THREE from 'three';
import { ModelBuilder, seeded, type ModelHandle } from '../sceneKit';
import type { GardenMaterials } from './GardenMaterials';

/** Width and length of the garden, the height of its slab and of its tallest point (the tree), in model units; the demo's 32-unit garden. */
export const GARDEN_SPAN = 32;
export const GARDEN_SLAB = 1.2;
export const GARDEN_TOP = 11;
/** Widest the garden is drawn, in map units: its 10-wide land less the 2 an island may take from one side and a margin, so it is the same size wherever it stands. */
export const GARDEN_WIDTH_CAP = 7.2;

const S = GARDEN_SPAN;
/** The hedge runs round the garden at this distance from its middle. */
const E = 15;
/** Where the pond, the tree and the daisy patch are centred, and the pergola. */
const PX = -8, PZ = -7;
const TX = 8, TZ = -8;
const RX = 9, RZ = 11;
const PERGOLA = { x: 10, z: 3 };

/** Instances of each moving part. */
const DROPS = 14, KOI = 3, BUTTERFLIES = 4, PETALS = 16, FIREFLIES = 26, PADS = 4;
const CAT_PARTS = 3;
const CRITTERS = DROPS + KOI * 3 + BUTTERFLIES * 5 + CAT_PARTS;

/** Radius of the pool of light under a lantern; the lanterns nearest the edge are kept so that it stays on the slab. */
const POOL_RADIUS = 3.6;

const TWO_PI = Math.PI * 2;

/**
 * Builds shapes the way `ModelBuilder` does and gives every vertex drawn with a swaying material the
 * wind's two numbers: the plant's phase, and how far the vertex is above where the plant is rooted.
 * Vertices of the parts that do not sway get zeros, so all of a material's geometry can be merged.
 */
class Planter {
  readonly b = new ModelBuilder();
  private sway: { phase: number; pivot: number } | null = null;

  constructor(private readonly materials: GardenMaterials) {}

  /** The plant built by `build` is rooted `pivot` high, in the units the parts' heights are in, and moves with `phase`. */
  rooted(phase: number, pivot: number, build: () => void): void {
    this.sway = { phase, pivot };
    build();
    this.sway = null;
  }

  box(w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number): void {
    this.put(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  }

  /** A box moved by `offset` and then turned about x, as a part of a group that is itself turned. */
  tilted(w: number, h: number, d: number, material: THREE.Material, rx: number, offset: [number, number, number], x: number, y: number, z: number): void {
    this.put(new THREE.BoxGeometry(w, h, d).translate(...offset).rotateX(rx), material, x, y, z);
  }

  /** A box turned about z through its own middle, as a spout or a branch is. */
  leaning(w: number, h: number, d: number, material: THREE.Material, rz: number, x: number, y: number, z: number): void {
    this.put(new THREE.BoxGeometry(w, h, d).rotateZ(rz), material, x, y, z);
  }

  cylinder(top: number, bottom: number, h: number, segments: number, material: THREE.Material, x: number, y: number, z: number): void {
    this.put(new THREE.CylinderGeometry(top, bottom, h, segments), material, x, y, z);
  }

  /** A flat disc, an ellipse when the two radii differ. */
  disc(radiusX: number, segments: number, material: THREE.Material, x: number, y: number, z: number, radiusZ = radiusX): void {
    this.put(new THREE.CircleGeometry(1, segments).rotateX(-Math.PI / 2).scale(radiusX, 1, radiusZ), material, x, y, z);
  }

  /** A flat square facing up. */
  plane(side: number, material: THREE.Material, y: number): void {
    this.put(new THREE.PlaneGeometry(side, side).rotateX(-Math.PI / 2), material, 0, y, 0);
  }

  ring(radius: number, tube: number, material: THREE.Material, x: number, y: number, z: number): void {
    this.put(new THREE.TorusGeometry(radius, tube, 4, 12).rotateX(-Math.PI / 2), material, x, y, z);
  }

  private put(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): void {
    if (this.materials.isSwaying(material)) {
      const position = geometry.getAttribute('position');
      const sway = new Float32Array(position.count * 2);
      if (this.sway) {
        for (let i = 0; i < position.count; i++) {
          sway[i * 2] = this.sway.phase;
          sway[i * 2 + 1] = Math.abs(position.getY(i) + y - this.sway.pivot);
        }
      }
      geometry.setAttribute('aSway', new THREE.BufferAttribute(sway, 2));
    }
    this.b.shape(geometry, material, x, y, z);
  }
}

type Flower = 'tulip' | 'daisy' | 'lavender' | 'sunflower';

const scratch = { b: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), e: new THREE.Euler() };

/** `parent` moved by (x, y, z), turned by `rotation` (x, y, z) and scaled to `size`, put into `target`; a part of a moving group of the demo. */
function place(target: THREE.Matrix4, parent: THREE.Matrix4, x: number, y: number, z: number, size: [number, number, number] = [1, 1, 1], rotation: [number, number, number] = [0, 0, 0]): THREE.Matrix4 {
  scratch.q.setFromEuler(scratch.e.set(...rotation));
  scratch.b.compose(scratch.v.set(x, y, z), scratch.q, scratch.s.set(...size));
  return target.multiplyMatrices(parent, scratch.b);
}

const IDENTITY = new THREE.Matrix4();

/** A frame moved by (x, y, z) and turned about y inside `parent`, like a group of the demo. */
function frame(x: number, y: number, z: number, ry = 0, parent: THREE.Matrix4 = IDENTITY): THREE.Matrix4 {
  return place(new THREE.Matrix4(), parent, x, y, z, [1, 1, 1], [0, ry, 0]);
}

/** A mesh of a unit box or other geometry, many times over, each with its own matrix and colour; it moves too much to be culled by its bounds. */
function instances(root: ModelBuilder, geometry: THREE.BufferGeometry, material: THREE.Material, count: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  root.own(geometry);
  root.add(mesh, 0, 0, 0);
  return mesh;
}

/**
 * The small garden of `demos/voxel_floating_garden.html` on one parcel: a hedge round it with a flower
 * arch for a gate, a fountain, a koi pond, a blossom tree, a pergola with a sleeping cat, flower beds,
 * lanterns, butterflies and fireflies. Built once, whatever the season or the time of day: colours
 * come from the shared `materials`, which are recoloured and dimmed from outside, and nothing here
 * knows either. The still parts are merged by material; what moves is drawn with a few instanced
 * meshes, and the wind that bends the plants is done by their material, so a garden costs a few dozen
 * draw calls however much of it moves. The gate faces south, +z, and the slab's top is y = 0.
 */
export function createGarden(materials: GardenMaterials): ModelHandle {
  const p = new Planter(materials);
  const { b } = p;
  const m = (role: string) => materials.lit(role);
  const random = seeded(11);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const poolsAt: Array<[number, number, number]> = [];

  // The slab: dirt below, a thin grass edge, the grass pixels on top, and a rim of light at the foot.
  p.box(S, GARDEN_SLAB - 0.4, S, m('dirt'), 0, -(GARDEN_SLAB + 0.4) / 2, 0);
  p.box(S, 0.4, S, m('grassEdge'), 0, -0.202, 0);
  p.plane(S, m('grass'), 0);
  p.box(S + 0.3, 0.16, S + 0.3, materials.rim, 0, -GARDEN_SLAB + 0.08, 0);

  // The hedge, open on the south for the gate, and a stone lantern pillar at each corner.
  let hedges = 0;
  const hedge = (x: number, z: number) => {
    const h = 1.8 + ((hedges * 7) % 3) * 0.25;
    p.box(2, h, 2, m(hedges % 2 ? 'hedge' : 'hedge2'), x, h / 2, z);
    hedges++;
  };
  for (let x = -13; x <= 13; x += 2) {
    hedge(x, -E);
    if (Math.abs(x) >= 5) hedge(x, E);
  }
  for (let z = -13; z <= 13; z += 2) { hedge(-E, z); hedge(E, z); }
  for (const [x, z] of [[-E, -E], [E, -E], [-E, E], [E, E]] as const) {
    p.box(2.2, 2.8, 2.2, m('stone'), x, 1.4, z);
    p.box(2.6, 0.4, 2.6, m('stone2'), x, 3, z);
    p.box(0.8, 0.8, 0.8, materials.lantern, x, 3.6, z);
    poolsAt.push([x - Math.sign(x) * 1.8, z - Math.sign(z) * 1.8, POOL_RADIUS - 0.8]);
  }

  // The gate: two white posts and an arch of blocks, with flowers and leaves climbing it.
  b.group(0, 0, E, 0, () => {
    for (const x of [-3.2, 3.2]) {
      p.box(0.8, 6, 0.8, m('white'), x, 3, 0);
      p.box(1.1, 0.4, 1.1, m('stone2'), x, 0.2, 0);
    }
    for (let k = 0; k <= 12; k++) {
      const a = (Math.PI * k) / 12, x = Math.cos(a) * 3.2, y = 6 + Math.sin(a) * 2.2;
      p.box(0.8, 0.8, 0.8, m('white'), x, y, 0);
      for (let i = 0; i < 2; i++) {
        const s = 0.35 + random() * 0.3;
        p.box(s, s, s, random() < 0.35 ? m('leaf') : m(`arch${Math.floor(random() * 3)}`), x + (random() - 0.5) * 1.1, y + (random() - 0.3) * 0.9, (random() - 0.5) * 1.1);
      }
    }
    for (let y = 1; y < 6; y += 0.9) {
      for (const x of [-3.2, 3.2]) {
        const s = 0.35 + random() * 0.25;
        p.box(s, s, s, random() < 0.6 ? m('leaf') : m(`arch${Math.floor(random() * 3)}`), x + (random() - 0.5) * 0.9, y, (random() - 0.5) * 0.9);
      }
    }
  });

  // Stepping stones from the gate to the fountain, round it, and on towards the pergola.
  const stepping = (x: number, z: number, size: number) => {
    b.group(x, 0, z, (random() - 0.5) * 0.5, () => p.box(size, 0.18, size, random() < 0.5 ? m('stone') : m('stone2'), 0, 0.09, 0));
  };
  for (let z = 14.6; z >= 4.6; z -= 1.9) stepping((random() - 0.5) * 0.5, z, 1.6);
  for (let k = 0; k < 12; k++) stepping(Math.cos((k / 12) * TWO_PI) * 3.4, Math.sin((k / 12) * TWO_PI) * 3.4, 1.4);
  stepping(4.9, 1.1, 1.4);
  stepping(6.2, 2.4, 1.4);

  // The fountain; its drops are among the moving parts below.
  p.cylinder(2.3, 2.5, 0.7, 12, m('stone'), 0, 0.35, 0);
  p.ring(2.2, 0.25, m('stone2'), 0, 0.75, 0);
  p.disc(2, 12, m('water'), 0, 0.72, 0);
  p.cylinder(0.35, 0.5, 2.2, 8, m('stone2'), 0, 1.8, 0);
  p.cylinder(1, 0.6, 0.5, 10, m('stone'), 0, 3, 0);
  p.disc(0.85, 10, m('water'), 0, 3.26, 0);
  p.box(0.25, 0.6, 0.25, m('stone2'), 0, 3.5, 0);

  // The koi pond: a ring of stones, a dark bed and the water over it, 4.9 by 3.5; fish and lily pads are among the moving parts.
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TWO_PI;
    b.group(PX + Math.cos(a) * 5.3, 0, PZ + Math.sin(a) * 3.9, -a + (random() - 0.5) * 0.3, () => p.box(1.7, 0.6, 1.7, k % 2 ? m('stone') : m('stone2'), 0, 0.3, 0));
  }
  p.disc(4.9, 24, m('pondBed'), PX, 0.04, PZ, 3.5);
  p.disc(4.9, 24, m('pondWater'), PX, 0.42, PZ, 3.5);

  // Reeds with cattails behind the pond, and three rocks.
  for (let i = 0; i < 7; i++) {
    const x = -13 + random() * 2.6, z = -11.8 + random() * 1.6, h = 2 + random() * 1.4;
    p.box(0.18, h, 0.18, m('stem'), x, h / 2, z);
    if (i % 2 === 0) p.box(0.3, 0.7, 0.3, m('wood2'), x, h + 0.2, z);
  }
  [[-3, -9.6], [-12.6, -4.2], [-3.2, -4.4]].forEach(([x, z], i) => p.box(0.9 + i * 0.2, 0.7, 0.8, m('rock'), x!, 0.35, z!));

  // The blossom tree, the petals on the ground under it and three stools.
  p.box(1.4, 5.5, 1.4, m('wood'), TX, 2.75, TZ);
  p.leaning(0.7, 3, 0.7, m('wood'), 0.6, TX - 1.2, 5.6, TZ + 0.4);
  p.leaning(0.7, 3, 0.7, m('wood'), -0.55, TX + 1.3, 5.8, TZ - 0.3);
  for (const [x, y, z, s] of [[0, 7.6, 0, 4.4], [-2.4, 7, 0.6, 3], [2.4, 7.2, -0.4, 3.2], [0.4, 9.4, 0, 3], [-1, 8.6, -1.6, 2.4], [1.4, 8.4, 1.6, 2.4], [-2.8, 6.2, -1.4, 1.8], [2.8, 6.4, 1.6, 1.8]] as const) {
    p.box(s, s, s, m(`canopy${Math.floor(random() * 3)}`), TX + x, y, TZ + z);
  }
  for (let i = 0; i < 18; i++) {
    const a = random() * TWO_PI, r = 1 + random() * 4.5;
    b.group(TX + Math.cos(a) * r, 0, TZ + Math.sin(a) * r, random() * 3, () => p.box(0.3, 0.05, 0.3, m('petal'), 0, 0.03, 0));
  }
  [[TX - 2.6, TZ + 3], [TX + 3.2, TZ + 2.2], [TX - 3.4, TZ - 2.6]].forEach(([x, z], i) => {
    p.box(0.2, 0.5, 0.2, m('white'), x!, 0.25, z!);
    p.box(0.6, 0.25, 0.6, m(i === 1 ? 'stoolGold' : 'stoolRed'), x!, 0.6, z!);
  });

  // A flower of the demo, rooted at `y0` and swaying with the wind.
  const flower = (x: number, y0: number, z: number, h: number, type: Flower, color: THREE.Material) => {
    p.rooted(x * 0.7 + z * 0.3, y0, () => {
      p.box(0.14, h, 0.14, m('stem'), x, y0 + h / 2, z);
      p.box(0.5, 0.1, 0.22, m('stem'), x + 0.22, y0 + h * 0.45, z);
      const top = y0 + h;
      if (type === 'tulip') {
        p.box(0.5, 0.55, 0.5, color, x, top + 0.2, z);
        p.box(0.2, 0.3, 0.2, color, x - 0.18, top + 0.55, z);
        p.box(0.2, 0.3, 0.2, color, x + 0.18, top + 0.55, z);
      } else if (type === 'daisy') {
        p.box(0.8, 0.1, 0.25, m('white'), x, top, z);
        p.box(0.25, 0.1, 0.8, m('white'), x, top, z);
        p.box(0.3, 0.15, 0.3, m('yellow'), x, top + 0.05, z);
      } else if (type === 'lavender') {
        for (let k = 0; k < 4; k++) p.box(0.22, 0.22, 0.22, color, x, top - 0.2 + k * 0.24, z);
      } else {
        p.tilted(1.5, 1.5, 0.15, m('yellow'), -0.25, [0, 0, 0], x, top, z + 0.1);
        p.tilted(0.7, 0.7, 0.2, m('wood2'), -0.25, [0, 0, 0.05], x, top, z + 0.1);
        p.box(0.7, 0.12, 0.4, m('stem'), x - 0.3, y0 + h * 0.6, z);
      }
    });
  };

  // The tulip bed with a watering can beside it.
  b.group(-9, 0, 9, 0, () => {
    p.box(8.4, 0.9, 4.4, m('wood'), 0, 0.45, 0);
    p.box(7.8, 0.1, 3.8, m('soil'), 0, 0.92, 0);
    for (let x = -3.6; x <= 3.7; x += 0.5) p.box(0.12, 0.12, 4.5, m('wood2'), x, 0.5, 0);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 7; c++) flower(-3.3 + c * 1.1, 0.95, -1.2 + r * 1.2, 1.2 + random() * 0.4, 'tulip', m(`bed${(c + r * 2) % 5}`));
    }
  });
  b.group(-3.8, 0, 10.6, 0.4, () => {
    p.box(1, 0.9, 0.7, m('canBlue'), 0, 0.45, 0);
    p.leaning(0.2, 0.2, 0.9, m('canBlue'), 0.6, 0.65, 0.7, 0);
    p.box(0.12, 0.5, 0.6, m('canDark'), -0.5, 1, 0);
  });

  // The sunflower bed at the back.
  b.group(1, 0, -12.3, 0, () => {
    p.box(6.4, 0.8, 2, m('wood'), 0, 0.4, 0);
    p.box(6, 0.1, 1.6, m('soil'), 0, 0.82, 0);
    [-2.2, -0.7, 0.8, 2.3].forEach((x, i) => flower(x, 0.85, 0, 3.4 + ((i * 3) % 4) * 0.4, 'sunflower', m('yellow')));
  });

  // The daisy and lavender patch inside a ring of stones.
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TWO_PI;
    b.group(RX + Math.cos(a) * 2.7, 0, RZ + Math.sin(a) * 2.7, -a, () => p.box(1, 0.45, 1, k % 2 ? m('stone') : m('stone2'), 0, 0.22, 0));
  }
  p.cylinder(2.4, 2.4, 0.3, 14, m('soil'), RX, 0.15, RZ);
  for (let i = 0; i < 16; i++) {
    const a = random() * TWO_PI, r = random() * 2;
    const lavender = i % 3 === 0;
    flower(RX + Math.cos(a) * r, 0, RZ + Math.sin(a) * r, lavender ? 1.6 + random() * 0.5 : 0.9 + random() * 0.4, lavender ? 'lavender' : 'daisy', m('lavender'));
  }

  // The pergola: four white posts with vines, two beams, slats, wisteria hanging from them, a bench and the cat.
  const pergola = frame(PERGOLA.x, 0, PERGOLA.z);
  const benchFrame = frame(1.4, 0, 0, Math.PI / 2, pergola);
  const catFrame = frame(-0.6, 1.22, -0.05, 0, benchFrame);
  b.group(PERGOLA.x, 0, PERGOLA.z, 0, () => {
    for (const [x, z] of [[-3, -4], [-3, 4], [3, -4], [3, 4]] as const) {
      p.box(0.6, 6, 0.6, m('white'), x, 3, z);
      for (let y = 0.6; y < 5.6; y += 0.8) {
        const s = 0.3 + random() * 0.2;
        p.box(s, s, s, m('leaf'), x + (random() - 0.5) * 0.7, y, z + (random() - 0.5) * 0.7);
      }
    }
    for (const x of [-3, 3]) p.box(0.6, 0.5, 9.2, m('white'), x, 6.25, 0);
    for (let z = -4; z <= 4.01; z += 1.15) {
      p.box(7.2, 0.3, 0.35, m('white'), 0, 6.65, z);
      for (let k = 0; k < 3; k++) {
        const x = -2.4 + k * 2.4 + (random() - 0.5) * 0.8;
        const length = 3 + Math.floor(random() * 2);
        p.rooted(random() * 6, 6.5, () => {
          for (let j = 0; j < length; j++) {
            const s = 0.55 - j * 0.1;
            p.box(s, 0.45, s, m(`wisteria${j % 3}`), x, 6.5 - 0.3 - j * 0.42, z);
          }
          p.box(0.6, 0.25, 0.6, m('leaf'), x, 6.55, z);
        });
      }
    }
    b.group(1.4, 0, 0, Math.PI / 2, () => {
      p.box(4, 0.35, 1.3, m('wood'), 0, 1.05, 0);
      p.box(4, 1.2, 0.25, m('wood'), 0, 1.9, 0.55);
      p.box(4.1, 0.2, 0.3, m('wood2'), 0, 2.55, 0.55);
      for (const x of [-1.7, 1.7]) {
        p.box(0.3, 0.9, 1.2, m('wood2'), x, 0.45, 0);
        p.box(0.25, 0.25, 1.2, m('wood2'), x, 1.55, 0);
      }
      b.group(-0.6, 1.22, -0.05, 0, () => {
        p.box(0.55, 0.48, 0.55, m('fur'), 0.75, 0.3, 0.05);
        p.box(0.3, 0.2, 0.08, m('fur2'), 0.95, 0.2, 0.33);
        p.box(0.14, 0.18, 0.14, m('fur'), 0.62, 0.62, -0.12);
        p.box(0.14, 0.18, 0.14, m('fur'), 0.62, 0.62, 0.22);
        p.box(0.12, 0.04, 0.06, m('dark'), 1.03, 0.36, -0.08);
        p.box(0.12, 0.04, 0.06, m('dark'), 1.03, 0.36, 0.18);
        for (let k = 0; k < 3; k++) p.box(0.12, 0.5, 0.76, m('fur2'), -0.35 + k * 0.3, 0.26, 0);
      });
    });
  });

  // Six stone lanterns along the paths.
  for (const [x, z] of [[-1.9, 12.4], [1.9, 12.4], [-1.9, 6.4], [1.9, 6.4], [-3.2, -5.6], [6.6, -1.4]] as const) {
    p.box(1, 0.4, 1, m('stone2'), x, 0.2, z);
    p.box(0.45, 1.6, 0.45, m('stone'), x, 1.2, z);
    p.box(1.1, 1.1, 1.1, m('stone'), x, 2.55, z);
    p.box(0.8, 0.7, 1.14, materials.lantern, x, 2.55, z);
    p.box(1.14, 0.7, 0.8, materials.lantern, x, 2.55, z);
    p.box(1.6, 0.35, 1.6, m('stone2'), x, 3.25, z);
    p.box(0.4, 0.3, 0.4, m('stone2'), x, 3.55, z);
    poolsAt.push([x, z, POOL_RADIUS]);
  }

  // Tufts of grass, kept off the paths and the beds.
  const avoid = [[0, 0, 4.4], [PX, PZ, 5.8], [TX, TZ, 2], [-9, 9, 5], [RX, RZ, 3.2], [10, 3, 5], [1, -12.3, 3.6]] as const;
  for (let i = 0; i < 70; i++) {
    const x = (random() - 0.5) * 27, z = (random() - 0.5) * 27;
    if (Math.abs(x) < 1.6 && z > 3) continue;
    if (avoid.some(([a, c, r]) => Math.hypot(x - a, z - c) < r)) continue;
    const h = 0.3 + random() * 0.5;
    p.box(0.2, h, 0.2, m(pick(['stem', 'tuftA', 'tuftB'])), x, h / 2, z);
    p.box(0.2, h * 0.7, 0.2, m('tuftB'), x + 0.2, h * 0.35, z + 0.1);
  }

  // The pools of light the lanterns throw on the ground, one mesh for all of them.
  for (const [x, z, radius] of poolsAt) p.disc(radius, 16, materials.pool, x, 0.06, z);

  // ---- The parts that move ----
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const critters = instances(b, unit, m('critter'), CRITTERS);
  const petals = instances(b, new THREE.BoxGeometry(0.25, 0.05, 0.25), m('petal'), PETALS);
  const fireflies = instances(b, new THREE.BoxGeometry(0.22, 0.22, 0.22), materials.firefly, FIREFLIES);
  const pads = instances(b, new THREE.CylinderGeometry(0.75, 0.75, 0.08, 8), m('lilyPad'), PADS);
  const padFlowers = instances(b, new THREE.BoxGeometry(0.35, 0.3, 0.35), m('lilyFlower'), PADS / 2);

  const color = new THREE.Color();
  let next = 0;
  /** Takes the next critter instance and gives it its colour. */
  const take = (hex: number): number => {
    critters.setColorAt(next, color.setHex(hex));
    return next++;
  };

  const drops = Array.from({ length: DROPS }, (_, i) => ({ id: take(0xbfe6ff), angle: (i / DROPS) * TWO_PI, k: random() }));
  const kois = Array.from({ length: KOI }, (_, i) => {
    const base = i % 2 ? 0xff7a2a : 0xf4f0e8, spot = i % 2 ? 0xf4f0e8 : 0xe8501a;
    return { body: take(base), spot: take(spot), tail: take(base), phase: i * 2.1, speed: 0.45 + i * 0.15, rx: 3.2 - i * 0.6, rz: 2.2 - i * 0.4 };
  });
  const butterflies = [[-9, 9, 0xff8ac0], [RX, RZ, 0xffd84a], [1, -11, 0xffffff], [2, 4, 0x8ac8ff]].map(([cx, cz, wing], i) => ({
    body: take(0x2a1e1e), wings: [take(wing!), take(wing!), take(wing!), take(wing!)], cx: cx!, cz: cz!, phase: i * 1.7, x: cx!, z: cz!, yaw: 0,
  }));
  const cat = { body: take(0xe8913a), tail: take(0xe8913a), tailTip: take(0xf4c27a) };
  critters.instanceColor!.needsUpdate = true;

  const padSpots = [[-2.4, -1], [1.8, 0.9], [-0.6, 1.8], [2.6, -1.4]];
  const falling = Array.from({ length: PETALS }, () => ({ x: TX + (random() - 0.5) * 7, z: TZ + (random() - 0.5) * 6, y: random() * 7, speed: 0.6 + random() * 0.6, phase: random() * 6 }));
  const glimmer = Array.from({ length: FIREFLIES }, () => ({ x: (random() - 0.5) * 26, z: (random() - 0.5) * 26, y: 0.8 + random() * 3.5, phase: random() * 6 }));

  const at = new THREE.Matrix4(), parent = new THREE.Matrix4(), hand = new THREE.Matrix4();
  const set = (id: number, matrix: THREE.Matrix4) => critters.setMatrixAt(id, matrix);

  const update = (time: number, dt: number): void => {
    for (const d of drops) {
      d.k = (d.k + dt * 1.1) % 1;
      const r = 0.2 + d.k * 1.1;
      set(d.id, place(at, IDENTITY, Math.cos(d.angle) * r, 3.8 + d.k * 0.9 - d.k * d.k * 3.2, Math.sin(d.angle) * r, [0.16, 0.16, 0.16]));
    }
    for (const k of kois) {
      const a = time * k.speed + k.phase;
      place(parent, IDENTITY, PX + Math.cos(a) * k.rx, 0.3, PZ + Math.sin(a) * k.rz, [1, 1, 1], [0, Math.atan2(-Math.sin(a) * k.rx, Math.cos(a) * k.rz), 0]);
      set(k.body, place(at, parent, 0, 0, 0, [0.4, 0.22, 1]));
      set(k.spot, place(at, parent, 0, 0.01, 0.15, [0.34, 0.24, 0.35]));
      place(hand, parent, 0, 0, -0.5, [1, 1, 1], [0, Math.sin(time * 8 + k.phase) * 0.5, 0]);
      set(k.tail, place(at, hand, 0, 0, -0.22, [0.55, 0.06, 0.5]));
    }
    padSpots.forEach(([dx, dz], i) => {
      place(parent, IDENTITY, PX + dx!, 0.46 + Math.sin(time * 1.5 + i) * 0.03, PZ + dz!, [1, 1, 1], [0, Math.sin(time * 0.4 + i) * 0.2, 0]);
      pads.setMatrixAt(i, parent);
      if (i % 2 === 0) padFlowers.setMatrixAt(i / 2, place(at, parent, 0.15, 0.18, 0.1, [1, 1, 1]));
    });
    for (const f of butterflies) {
      const x = f.cx + Math.sin(time * 0.7 + f.phase) * 3, z = f.cz + Math.sin(time * 1.1 + f.phase * 1.3) * 2.2;
      const y = 3 + Math.sin(time * 1.9 + f.phase) * 0.7;
      if ((x - f.x) ** 2 + (z - f.z) ** 2 > 1e-6) f.yaw = Math.atan2(x - f.x, z - f.z);
      f.x = x;
      f.z = z;
      const flap = Math.sin(time * 18 + f.phase) * 0.9;
      place(parent, IDENTITY, x, y, z, [1, 1, 1], [0, f.yaw, 0]);
      set(f.body, place(at, parent, 0, 0, 0, [0.12, 0.12, 0.6]));
      [[-1, 0], [1, 2]].forEach(([side, first]) => {
        place(hand, parent, side! * 0.06, 0, 0, [1, 1, 1], [0, 0, side! * flap]);
        set(f.wings[first!]!, place(at, hand, side! * 0.35, 0, 0.1, [0.7, 0.04, 0.6]));
        set(f.wings[first! + 1]!, place(at, hand, side! * 0.25, 0, -0.35, [0.5, 0.04, 0.4]));
      });
    }
    // The cat breathes and flicks its tail; its frame is the pergola's bench's, so the parts still ride on the merged ones.
    set(cat.body, place(at, catFrame, 0, 0.25, 0, [1.2, 0.5 * (1 + Math.sin(time * 2) * 0.06), 0.75]));
    place(hand, catFrame, -0.6, 0.15, 0.2, [1, 1, 1], [0, Math.sin(time * 0.8) * 0.25, 0]);
    set(cat.tail, place(at, hand, 0, 0, 0.25, [0.2, 0.2, 0.7]));
    set(cat.tailTip, place(at, hand, 0.2, 0, 0.55, [0.5, 0.2, 0.2]));
    critters.instanceMatrix.needsUpdate = true;
    pads.instanceMatrix.needsUpdate = true;
    padFlowers.instanceMatrix.needsUpdate = true;

    falling.forEach((f, i) => {
      f.y -= dt * f.speed;
      if (f.y < 0.1) {
        f.y = 6 + Math.random() * 3;
        f.x = TX + (Math.random() - 0.5) * 7;
        f.z = TZ + (Math.random() - 0.5) * 6;
      }
      place(at, IDENTITY, f.x + Math.sin(time * 1.3 + f.phase) * 0.8, f.y, f.z + Math.cos(time * 0.9 + f.phase) * 0.4, [1, 1, 1], [time * 2 + f.phase, time + f.phase, 0]);
      petals.setMatrixAt(i, at);
    });
    petals.instanceMatrix.needsUpdate = true;

    fireflies.visible = materials.darkness > 0.02;
    if (fireflies.visible) {
      glimmer.forEach((f, i) => {
        // The demo fades each one in and out; here it grows and shrinks, as they share one material.
        const size = 0.3 + 0.7 * Math.max(0, Math.sin(time * 2.5 + f.phase * 3));
        place(at, IDENTITY, f.x + Math.sin(time * 0.5 + f.phase) * 1.5, f.y + Math.sin(time * 0.9 + f.phase * 2) * 0.6, f.z + Math.cos(time * 0.4 + f.phase) * 1.5, [size, size, size]);
        fireflies.setMatrixAt(i, at);
      });
      fireflies.instanceMatrix.needsUpdate = true;
    }
  };
  update(0, 0);

  const root = b.finish();
  return {
    root,
    update,
    dispose: () => {
      for (const mesh of [critters, petals, fireflies, pads, padFlowers]) mesh.dispose();
      b.disposeAll();
    },
  };
}
