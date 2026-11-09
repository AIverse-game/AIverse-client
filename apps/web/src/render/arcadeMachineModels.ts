import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex, glow, lam, ModelBuilder, seeded, type ModelHandle } from './sceneKit';

/**
 * The five game machines of `demos/arcade_hall_machines_mecha.html`: silver shells, dark insides and
 * glowing lines. A machine knows nothing about the hall or the protocol; it is built from a glow
 * theme alone, at the demo's size with its feet at y = 0, facing +z. The hall decides where each
 * stands and how big (see `arcadeModel.ts`).
 */

export type MachineKind = 'arcade' | 'claw' | 'holo' | 'race' | 'dance';

/** The glow colours; the silver body and the dark screens do not change with it. */
export interface MachineTheme {
  /** Main and second glow line colours. */
  g1: number;
  g2: number;
  /** Highlight, and the accent that sets off the main glow. */
  hi: number;
  acc: number;
  /** The two colours of what moves or floats: prizes, holographic cubes. */
  c1: number;
  c2: number;
}

export const MACHINE_THEMES = {
  amber: { g1: 0xffa41b, g2: 0xff6f1a, hi: 0xfff1c4, acc: 0x2ee6c4, c1: 0xffb347, c2: 0x2ee6c4 },
  blue: { g1: 0x3aa8ff, g2: 0x1f62ff, hi: 0xd9f1ff, acc: 0xff9a3d, c1: 0x5cc8ff, c2: 0x9fb4ff },
} as const satisfies Record<string, MachineTheme>;

export interface MachineSpec {
  kind: MachineKind;
  /** Shown to people, such as on a label. */
  name: string;
  /** Where it stands on the demo's 52 × 40 floor, centred on the middle, and how far it is turned. */
  position: { x: number; z: number };
  ry: number;
  /** Rough height in model units, for putting a label or focusing a camera. */
  height: number;
  build(m: Build): void;
}

const SILVER = { s1: 0xdde1e7, s2: 0xaab1bc, s3: 0x7c8491, in1: 0x363c46, in0: 0x22262d };
const SCREEN = '#141920';
const DIM = '#2b333f';

type Tick = (time: number) => void;

/** What a machine's builder works with: its parts, the shared materials and where animation goes. */
interface Build {
  theme: MachineTheme;
  b: ModelBuilder;
  ticks: Tick[];
  M: Record<keyof typeof SILVER, THREE.MeshLambertMaterial>;
  G1: THREE.MeshBasicMaterial;
  G2: THREE.MeshBasicMaterial;
  HI: THREE.MeshBasicMaterial;
  ACC: THREE.MeshBasicMaterial;
}

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const rgba = (n: number, a: number | string) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;

/**
 * A part built in its own frame so it can tilt or move on its own: its boxes are merged, and
 * `build` may nest more parts. Set a rotation on the result after the call.
 */
function part(b: ModelBuilder, x: number, y: number, z: number, build: (p: ModelBuilder) => void): THREE.Object3D {
  const p = new ModelBuilder();
  build(p);
  b.own({ dispose: () => p.disposeAll() });
  return b.add(p.finish(), x, y, z);
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, rotation?: [number, number, number]): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  if (rotation) m.rotation.set(...rotation);
  return m;
}

/** A pixel screen the machine can draw on every frame; the texture and its material go with the model. */
function pixels(m: Build, width: number, height: number, paint?: (g: CanvasRenderingContext2D) => void) {
  let g!: CanvasRenderingContext2D;
  const texture = m.b.own(canvasTex(width, height, (context) => {
    g = context;
    paint?.(context);
  }));
  const material = m.b.own(new THREE.MeshBasicMaterial({ map: texture }));
  return { g, texture, material };
}

