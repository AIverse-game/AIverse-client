import * as THREE from 'three';
import { bench, lamp, tree } from './modelProps';
import { canvasTex, floorPlate, glow, lam, ModelBuilder, PALETTE as P, seeded, type ModelHandle } from './sceneKit';

/** Width of the lobby plaza in model units (the demo's), and the parcels it spans on the map. */
export const LOBBY_SPAN = 60;
export const LOBBY_PARCELS = 3;
/** The lobby floor lies this far above the map so the two do not flicker against each other. */
export const LOBBY_LIFT = 0.03;

export interface LobbyPlacement {
  /** Map position of the middle of the lobby. */
  centre: { x: number; y: number };
  /** Map units per model unit. */
  scale: number;
}

/** The lobby fills the middle parcels, where residents are born. */
export function lobbyPlacement(mapSize: number, parcelSize: number): LobbyPlacement {
  return { centre: { x: mapSize / 2, y: mapSize / 2 }, scale: (LOBBY_PARCELS * parcelSize) / LOBBY_SPAN };
}

/** Height of the floor, in model units, at a point of the plaza: the spawn pad is two steps up. */
export function lobbyGroundHeight(x: number, z: number): number {
  const radius = Math.hypot(x, z);
  if (radius < 6.2) return 0.8;
  if (radius < 7) return 0.4;
  return 0;
}

export interface LobbyHandle extends ModelHandle {
  /** Brightens the column of light over the spawn pad; 0 is its resting glow. */
  flashBeam(level: number): void;
}

function leaderboard(b: ModelBuilder, random: () => number): THREE.Object3D {
  const board = b.own(canvasTex(48, 32, (g) => {
    g.fillStyle = '#120f26'; g.fillRect(0, 0, 48, 32);
    g.fillStyle = '#22e5f0'; g.fillRect(3, 2, 42, 2);
    const ranks = ['#ffc24a', '#B4B2A9', '#D85A30', '#7F77DD', '#7F77DD'];
    ranks.forEach((color, i) => {
      const y = 7 + i * 5;
      g.fillStyle = color; g.fillRect(3, y, 3, 3);
      g.fillStyle = '#5F5E5A'; g.fillRect(8, y + 1, 12 + Math.floor(random() * 8), 1);
      g.fillStyle = i < 3 ? color : '#e05bf0'; g.fillRect(32, y + 1, 13 - i * 2, 1);
    });
  }));
  b.box(0.8, 6, 0.8, lam(P.furn), -5, 3, 0);
  b.box(0.8, 6, 0.8, lam(P.furn), 5, 3, 0);
  b.box(12.6, 8.6, 0.6, lam(P.furn), 0, 10, 0);
  b.add(new THREE.Mesh(new THREE.BoxGeometry(11.6, 7.6, 0.05), new THREE.MeshBasicMaterial({ map: board })), 0, 10, 0.33);
  b.box(12.6, 0.2, 0.65, glow(P.cyan), 0, 14.4, 0);
  return b.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), glow(P.amber)), 0, 16.5, 0);
}

function shop(b: ModelBuilder): THREE.Object3D {
  b.box(10, 4, 3, lam(P.counter), 0, 2, 2);
  b.box(10.6, 0.4, 3.4, lam(P.desk), 0, 4.2, 2);
  b.box(10, 0.15, 0.06, glow(P.pink), 0, 3.4, 3.53);
  b.box(10, 9, 1.4, lam(P.furn), 0, 4.5, -2.3);
  [3, 5.6, 8.2].forEach((y, row) => {
    b.box(9.4, 0.25, 1, lam(P.desk), 0, y - 0.9, -1.4);
    for (let i = 0; i < 5; i++) {
      const item = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), glow([P.cyan, P.pink, P.amber][(i + row) % 3]!));
      if (i % 2) item.rotation.y = 0.6;
      b.add(item, -3.6 + i * 1.8, y - 0.2, -1.4);
    }
  });
  for (let i = 0; i < 7; i++) b.box(1.5, 0.4, 6, lam(i % 2 ? P.awnB : P.awnA), -4.5 + i * 1.5, 11.2, 0.6);
  b.box(0.4, 11, 0.4, lam(P.furn), -5, 5.5, 3.3);
  b.box(0.4, 11, 0.4, lam(P.furn), 5, 5.5, 3.3);
  // The clerk robot, which bobs behind the counter.
  const robot = new ModelBuilder();
  robot.box(2.4, 2.6, 1.4, lam(P.robot), 0, 3.3, 0);
  robot.box(2.2, 1.8, 1.4, lam(P.robot), 0, 5.6, 0);
  robot.box(0.5, 0.3, 0.1, glow(P.cyan), -0.5, 5.7, 0.71);
  robot.box(0.5, 0.3, 0.1, glow(P.cyan), 0.5, 5.7, 0.71);
  robot.box(0.15, 1, 0.15, lam(P.furn), 0, 7, 0);
  robot.box(0.4, 0.4, 0.4, glow(P.amber), 0, 7.6, 0);
  return b.attach(robot, 0, 0, 0);
}

