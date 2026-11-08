import * as THREE from 'three';
import { plant } from './modelProps';
import { canvasTex, floorPlate, glassMaterial, glow, lam, ModelBuilder, PALETTE as P, seeded, type ModelHandle } from './sceneKit';

/** Width of the workspace plinth and the height of its walls, in model units (the demo's). */
export const WORKSPACE_SPAN = 60;
export const WORKSPACE_TOP = 19;
export const WORKSPACE_SLAB = 3;

/** Everything the rooms share: the screens' textures and the glass. Built on first use. */
let shared: { code: THREE.CanvasTexture; screens: THREE.MeshBasicMaterial[]; window: THREE.MeshBasicMaterial; glass: THREE.MeshBasicMaterial } | null = null;
let prototype: { root: THREE.Group; dispose(): void } | null = null;

function sharedParts() {
  if (shared) return shared;
  const random = seeded(23);
  const code = canvasTex(64, 40, (g) => {
    g.fillStyle = '#120f26'; g.fillRect(0, 0, 64, 40);
    const colors = ['#22e5f0', '#e05bf0', '#ffc24a', '#8f86c7'];
    for (let row = 0; row < 13; row++) {
      g.fillStyle = colors[Math.floor(random() * 4)]!;
      g.fillRect(3 + Math.floor(random() * 4) * 4, 1 + row * 3, 6 + Math.floor(random() * 30), 2);
    }
  });
  code.wrapS = code.wrapT = THREE.RepeatWrapping;
  const chart = canvasTex(64, 40, (g) => {
    g.fillStyle = '#120f26'; g.fillRect(0, 0, 64, 40);
    for (let i = 0; i < 8; i++) {
      const height = 6 + Math.floor(random() * 26);
      g.fillStyle = i % 2 ? '#e05bf0' : '#22e5f0';
      g.fillRect(5 + i * 7, 36 - height, 4, height);
    }
    g.fillStyle = '#5F5E5A'; g.fillRect(3, 36, 58, 1);
  });
  const dash = canvasTex(64, 36, (g) => {
    g.fillStyle = '#120f26'; g.fillRect(0, 0, 64, 36);
    g.fillStyle = '#2c2558'; for (const [x, y] of [[3, 3], [23, 3], [43, 3]] as const) g.fillRect(x, y, 18, 9);
    g.fillStyle = '#ffc24a'; g.fillRect(5, 7, 10, 2);
    g.fillStyle = '#22e5f0'; g.fillRect(25, 7, 13, 2);
    g.fillStyle = '#e05bf0'; g.fillRect(45, 7, 8, 2);
    g.fillStyle = '#22e5f0';
    let y = 28;
    for (let x = 4; x < 60; x += 2) {
      y = Math.max(16, Math.min(32, y + Math.floor(random() * 5) - 2));
      g.fillRect(x, y, 2, 1);
    }
  });
  const skyline = canvasTex(32, 28, (g) => {
    g.fillStyle = '#1b1742'; g.fillRect(0, 0, 32, 28);
    g.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) g.fillRect(Math.floor(random() * 32), Math.floor(random() * 10), 1, 1);
    let x = 0;
    while (x < 32) {
      const width = 3 + Math.floor(random() * 4), height = 6 + Math.floor(random() * 14);
      g.fillStyle = '#2c2558'; g.fillRect(x, 28 - height, width, height);
      g.fillStyle = '#ffc24a';
      for (let yy = 28 - height + 1; yy < 27; yy += 2) for (let xx = x + 1; xx < x + width - 1; xx += 2) if (random() < 0.35) g.fillRect(xx, yy, 1, 1);
      x += width;
    }
  });
  shared = {
    code,
    screens: [code, chart, dash].map((map) => new THREE.MeshBasicMaterial({ map })),
    window: new THREE.MeshBasicMaterial({ map: skyline }),
    glass: glassMaterial(P.cyan, 0.06),
  };
  return shared;
}