function buildArcade(m: Build): void {
  const { b, M, G1, G2, HI, theme: T } = m;
  b.box(4, 5, 3.6, M.s2, 0, 2.5, 0);
  b.box(3.2, 3.6, 0.1, M.in1, 0, 2.2, 1.82);
  b.box(2.6, 3, 0.12, M.s3, 0, 2.2, 1.86);
  b.box(2.6, 0.12, 0.14, G1, 0, 3.6, 1.88);
  b.add(mesh(new THREE.BoxGeometry(4.3, 0.6, 2.2), M.s1, [0.18, 0, 0]), 0, 5.25, 1.5);
  b.box(4, 7, 2.6, M.s2, 0, 8.4, -0.5);
  for (const x of [-1.8, 1.8]) {
    b.box(0.4, 4.6, 1.6, M.s1, x, 8.6, 0.95);
    b.box(0.42, 3, 0.12, G1, x, 8.6, 1.76);
  }
  const screen = pixels(m, 32, 32);
  part(b, 0, 8.2, 1.1, (p) => {
    p.box(3.3, 3.5, 0.3, M.in0, 0, 0, 0);
    p.box(3, 3.2, 0.05, screen.material, 0, 0, 0.17);
  }).rotation.x = -0.22;
  b.box(4.5, 1.8, 2.6, M.s1, 0, 12.4, 0.05);
  b.box(3.9, 1.1, 0.1, G1, 0, 12.4, 1.36);
  b.box(3.3, 0.6, 0.12, HI, 0, 12.4, 1.38);

  let stick!: THREE.Object3D;
  const buttons: THREE.Object3D[] = [];
  part(b, -0.9, 5.6, 1.4, (p) => {
    p.box(0.6, 0.15, 0.6, M.in0, 0, 0, 0);
    stick = part(p, 0, 0.1, 0, (s) => {
      s.box(0.15, 0.6, 0.15, M.in0, 0, 0.3, 0);
      s.box(0.4, 0.4, 0.4, M.in0, 0, 0.7, 0);
    });
    for (const x of [0.2, 0.9, 1.6]) buttons.push(p.add(mesh(new THREE.BoxGeometry(0.45, 0.25, 0.45), G2), x + 0.1, 0.1, -0.1));
  }).rotation.x = 0.18;

  m.ticks.push((t) => {
    const g = screen.g;
    g.fillStyle = SCREEN;
    g.fillRect(0, 0, 32, 32);
    for (let k = 0; k < 4; k++) {
      const s = (t * 0.6 + k * 0.25) % 1;
      const r = Math.round(2 + s * 14);
      g.strokeStyle = rgba(T.g1, (1 - s).toFixed(2));
      g.lineWidth = 2;
      g.strokeRect(16 - r, 16 - r, r * 2, r * 2);
    }
    g.fillStyle = hex(T.acc);
    g.fillRect(2, 2, 5, 2);
    screen.texture.needsUpdate = true;
    stick.rotation.z = Math.sin(t * 3) * 0.35;
    stick.rotation.x = Math.cos(t * 2.3) * 0.3;
    buttons.forEach((button, i) => (button.position.y = Math.floor(t * 4 + i * 1.7) % 3 === 0 ? 0.02 : 0.1));
  });
}

