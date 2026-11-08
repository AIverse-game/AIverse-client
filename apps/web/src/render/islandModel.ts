import type { Rect } from '@aiverse/protocol';
import * as THREE from 'three';
import { canvasTex, glassMaterial, glow, lam, ModelBuilder, PALETTE as P, seeded, type ModelHandle } from './sceneKit';

/** Slab under the metal top, then a layer of soil, as in the demo; both hang from the top face at y = 0. */
const SLAB = 1;
const SOIL = 2.5;
/** The top plate sits at y = 0, so the body ends just under it and the two never flicker against each other. */
const TOP = -0.01;
/** The rock is a grid of columns this many to a side, deepest in the middle. */
const COLUMNS = 8;
/** Island width the demo's column depths were drawn for, in model units. */
const DEMO_SPAN = 22;

const SLAB_SIDE = 0x2f2a45;
const SOIL_COLOR = 0x2a2340;
const ROCK_LIGHT = 0x4a4060;
const ROCK_DARK = 0x3a3150;

/** Where the bridges cross: the deck is this far below the top, just under a resident's feet. */
export const BRIDGE_Y = -0.4;
const PORT_WIDTH = 3.6;
const PORT_HEIGHT = 2.2;
const PORT_DEPTH = 0.3;
const BRIDGE_WIDTH = 2.6;
const RAIL_HEIGHT = 1;
/** Length along the deck of the chevrons' pattern, in map units. */
const CHEVRON_PERIOD = 4.3;

/** The island bodies: a slab with a neon band, a layer of soil, and the rock hanging under them like voxels. */
export function createIslandRock(islands: Rect[]): ModelHandle {
  const b = new ModelBuilder();
  const random = seeded(17);
  const slab = lam(SLAB_SIDE);
  const soil = lam(SOIL_COLOR);
  const light = lam(ROCK_LIGHT);
  const dark = lam(ROCK_DARK);
  for (const { x0, z0, x1, z1 } of islands) {
    const width = x1 - x0, depth = z1 - z0;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    b.box(width, SLAB, depth, slab, cx, TOP - SLAB / 2, cz);
    b.box(width, SOIL, depth, soil, cx, TOP - SLAB - SOIL / 2, cz);
    // A thin cyan band round the slab, just proud of its sides.
    b.box(width + 0.04, 0.12, 0.04, glow(P.cyan), cx, -0.5, z0 - 0.01);
    b.box(width + 0.04, 0.12, 0.04, glow(P.cyan), cx, -0.5, z1 + 0.01);
    b.box(0.04, 0.12, depth, glow(P.cyan), x0 - 0.01, -0.5, cz);
    b.box(0.04, 0.12, depth, glow(P.cyan), x1 + 0.01, -0.5, cz);

    const cellX = width / COLUMNS, cellZ = depth / COLUMNS;
    const reach = width / DEMO_SPAN;
    for (let i = 0; i < COLUMNS; i++) {
      for (let j = 0; j < COLUMNS; j++) {
        const x = x0 + cellX * (i + 0.5), z = z0 + cellZ * (j + 0.5);
        const edge = Math.max(Math.abs(x - cx) / (width / 2), Math.abs(z - cz) / (depth / 2));
        const length = ((1 - edge) * 10 + random() * 2.5 + 0.5) * reach;
        b.box(cellX, length, cellZ, length > 6 * reach ? dark : light, x, TOP - SLAB - SOIL - length / 2, z);
      }
    }
  }
  const root = b.finish();
  return { root, update: () => undefined, dispose: () => b.disposeAll() };
}

/** A crossing between two neighbouring islands: where each island's side faces the other, in map units. */
export interface IslandLink {
  a: { x: number; z: number };
  b: { x: number; z: number };
  /** Unit step from `a` to `b`, along x or z. */
  dx: number;
  dz: number;
}

const EPSILON = 1e-6;

/** One link from each island to its next neighbour to the east and to the south, at the middle of the sides that face. */
export function islandLinks(islands: Rect[]): IslandLink[] {
  const links: IslandLink[] = [];
  for (const a of islands) {
    const east = islands.filter((o) => Math.abs(o.z0 - a.z0) < EPSILON && o.x0 >= a.x1).sort((p, q) => p.x0 - q.x0)[0];
    if (east) {
      const z = (Math.max(a.z0, east.z0) + Math.min(a.z1, east.z1)) / 2;
      links.push({ a: { x: a.x1, z }, b: { x: east.x0, z }, dx: 1, dz: 0 });
    }
    const south = islands.filter((o) => Math.abs(o.x0 - a.x0) < EPSILON && o.z0 >= a.z1).sort((p, q) => p.z0 - q.z0)[0];
    if (south) {
      const x = (Math.max(a.x0, south.x0) + Math.min(a.x1, south.x1)) / 2;
      links.push({ a: { x, z: a.z1 }, b: { x, z: south.z0 }, dx: 0, dz: 1 });
    }
  }
  return links;
}