/**
 * The spawn lobby of the neon demo without its portals: a plaza with a spawn pad under a column of
 * light, a leaderboard, a shop with a robot, benches, trees and lamps. The plaza floor is level with
 * the map, so a model unit is half a map unit when it fills three parcels.
 */
export function createLobby(): LobbyHandle {
  const b = new ModelBuilder();
  const random = seeded(5);
  const plate = floorPlate(LOBBY_SPAN, 3, P.base);
  b.own(plate);
  b.add(plate.mesh, 0, -1.5, 0);
  b.box(60.4, 0.5, 60.4, glow(P.cyan), 0, -1.6, 0);

  b.box(1, 1, 60, lam(P.rim), -29.5, 0.5, 0);
  b.box(1, 1, 60, lam(P.rim), 29.5, 0.5, 0);
  b.box(58, 1, 1, lam(P.rim), 0, 0.5, -29.5);
  b.box(25, 1, 1, lam(P.rim), -16.5, 0.5, 29.5);
  b.box(25, 1, 1, lam(P.rim), 16.5, 0.5, 29.5);
  for (const [x, z] of [[-28, -28], [28, -28], [-28, 28], [28, 28]] as const) {
    b.box(2.6, 10, 2.6, lam(P.pillar), x, 5, z);
    b.box(3, 1.2, 3, lam(P.pillar), x, 10.6, z);
    b.box(1, 1.6, 0.2, glow(P.amber), x, 8, z + 1.35);
    b.box(0.8, 1.2, 0.2, glow(P.cyan), x, 4, z + 1.35);
  }
  b.cylinder(7.4, 7, 0.4, lam(P.dark), 0, 0.2, 0);
  b.cylinder(6.4, 6.2, 0.4, lam(P.desk), 0, 0.6, 0);
  for (const [radius, tube, color, y] of [[6.3, 0.14, P.cyan, 0.82], [3.8, 0.12, P.pink, 0.82]] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 4, 8), glow(color));
    ring.rotation.x = -Math.PI / 2;
    b.add(ring, 0, y, 0);
  }
  // The lane from the pad to the entrance.
  b.box(0.4, 0.05, 20, glow(P.violet), 0, 0.03, 18);
  for (const x of [-1.6, 1.6]) b.box(0.15, 0.05, 20, glow(P.violet), x, 0.03, 18);

  const orbit = new THREE.Group();
  const cubes = new ModelBuilder();
  for (let k = 0; k < 8; k++) {
    const angle = (k * Math.PI) / 4;
    cubes.box(0.6, 0.6, 0.6, glow(k % 2 ? P.cyan : P.pink), 5 * Math.cos(angle), 2.6, 5 * Math.sin(angle));
  }
  orbit.add(b.attach(cubes, 0, 0, 0));
  const beam = b.own(new THREE.MeshBasicMaterial({ color: P.cyan, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }));
  b.add(new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 22, 8, 1, true), beam), 0, 11.8, 0);
  const crystal = b.add(new THREE.Mesh(new THREE.OctahedronGeometry(1.8), glow(P.pink)), 0, 21, 0);
  const sparks = Array.from({ length: 24 }, (_, i) => ({
    mesh: b.add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), glow(i % 2 ? P.cyan : P.amber)), 0, 0, 0),
    angle: random() * Math.PI * 2, radius: 2 + random() * 4, y: 1 + random() * 16, speed: 2 + random() * 3,
  }));

  for (let k = 0; k < 8; k++) {
    const angle = Math.PI / 8 + (k * Math.PI) / 4;
    lamp(b, 13 * Math.cos(angle), 13 * Math.sin(angle), 5);
  }
  let boardSpinner!: THREE.Object3D;
  let robotHolder!: THREE.Object3D;
  b.group(-22, 0, -22, Math.PI / 4, () => { boardSpinner = leaderboard(b, random); });
  b.group(22, 0, -22, 0, () => { robotHolder = shop(b); });
  bench(b, -11, 20, -0.54);
  bench(b, 11, 20, 0.54);
  tree(b, -24, -11, P.leafA, P.leafB, 1.2);
  tree(b, 24, -11, P.pinkA, P.pinkB, 1.2);
  tree(b, -24, 22, P.pinkA, P.pinkB, 1.2);
  tree(b, 24, 22, P.leafA, P.leafB, 1.2);
  const root = b.finish();
  root.add(orbit);
  const robotBase = robotHolder.position.y;

  return {
    root,
    update(time, dt) {
      robotHolder.position.y = robotBase + Math.sin(time * 3) * 0.15;
      crystal.rotation.y += dt * 1.2;
      crystal.rotation.x += dt * 0.4;
      boardSpinner.rotation.y += dt * 1.2;
      boardSpinner.rotation.x += dt * 0.4;
      orbit.rotation.y += dt * 0.8;
      for (const s of sparks) {
        s.y += dt * s.speed;
        if (s.y > 18) s.y = 1;
        s.angle += dt * 0.5;
        s.mesh.position.set(s.radius * Math.cos(s.angle), s.y, s.radius * Math.sin(s.angle));
      }
    },
    flashBeam(level) {
      beam.opacity = 0.08 + 0.3 * level;
    },
    dispose: () => b.disposeAll(),
  };
}