function buildClaw(m: Build): void {
  const { b, M, G1, G2, ACC, theme: T } = m;
  b.box(6, 3, 6, M.s2, 0, 1.5, 0);
  b.box(4.4, 1.2, 0.1, G1, 0.4, 1.5, 3.02);
  b.box(0.1, 1.2, 4.4, G1, 3.02, 1.5, 0);
  b.box(6.05, 0.3, 6.05, M.in1, 0, 0.15, 0);
  // The control deck at the front left.
  b.group(-1.6, 0, 3.9, 0, () => {
    b.box(3, 2.6, 1.8, M.s2, 0, 1.3, 0);
    b.box(3.1, 0.4, 1.9, M.s1, 0, 2.8, 0);
    b.box(2.2, 0.3, 0.1, G1, 0, 1.2, 0.92);
    b.box(0.5, 0.15, 0.5, M.in0, -0.9, 3.05, 0);
    b.box(0.12, 0.6, 0.12, M.in0, -0.9, 3.35, 0);
    for (const x of [0, 0.6, 1.2]) b.box(0.4, 0.2, 0.4, G2, x, 3.1, 0.25);
  });
  // The ball on the joystick wobbles about x = -2.5 (the deck's -1.6 and the stick's -0.9).
  const ball = b.add(mesh(new THREE.SphereGeometry(0.32, 8, 6), G2), -2.5, 3.75, 3.9);

  const glass = b.own(new THREE.MeshBasicMaterial({ color: T.hi, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
  const glassBox = b.own(new THREE.BoxGeometry(5.6, 6, 5.6));
  b.add(mesh(glassBox, glass), 0, 6, 0);
  b.add(new THREE.LineSegments(b.own(new THREE.EdgesGeometry(glassBox)), b.own(new THREE.LineBasicMaterial({ color: T.g1 }))), 0, 6, 0);
  for (const [x, z] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]] as const) b.box(0.35, 6, 0.35, M.s3, x, 6, z);
  b.box(5.4, 0.3, 5.4, M.in1, 0, 3.1, 0);
  b.box(6.4, 1.6, 6.4, M.s1, 0, 9.8, 0);
  for (const [x, z, ry] of [[0, 3.21, 0], [3.21, 0, Math.PI / 2]] as const) b.group(x, 9.8, z, ry, () => b.box(4, 0.35, 0.1, G1, 0, 0, 0));
  for (const [x, z] of [[-2.7, 3.21], [2.7, 3.21], [3.21, -2.7], [3.21, 2.7]] as const) {
    b.group(x, 9.8, z, Math.abs(x) > 3 ? Math.PI / 2 : 0, () => b.box(0.5, 0.5, 0.1, ACC, 0, 0, 0));
  }
  b.box(4.4, 0.7, 4.4, M.s2, 0, 10.9, 0);
  b.box(3.4, 0.2, 3.4, G1, 0, 11.2, 0);
  b.box(2.6, 0.25, 2.6, M.s1, 0, 11.25, 0);

  // The heap of prizes: hexagonal pencils with a tip, thrown about, merged into one mesh per colour.
  const prizeMaterials = [T.c1, T.c2].map((color) => m.b.own(new THREE.MeshLambertMaterial({ color, emissive: new THREE.Color(color).multiplyScalar(0.25) })));
  const pieces: THREE.BufferGeometry[][] = [[], []];
  const random = seeded(11);
  for (let i = 0; i < 14; i++) {
    const height = 1 + random() * 1.8, radius = 0.35 + random() * 0.25;
    const position = new THREE.Vector3((random() - 0.5) * 4.4, 3.25, (random() - 0.5) * 4.4);
    const turn = new THREE.Euler((random() - 0.5) * 0.6, random() * 3, (random() - 0.5) * 0.6);
    const matrix = new THREE.Matrix4().compose(position, new THREE.Quaternion().setFromEuler(turn), new THREE.Vector3(1, 1, 1));
    const shaft = new THREE.CylinderGeometry(radius, radius, height, 6).translate(0, height / 2, 0).applyMatrix4(matrix);
    const tip = new THREE.ConeGeometry(radius, radius * 1.4, 6).translate(0, height + radius * 0.7, 0).applyMatrix4(matrix);
    pieces[i % 3 === 0 ? 1 : 0]!.push(shaft, tip);
  }
  pieces.forEach((geometries, i) => {
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (merged) b.add(mesh(b.own(merged), prizeMaterials[i]!), 0, 0, 0);
  });

  const rail = b.add(mesh(new THREE.BoxGeometry(5.2, 0.2, 0.3), M.s3), 0, 8.8, 0);
  let cable!: THREE.Object3D, head!: THREE.Object3D;
  const prongs: THREE.Object3D[] = [];
  const car = part(b, 0, 8.6, 0, (p) => {
    p.box(0.8, 0.4, 0.8, M.s3, 0, 0, 0);
    cable = p.add(mesh(new THREE.BoxGeometry(0.06, 1, 0.06), M.in0), 0, -0.5, 0);
    head = part(p, 0, -1, 0, (h) => {
      h.box(0.7, 0.5, 0.7, M.s1, 0, 0, 0);
      h.box(0.3, 0.2, 0.3, G1, 0, 0.35, 0);
      for (let i = 0; i < 3; i++) {
        part(h, 0, -0.2, 0, (spoke) => {
          prongs.push(part(spoke, 0, 0, 0.25, (arm) => {
            arm.box(0.18, 0.9, 0.18, M.s2, 0, -0.45, 0);
            arm.box(0.18, 0.18, 0.4, G1, 0, -0.9, -0.15);
          }));
        }).rotation.y = (i * Math.PI * 2) / 3;
      }
    });
  });

  // One grab every 6.5 s: go to a spot, drop, close, rise, come home, open.
  const home = new THREE.Vector2(-1.8, 1.8);
  const target = new THREE.Vector2(1, -1);
  let cycle = -1;
  const lerp = (a: number, c: number, k: number) => a + (c - a) * k;
  const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  m.ticks.push((t) => {
    const phase = t % 6.5, now = Math.floor(t / 6.5);
    if (now !== cycle) {
      cycle = now;
      target.set((Math.random() - 0.5) * 3.6, (Math.random() - 0.5) * 3.6);
    }
    let x: number, z: number, drop = 0, open = 0.55;
    if (phase < 1.5) { const k = ease(phase / 1.5); x = lerp(home.x, target.x, k); z = lerp(home.y, target.y, k); }
    else if (phase < 2.3) { x = target.x; z = target.y; drop = ease((phase - 1.5) / 0.8); }
    else if (phase < 2.8) { x = target.x; z = target.y; drop = 1; open = lerp(0.55, 0.12, (phase - 2.3) / 0.5); }
    else if (phase < 3.6) { x = target.x; z = target.y; drop = 1 - ease((phase - 2.8) / 0.8); open = 0.12; }
    else if (phase < 5.1) { const k = ease((phase - 3.6) / 1.5); x = lerp(target.x, home.x, k); z = lerp(target.y, home.y, k); open = 0.12; }
    else { x = home.x; z = home.y; open = phase < 5.6 ? lerp(0.12, 0.55, (phase - 5.1) / 0.5) : 0.55; }
    car.position.set(x, 8.6, z);
    rail.position.z = z;
    const length = 1 + drop * 3.2;
    cable.scale.y = length;
    cable.position.y = -length / 2;
    head.position.y = -length;
    for (const arm of prongs) arm.rotation.x = -open;
    ball.position.x = -2.5 + Math.sin(t * 4) * 0.12;
  });
}

/** A wireframe cube with a faint fill and an octahedron inside, which turns and floats. */
function wireCube(m: Build, size: number, color: number): THREE.Group {
  const cube = m.b.own(new THREE.BoxGeometry(size, size, size));
  const inner = m.b.own(new THREE.EdgesGeometry(m.b.own(new THREE.OctahedronGeometry(size * 0.62))));
  const group = new THREE.Group();
  group.add(mesh(cube, m.b.own(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }))));
  group.add(new THREE.LineSegments(m.b.own(new THREE.EdgesGeometry(cube)), m.b.own(new THREE.LineBasicMaterial({ color }))));
  group.add(new THREE.LineSegments(inner, m.b.own(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }))));
  return m.b.add(group, 0, 0, 0);
}