function build(): { root: THREE.Group; dispose(): void } {
  const { screens, window, glass } = sharedParts();
  const b = new ModelBuilder();
  const furn = lam(P.furn);
  const plate = floorPlate(WORKSPACE_SPAN, WORKSPACE_SLAB);
  b.own(plate);
  b.add(plate.mesh, 0, -1.5, 0);
  b.box(60.4, 0.5, 60.4, glow(P.cyan), 0, -1.6, 0);
  // The steps at the front, which the demo has outside its plinth.
  b.box(12, 1, 5, lam(P.dark), 6, -3.5, 32);

  // Walls on the two far sides, with a glowing line along the top and the foot.
  b.box(60, 18, 1, lam(P.wall), 0, 9, -30.5);
  b.box(1, 18, 61, lam(P.wall), -30.5, 9, -0.5);
  b.box(60.4, 0.6, 1.4, lam(P.dark), 0, 18.3, -30.5);
  b.box(1.4, 0.6, 61.4, lam(P.dark), -30.5, 18.3, -0.5);
  b.box(59, 0.2, 0.2, glow(P.cyan), 0.5, 17.7, -29.9);
  b.box(0.2, 0.2, 60, glow(P.cyan), -29.9, 17.7, 0);
  b.box(59, 0.15, 0.15, glow(P.pink), 0.5, 0.1, -29.9);
  b.box(0.15, 0.15, 60, glow(P.pink), -29.9, 0.1, 0);
  for (const x of [4, 13, 22]) {
    b.box(7.6, 6.6, 0.4, lam(P.dark), x, 11, -29.8);
    b.box(6.8, 5.8, 0.1, window, x, 11, -29.55);
  }
  const wave = Array.from({ length: 31 }, (_, i) => new THREE.Vector3(-29.8, 14 + 0.7 * Math.sin((i / 30) * Math.PI * 4), (i / 30) * 16));
  b.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wave), 80, 0.2, 6, false), glow(P.pink)), 0, 0, 0);

  const chair = (x: number, z: number, ry: number, color: number) => b.group(x, 0, z, ry, () => {
    b.box(3.2, 0.4, 0.6, furn, 0, 0.2, 0);
    b.box(0.6, 0.4, 3.2, furn, 0, 0.2, 0);
    b.box(0.5, 3, 0.5, furn, 0, 1.9, 0);
    b.box(3.6, 0.7, 3.4, lam(color), 0, 3.8, 0);
    b.box(3.6, 4.2, 0.7, lam(color), 0, 6.4, 1.7);
  });
  const monitor = (x: number, y: number, z: number, ry: number, picture: number) => b.group(x, y, z, ry, () => {
    b.box(1.6, 0.25, 1.1, furn, 0, 0.12, 0);
    b.box(0.5, 1.6, 0.5, furn, 0, 1, 0);
    b.box(4.6, 2.8, 0.3, furn, 0, 2.9, 0);
    b.box(4.1, 2.4, 0.05, screens[picture]!, 0, 2.9, 0.18);
  });
  const sofa = (x: number, z: number, ry: number) => b.group(x, 0, z, ry, () => {
    b.box(9, 2, 3.6, lam(P.sofa), 0, 1, 0);
    b.box(9, 3.6, 1.2, lam(P.sofa), 0, 3.4, 2.4);
    b.box(0.8, 3, 4.8, lam(P.sofa), -4.9, 1.5, 0.6);
    b.box(0.8, 3, 4.8, lam(P.sofa), 4.9, 1.5, 0.6);
    b.box(1.6, 1.6, 0.8, lam(P.pillow), -3, 2.8, 1.4);
  });
  const bench = (cx: number, cz: number) => {
    b.box(28, 0.6, 7, lam(P.desk), cx, 7, cz);
    for (const d of [-13.6, 0, 13.6]) b.box(0.8, 6.7, 6.2, furn, cx + d, 3.35, cz);
    b.box(28, 1.4, 0.3, furn, cx, 8, cz);
    b.box(28, 0.12, 0.32, glow(P.cyan), cx, 8.75, cz);
    [-9, 0, 9].forEach((d, i) => {
      const x = cx + d;
      chair(x, cz - 5, Math.PI, i % 2 ? P.chair2 : P.chair);
      chair(x, cz + 5, 0, i % 2 ? P.chair : P.chair2);
      monitor(x, 7.3, cz - 1.4, Math.PI, i % 3);
      monitor(x, 7.3, cz + 1.4, 0, (i + 1) % 3);
      b.box(3.6, 0.25, 1.2, furn, x, 7.42, cz - 2.6);
      b.box(3.6, 0.25, 1.2, furn, x, 7.42, cz + 2.6);
    });
  };
  const booth = (x: number, z: number) => {
    b.box(5, 0.3, 5, lam(P.dark), x, 0.15, z);
    for (const [a, c] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]] as const) b.box(0.4, 13, 0.4, furn, x + a, 6.8, z + c);
    b.box(5, 0.6, 5, furn, x, 13.5, z);
    b.box(4.6, 12.8, 4.6, glass, x, 6.9, z);
    b.box(5, 0.15, 0.1, glow(P.cyan), x, 13.1, z - 2.55);
    b.box(4, 0.3, 1.4, lam(P.desk), x, 7, z + 1.6);
    b.box(0.4, 3.6, 0.4, furn, x, 2, z - 0.3);
    b.box(1.8, 0.5, 1.8, lam(P.chair), x, 4, z - 0.3);
    b.box(0.6, 0.6, 0.6, glow(P.amber), x + 1.2, 7.5, z + 1.8);
  };

  // Meeting room, back left: a glass box with a table, chairs and a screen on the wall.
  b.box(21.6, 0.12, 17.6, lam(P.carpet), -19, 0.06, -21);
  b.box(14, 0.6, 5, lam(P.desk), -19, 6.5, -21);
  b.box(10, 6.2, 2, furn, -19, 3.1, -21);
  b.box(10, 0.05, 0.6, glow(P.violet), -19, 6.83, -21);
  for (const x of [-24, -19, -14]) {
    chair(x, -25, Math.PI, P.chair2);
    chair(x, -17, 0, P.chair2);
  }
  b.box(12, 6.6, 0.4, furn, -19, 10.5, -29.8);
  b.box(11.2, 6, 0.05, screens[2]!, -19, 10.5, -29.57);
  b.box(0.1, 2.5, 0.1, furn, -23, 16.4, -21);
  b.box(0.1, 2.5, 0.1, furn, -15, 16.4, -21);
  b.box(10, 0.4, 0.8, glow(P.amber), -19, 15, -21);
  b.box(0.3, 5, 8, lam(P.board), -29.85, 9.5, -21);
  ([[-23.5, 0x22e5f0], [-22, 0xe05bf0], [-20.5, 0xffc24a], [-23, 0xe05bf0], [-21.2, 0x22e5f0]] as const).forEach(([z, color], i) => {
    b.box(0.1, 1.1, 1.1, lam(color), -29.65, i < 3 ? 10.8 : 8.8, z);
  });
  b.box(0.15, 15, 18, glass, -8, 7.5, -21);
  for (const z of [-30, -25.5, -21, -16.5, -12]) b.box(0.4, 15, 0.4, furn, -8, 7.5, z);
  b.box(15, 15, 0.15, glass, -22.5, 7.5, -12);
  b.box(3, 15, 0.15, glass, -9.5, 7.5, -12);
  for (const x of [-30, -25, -20, -15, -11]) b.box(0.4, 15, 0.4, furn, x, 7.5, -12);
  b.box(0.4, 0.5, 18, furn, -8, 15, -21);
  b.box(0.2, 0.15, 18, glow(P.cyan), -8, 15.35, -21);
  b.box(22, 0.5, 0.4, furn, -19, 15, -12);
  b.box(22, 0.15, 0.2, glow(P.cyan), -19, 15.35, -12);

  bench(13, -21);
  bench(13, -5);

  // Coffee bar along the left wall.
  b.box(3.5, 6, 16, lam(P.counter), -28.25, 3, 8);
  b.box(4, 0.4, 16.4, lam(P.desk), -28, 6.2, 8);
  b.box(0.1, 0.12, 16, glow(P.cyan), -26.2, 5.8, 8);
  b.box(2.4, 3, 2.4, furn, -28.5, 7.9, 2.5);
  b.box(0.1, 0.5, 0.8, glow(P.amber), -27.25, 8.6, 2.5);
  b.box(0.1, 0.3, 0.5, glow(P.cyan), -27.25, 7.6, 2.5);
  b.box(0.7, 0.9, 0.7, lam(P.mug), -28, 6.85, 6);
  b.box(0.7, 0.9, 0.7, lam(P.mugB), -28.3, 6.85, 7.2);
  for (const z of [3, 8, 13]) {
    b.box(1.6, 0.3, 1.6, furn, -23.5, 0.15, z);
    b.box(0.4, 4.2, 0.4, furn, -23.5, 2.4, z);
    b.box(2, 0.5, 2, lam(P.chair), -23.5, 4.7, z);
  }

  // Lounge, front left.
  b.box(14, 0.12, 12, lam(P.rug), -13, 0.06, 15);
  sofa(-13, 10, Math.PI);
  sofa(-13, 20, 0);
  b.box(5, 1.8, 3, furn, -13, 0.9, 15);
  b.box(5.6, 0.4, 3.6, lam(P.desk), -13, 2, 15);
  b.box(1.6, 0.05, 1.1, glow(P.violet), -13, 2.23, 15);
  b.box(1.4, 0.3, 1.4, furn, -5.5, 0.15, 10);
  b.box(0.3, 9, 0.3, furn, -5.5, 4.5, 10);
  b.box(1.4, 1.4, 1.4, glow(P.amber), -5.5, 9.5, 10);

  // Front desk and two phone booths.
  b.box(12, 6, 3, lam(P.counter), 6, 3, 21);
  b.box(12.6, 0.4, 3.4, lam(P.desk), 6, 6.2, 21);
  b.box(12, 0.15, 0.1, glow(P.pink), 6, 4.5, 22.55);
  b.box(12, 0.12, 0.1, glow(P.cyan), 6, 0.4, 22.55);
  monitor(6, 6.4, 20.6, Math.PI, 2);
  chair(6, 17.5, Math.PI, P.chair);
  booth(21.5, 22);
  booth(27, 22);

  for (const [x, z, size] of [[-27, -14.6, 0.9], [-4.5, -27, 1.1], [28, -27, 1], [-27, 26.5, 1], [14, 24, 0.9], [14, 9, 0.8]] as const) plant(b, x, z, size);
  return { root: b.finish(), dispose: () => b.disposeAll() };
}

/** The coworking space of the demo. It never changes, so one copy is built and every workspace shows a clone of it. */
export function createWorkspace(): ModelHandle {
  prototype ??= build();
  const { code } = sharedParts();
  return {
    root: prototype.root.clone(),
    update(time) {
      code.offset.y = -time * 0.06;
    },
    dispose() {},
  };
}