/** The pixel chevrons that stream along a bridge deck. */
function chevrons(): THREE.CanvasTexture {
  const texture = canvasTex(16, 32, (g) => {
    g.clearRect(0, 0, 16, 32);
    g.fillStyle = 'rgba(34,229,240,0.9)';
    for (let k = 0; k < 2; k++) {
      const o = k * 16;
      for (let i = 0; i < 6; i++) {
        g.fillRect(2 + i, o + 4 + i, 2, 1);
        g.fillRect(12 - i, o + 4 + i, 2, 1);
      }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * A port in each island's side at both ends of every link and a light bridge between them: a faint
 * deck with streaming chevrons, cyan edges and pink rails that breathe. The deck lies just under the
 * top, so a resident crossing the gap seems to walk on it.
 */
export function createIslandBridges(links: IslandLink[]): ModelHandle {
  const b = new ModelBuilder();
  const deck = b.own(glassMaterial(P.cyan, 0.3));
  const chevronMap = b.own(chevrons());
  const chevronMaterial = b.own(new THREE.MeshBasicMaterial({ map: chevronMap, transparent: true, depthWrite: false }));
  const length = links[0] ? Math.hypot(links[0].b.x - links[0].a.x, links[0].b.z - links[0].a.z) - 2 * PORT_DEPTH : 1;
  chevronMap.repeat.set(1, Math.max(1, length / CHEVRON_PERIOD));
  const plane = b.own(new THREE.PlaneGeometry(BRIDGE_WIDTH - 0.2, length));

  const railsPerSide = Math.max(2, Math.round(length / 0.8 / 4));
  const railBases: THREE.Matrix4[] = [];
  const half = BRIDGE_WIDTH / 2;
  const inner = PORT_WIDTH - 1;
  for (const { a, b: end, dx, dz } of links) {
    const turn = Math.atan2(dx, dz);
    const mid = { x: (a.x + end.x) / 2, z: (a.z + end.z) / 2 };
    for (const [from, facing] of [[a, turn], [end, turn + Math.PI]] as const) {
      b.group(from.x, BRIDGE_Y, from.z, facing, () => {
        b.box(PORT_WIDTH, PORT_HEIGHT, PORT_DEPTH, lam(P.rim), 0, 0, PORT_DEPTH / 2);
        b.box(inner, 1.3, 0.06, lam(P.dark), 0, 0, PORT_DEPTH + 0.02);
        b.box(inner, 0.14, 0.08, glow(P.cyan), 0, 0.72, PORT_DEPTH + 0.03);
        b.box(inner, 0.14, 0.08, glow(P.cyan), 0, -0.72, PORT_DEPTH + 0.03);
        b.box(0.14, 1.3, 0.08, glow(P.pink), -inner / 2 - 0.07, 0, PORT_DEPTH + 0.03);
        b.box(0.14, 1.3, 0.08, glow(P.pink), inner / 2 + 0.07, 0, PORT_DEPTH + 0.03);
      });
    }
    b.group(mid.x, BRIDGE_Y, mid.z, turn, () => {
      b.box(BRIDGE_WIDTH, 0.15, length, deck, 0, 0, 0);
      const strip = new THREE.Mesh(plane, chevronMaterial);
      strip.rotation.x = -Math.PI / 2;
      b.add(strip, 0, 0.09, 0);
      for (const side of [-half, half]) {
        b.box(0.15, 0.15, length, glow(P.cyan), side, 0.05, 0);
        b.box(0.08, 0.08, length, glow(P.pink), side, RAIL_HEIGHT + 0.05, 0);
      }
    });
    const frame = new THREE.Matrix4().makeRotationY(turn).setPosition(mid.x, BRIDGE_Y, mid.z);
    for (let i = 0; i < railsPerSide; i++) {
      const z = -length / 2 + (length * (i + 0.5)) / railsPerSide;
      for (const side of [-half, half]) railBases.push(frame.clone().multiply(new THREE.Matrix4().makeTranslation(side, RAIL_HEIGHT / 2 + 0.05, z)));
    }
  }

  const posts = b.own(new THREE.InstancedMesh(b.own(new THREE.BoxGeometry(0.12, RAIL_HEIGHT, 0.12)), glow(P.pink), railBases.length));
  railBases.forEach((base, i) => posts.setMatrixAt(i, base));
  b.add(posts, 0, 0, 0);
  const root = b.finish();
  const scaled = new THREE.Matrix4();
  return {
    root,
    update(time, dt) {
      chevronMap.offset.y += dt * 0.6;
      deck.opacity = 0.3 + 0.08 * Math.sin(time * 2);
      railBases.forEach((base, i) => posts.setMatrixAt(i, scaled.makeScale(1, 0.75 + 0.25 * Math.sin(time * 3 + (i % (2 * railsPerSide)) * 0.7), 1).premultiply(base)));
      posts.instanceMatrix.needsUpdate = true;
    },
    dispose: () => b.disposeAll(),
  };
}