function buildHolo(m: Build): void {
  const { b, M, G1, HI, theme: T } = m;
  b.add(mesh(new THREE.CylinderGeometry(6.2, 6.4, 1.2, 16), M.s3), 0, 0.6, 0);
  b.add(mesh(new THREE.CylinderGeometry(5.9, 6.1, 1.1, 16), M.s1), 0, 1.75, 0);
  const ring = b.add(mesh(new THREE.TorusGeometry(5.7, 0.12, 4, 24), G1, [-Math.PI / 2, 0, 0]), 0, 2.32, 0);
  for (const turn of [-0.75, 0, 0.75]) {
    b.group(0, 0, 0, turn, () => {
      b.box(1.4, 2.6, 1.2, M.s2, 0, 1.3, 6.1);
      b.box(0.9, 0.9, 0.1, G1, 0, 1.8, 6.72);
      b.box(0.9, 0.1, 0.9, HI, 0, 2.62, 6.1);
    });
  }

  const grid = m.b.own(canvasTex(64, 32, (g) => {
    g.clearRect(0, 0, 64, 32);
    g.fillStyle = rgba(T.g1, 0.6);
    for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 1, 32);
    for (let y = 0; y < 32; y += 8) g.fillRect(0, y, 64, 1);
  }));
  grid.wrapS = grid.wrapT = THREE.RepeatWrapping;
  grid.repeat.set(4, 1);
  const domeMaterial = b.own(new THREE.MeshBasicMaterial({ map: grid, color: T.hi, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
  b.add(mesh(new THREE.CylinderGeometry(5.4, 5.4, 5.2, 24, 1, true), domeMaterial), 0, 4.9, 0);
  const fill = b.own(new THREE.MeshBasicMaterial({ color: T.g1, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }));
  b.add(mesh(new THREE.CylinderGeometry(5.38, 5.38, 5.2, 24, 1, true), fill), 0, 4.9, 0);
  b.add(mesh(new THREE.TorusGeometry(5.4, 0.1, 4, 32), G1, [-Math.PI / 2, 0, 0]), 0, 7.5, 0);
  const floor = b.own(canvasTex(32, 32, (g) => {
    g.fillStyle = SCREEN;
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = rgba(T.g1, 0.45);
    for (let i = 0; i < 32; i += 4) { g.fillRect(i, 0, 1, 32); g.fillRect(0, i, 32, 1); }
  }));
  b.add(mesh(new THREE.CircleGeometry(5.4, 24), b.own(new THREE.MeshBasicMaterial({ map: floor })), [-Math.PI / 2, 0, 0]), 0, 2.31, 0);
  const diamonds = [2.2, 1.2].map((size) => b.add(mesh(new THREE.TorusGeometry(size, 0.13, 4, 4), G1, [-Math.PI / 2, 0, 0]), 0, 2.4, 1.8));

  const big = wireCube(m, 2.4, T.c1);
  const smalls = [T.c2, T.c1, T.c2, T.c1].map((color) => wireCube(m, 1.2, color));
  m.ticks.push((t) => {
    big.rotation.y = t * 0.6;
    big.rotation.x = 0.4 + Math.sin(t * 0.7) * 0.15;
    big.position.set(0, 5.4 + Math.sin(t * 1.4) * 0.3, 0);
    smalls.forEach((cube, i) => {
      const a = t * 0.5 + (i * Math.PI) / 2;
      cube.position.set(Math.cos(a) * 3.4, 4.6 + Math.sin(t * 2 + i) * 0.5, Math.sin(a) * 3.4);
      cube.rotation.set(t * 0.8, -t * 1.2, 0);
    });
    grid.offset.set(t * 0.03, -t * 0.15);
    domeMaterial.opacity = 0.42 + 0.1 * Math.sin(t * 3);
    diamonds.forEach((d, i) => d.scale.setScalar(1 + 0.08 * Math.sin(t * 3 + i * 1.5)));
    ring.rotation.z = t * 0.3;
  });
}

function buildRace(m: Build): void {
  const { b, M, G1, G2, HI, ACC, theme: T } = m;
  b.box(11, 1.2, 9, M.s3, 0, 0.6, 0);
  b.box(11.1, 0.25, 9.1, M.s1, 0, 1.3, 0);
  b.box(9, 0.2, 0.1, G1, 0, 0.6, 4.52);
  b.box(0.1, 0.2, 7, G1, 5.52, 0.6, 0);
  for (const [x, z] of [[-5.3, 4.3], [5.3, 4.3], [5.3, -4.3]] as const) {
    b.box(0.9, 1, 0.9, M.s2, x, 0.6, z);
    b.box(0.6, 0.5, 0.06, HI, x, 0.6, z + 0.47);
  }

  const road = pixels(m, 48, 32);
  const flag = pixels(m, 24, 32, (g) => {
    g.fillStyle = SCREEN;
    g.fillRect(0, 0, 24, 32);
    g.fillStyle = hex(T.g1);
    for (let y = 6; y < 26; y += 4) for (let x = 2; x < 22; x += 4) if (((x + y) / 4) % 2 < 1) g.fillRect(x, y, 4, 4);
  });
  const chevron = pixels(m, 32, 32, (g) => {
    g.fillStyle = SCREEN;
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = hex(T.g1);
    for (let k = 0; k < 3; k++) {
      const ox = 4 + k * 9;
      for (let i = 0; i < 6; i++) { g.fillRect(ox + 6 - i, 10 + i, 2, 1); g.fillRect(ox + 6 - i, 21 - i, 2, 1); }
    }
  });
  chevron.texture.wrapS = THREE.RepeatWrapping;

  // The screen wall behind the cockpit: a post, a curved rail and three tilted screens.
  b.group(0, 0, -3.2, 0, () => {
    b.box(0.9, 7, 1.2, M.s2, -5.2, 4.8, 0.1);
    b.box(0.3, 6, 0.1, G1, -5.2, 4.8, 0.72);
    b.add(mesh(new THREE.TorusGeometry(14, 0.45, 4, 24, 0.75), M.s1, [0, 0, Math.PI / 2 - 0.375]), 0, -5.5, -0.4);
    b.add(mesh(new THREE.TorusGeometry(14, 0.15, 4, 24, 0.75), G1, [0, 0, Math.PI / 2 - 0.375]), 0, -5.5, 0.05);
    [[-3.3, 0.38, flag], [0, 0, road], [3.3, -0.38, chevron]].forEach(([x, turn, screen], i) => {
      b.group(x as number, 5, i === 1 ? -0.3 : 0, turn as number, () => {
        b.box(3.5, 3.3, 0.4, M.s2, 0, 0, 0);
        b.box(3.2, 3, 0.05, (screen as ReturnType<typeof pixels>).material, 0, 0, 0.23);
      });
    });
  });
  b.box(9.4, 2.2, 1.8, M.s2, 0, 2.4, -1.5);
  b.box(9.4, 0.4, 2, M.s1, 0, 3.6, -1.4);
  for (const x of [-2.2, 2.2]) for (let i = 0; i < 3; i++) b.box(0.4, 0.1, 0.3, i === 1 ? ACC : G1, x - 0.6 + i * 0.6, 3.85, -0.9);

  // Two steering wheels, tilted back, that rock as if someone were driving.
  const wheels = [-2.3, 2.3].map((x) => {
    let wheel!: THREE.Object3D;
    part(b, x, 4.5, -0.5, (p) => {
      wheel = part(p, 0, 0, 0, (w) => {
        w.add(mesh(new THREE.TorusGeometry(1, 0.2, 6, 12), M.in0), 0, 0, 0);
        w.box(1.8, 0.18, 0.18, M.in0, 0, 0, 0);
        w.box(0.18, 1, 0.18, M.in0, 0, -0.5, 0);
        w.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.3, 8), G1, [Math.PI / 2, 0, 0]), 0, 0, 0);
        w.box(0.25, 0.3, 0.12, G2, -0.95, 0, 0.05);
        w.box(0.25, 0.3, 0.12, G2, 0.95, 0, 0.05);
      });
    }).rotation.x = -0.5;
    return wheel;
  });
  for (const x of [-2.3, 2.3]) {
    b.group(x, 1.4, 2.2, 0, () => {
      b.box(2.6, 1.4, 2.6, M.in1, 0, 0.7, 0);
      b.box(2.4, 0.9, 2.4, M.s1, 0, 1.85, 0.1);
      b.box(2.4, 3.2, 0.9, M.s1, 0, 3.1, 1.2);
      b.box(1.6, 1.1, 0.8, M.s2, 0, 5.1, 1.25);
      b.box(0.4, 1.4, 2, M.s3, -1.2, 2.4, 0.3);
      b.box(0.4, 1.4, 2, M.s3, 1.2, 2.4, 0.3);
      b.box(0.1, 2.6, 0.2, G1, -1.21, 3.1, 1.2);
      b.box(0.1, 2.6, 0.2, G1, 1.21, 3.1, 1.2);
    });
  }

  m.ticks.push((t) => {
    const g = road.g;
    g.fillStyle = SCREEN;
    g.fillRect(0, 0, 48, 32);
    g.fillStyle = DIM;
    g.fillRect(0, 12, 48, 20);
    g.strokeStyle = hex(T.g1);
    g.lineWidth = 1;
    for (const [dx, ex] of [[-6, 0], [6, 48], [-2, 14], [2, 34]] as const) {
      g.beginPath();
      g.moveTo(24 + dx * 0.3, 12);
      g.lineTo(ex, 32);
      g.stroke();
    }
    for (let k = 0; k < 5; k++) {
      const s = (t * 1.2 + k / 5) % 1, y = 12 + s * s * 20;
      g.fillStyle = hex(T.hi);
      g.fillRect(Math.round(24 - 0.5 - s * 0.5), Math.round(y), 1 + Math.round(s * 2), 1 + Math.round(s * 2));
    }
    for (let k = 0; k < 6; k++) {
      const s = (t * 1.2 + k / 6) % 1, y = Math.round(12 + s * s * 20);
      g.fillStyle = k % 2 ? '#ffffff' : hex(T.g2);
      g.fillRect(Math.round(24 - 6 * 0.3 - (24 - 6 * 0.3) * s * s) - 1, y, 2, 1);
    }
    road.texture.needsUpdate = true;
    chevron.texture.offset.x = t * 0.6;
    wheels.forEach((wheel, i) => (wheel.rotation.z = Math.sin(t * 1.5 + i * 1.3) * 0.5));
  });
}

function buildDance(m: Build): void {
  const { b, M, G1, theme: T } = m;
  b.box(10, 0.9, 8, M.s3, 0, 0.45, 0);
  b.box(9.6, 0.12, 7.6, G1, 0, 0.92, 0);
  b.box(9.2, 0.12, 7.2, M.s1, 0, 0.95, 0);
  const equalizer = pixels(m, 40, 24);
  b.group(0, 0, -3.4, 0, () => {
    b.box(8, 7, 1, M.s2, 0, 4, 0);
    b.box(7.4, 5, 0.1, G1, 0, 5, 0.52);
    b.box(6.8, 4.4, 0.05, equalizer.material, 0, 5, 0.58);
    for (const x of [-4.6, 4.6]) {
      b.box(1.5, 6, 1.4, M.s1, x, 3.4, 0.3);
      b.box(0.3, 2.4, 0.06, G1, x, 3.6, 1.02);
    }
  });

  const arrow = (up: boolean) => m.b.own(canvasTex(16, 16, (g) => {
    g.fillStyle = SCREEN;
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = hex(T.g1);
    for (let i = 0; i < 5; i++) g.fillRect(8 - i, up ? 3 + i : 12 - i, i * 2, 1);
    g.fillRect(7, up ? 7 : 3, 2, 6);
  }));
  const [arrowUp, arrowDown] = [arrow(true), arrow(false)];
  const pads: THREE.Mesh[] = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const material = b.own(new THREE.MeshBasicMaterial({ map: (row + col) % 2 ? arrowUp : arrowDown, color: 0x8a8f99 }));
      pads.push(b.add(mesh(new THREE.BoxGeometry(2.2, 0.2, 2.2), material), -2.6 + col * 2.6, 1.1, -0.4 + row * 2.6));
    }
  }
  // A handrail on each side: up from the deck, along the top and back down.
  for (const x of [-4.3, 4.3]) {
    const points = [[x, 1, -2], [x, 3.2, -2], [x, 3.8, -1.5], [x, 3.8, 1.6], [x, 3.2, 2.1], [x, 1, 2.1]].map(([px, py, pz]) => new THREE.Vector3(px, py, pz));
    b.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1), 40, 0.25, 6, false), M.s1), 0, 0, 0);
    b.box(0.8, 0.3, 0.8, M.s3, x, 1.05, -2);
    b.box(0.8, 0.3, 0.8, M.s3, x, 1.05, 2.1);
  }

  const sequence = [0, 4, 2, 3, 1, 5, 0, 2, 4, 3];
  m.ticks.push((t) => {
    const g = equalizer.g;
    g.fillStyle = SCREEN;
    g.fillRect(0, 0, 40, 24);
    for (let i = 0; i < 8; i++) {
      const height = Math.round(2 + Math.abs(Math.sin(t * 3 + i * 0.9) * Math.sin(t * 1.7 + i)) * 9);
      for (let k = 0; k < height; k++) {
        g.fillStyle = k > 7 ? hex(T.hi) : i % 3 === 1 ? hex(T.g2) : hex(T.g1);
        g.fillRect(3 + i * 4.5, 21 - k * 2, 3, 1);
      }
    }
    equalizer.texture.needsUpdate = true;
    const beat = Math.floor(t * 2.5);
    pads.forEach((pad, i) => {
      const on = sequence[beat % sequence.length] === i || sequence[(beat + 5) % sequence.length] === i;
      (pad.material as THREE.MeshBasicMaterial).color.setHex(on ? 0xffffff : 0x8a8f99);
      pad.position.y = on ? 1.04 : 1.1;
    });
  });
}

/** In the order a hall fills up: each new game takes the next one. */
export const MACHINES: readonly MachineSpec[] = [
  { kind: 'arcade', name: '街机', position: { x: -15, z: -8 }, ry: 0.15, height: 15, build: buildArcade },
  { kind: 'claw', name: '抓娃娃机', position: { x: 0, z: -9 }, ry: 0, height: 13, build: buildClaw },
  { kind: 'holo', name: '全息台', position: { x: 15, z: -8 }, ry: -0.2, height: 10, build: buildHolo },
  { kind: 'race', name: '赛车模拟器', position: { x: -9, z: 9 }, ry: 0.1, height: 10, build: buildRace },
  { kind: 'dance', name: '跳舞机', position: { x: 10, z: 9 }, ry: -0.1, height: 10, build: buildDance },
];

/** The machines a hall with this many games shows: the first `contents`, never more than there are. */
export function machinesFor(contents: number): readonly MachineSpec[] {
  return MACHINES.slice(0, Math.max(0, Math.floor(contents)));
}

/** Builds one machine, standing at the origin; the caller moves, turns and scales `root`. */
export function createMachine(spec: MachineSpec, theme: MachineTheme = MACHINE_THEMES.amber): ModelHandle {
  const build: Build = {
    theme,
    b: new ModelBuilder(),
    ticks: [],
    M: { s1: lam(SILVER.s1), s2: lam(SILVER.s2), s3: lam(SILVER.s3), in1: lam(SILVER.in1), in0: lam(SILVER.in0) },
    G1: glow(theme.g1),
    G2: glow(theme.g2),
    HI: glow(theme.hi),
    ACC: glow(theme.acc),
  };
  spec.build(build);
  const root = build.b.finish();
  return {
    root,
    update: (time) => build.ticks.forEach((tick) => tick(time)),
    dispose: () => build.b.disposeAll(),
  };
}
