import * as THREE from 'three';
import { canvasTex, glassMaterial, glow, lam, ModelBuilder, PALETTE as P, type ModelHandle } from './sceneKit';

/** Width of the arcade plinth and the height of its glass shell, in model units. */
export const ARCADE_SPAN = 60;
export const ARCADE_TOP = 39;
export const ARCADE_SLAB = 6.6;

/** Games the hall shows at most, and where each cabinet stands. */
const CABINET = { width: 10.8, height: 17.7 };

/**
 * The game hall: a layered plinth with a tiled floor and two glowing tracks, a lit pillar in each
 * corner, a glass shell with a lit entrance, and one cabinet for every game on show. There is no
 * demo for it; the look follows the hall of change 0076.
 */
export function createArcade(contents: number): ModelHandle {
  const b = new ModelBuilder();
  const tiles = b.own(canvasTex(48, 48, (g) => {
    g.fillStyle = '#302e56'; g.fillRect(0, 0, 48, 48);
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        g.fillStyle = (row + col) % 3 === 0 ? '#46416e' : '#3a365e';
        g.fillRect(col * 8 + 1, row * 8 + 1, 6, 6);
      }
    }
  }));
  const top = b.own(new THREE.MeshLambertMaterial({ map: tiles }));
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(ARCADE_SPAN, 2.2, ARCADE_SPAN), [lam(0x45416e), lam(0x45416e), top, lam(0x45416e), lam(0x45416e), lam(0x45416e)]);
  b.add(plinth, 0, -1.1, 0);
  b.box(ARCADE_SPAN, 2.2, ARCADE_SPAN, lam(0x363157), 0, -3.3, 0);
  b.box(ARCADE_SPAN, 2.2, ARCADE_SPAN, lam(0x292746), 0, -5.5, 0);
  for (const [y, color, thick] of [[-5.8, P.violet, 0.4], [-3.6, P.cyan, 0.6], [-0.4, P.cyan, 0.3]] as const) {
    b.box(ARCADE_SPAN + 0.3, thick, 0.3, glow(color), 0, y, ARCADE_SPAN / 2);
    b.box(0.3, thick, ARCADE_SPAN + 0.3, glow(color), ARCADE_SPAN / 2, y, 0);
  }

  // Two paired tracks wind along the floor.
  for (const centre of [-12.6, 12.6]) {
    for (const [shift, color, radius] of [[-1.5, P.violet, 0.2], [0, P.cyan, 0.3], [1.5, P.violet, 0.2]] as const) {
      const points = Array.from({ length: 17 }, (_, i) => {
        const t = i / 16;
        return new THREE.Vector3(centre + shift + 3.3 * Math.sin(t * Math.PI * 2), 0.25, -22.8 + 45.6 * t);
      });
      b.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, radius, 5, false), glow(color)), 0, 0, 0);
    }
  }

  for (const [x, z] of [[-27, -27], [27, -27], [27, 27], [-27, 27]] as const) {
    b.box(5.4, 13.3, 5.4, lam(0x554b7b), x, 6.65, z);
    b.box(6.2, 1, 6.2, lam(0x2e2645), x, 13.8, z);
    b.box(3, 3, 3, glow(0xffbd64), x, 16.3, z);
  }

  const edge = glow(P.cyan);
  for (const [x, z] of [[-30, -30], [30, -30], [30, 30], [-30, 30]] as const) b.box(0.5, ARCADE_TOP, 0.5, edge, x, ARCADE_TOP / 2, z);
  for (const y of [0.25, ARCADE_TOP]) {
    b.box(ARCADE_SPAN, 0.5, 0.5, edge, 0, y, -30);
    b.box(ARCADE_SPAN, 0.5, 0.5, edge, 0, y, 30);
    b.box(0.5, 0.5, ARCADE_SPAN, edge, -30, y, 0);
    b.box(0.5, 0.5, ARCADE_SPAN, edge, 30, y, 0);
  }
  // The lit entrance in the near wall.
  b.box(0.6, 20, 0.6, glow(P.violet), -9.6, 10, 30);
  b.box(0.6, 20, 0.6, glow(P.violet), 9.6, 10, 30);
  b.box(19.8, 0.7, 0.6, edge, 0, 20, 30);

  const rows = Array.from({ length: contents }, (_, i) => i);
  for (const i of rows) {
    const col = i % 3, row = Math.floor(i / 3);
    const x = -30 + 60 * (0.14 + col * 0.28) + CABINET.width / 2;
    const z = -30 + 60 * (0.2 + row * 0.37) + CABINET.width / 2;
    const accent = i % 2 ? P.violet : P.cyan;
    b.box(CABINET.width, CABINET.height, CABINET.width, lam(0x35375f), x, CABINET.height / 2, z);
    b.box(7.8, 1.8, 0.2, glow(accent), x, CABINET.height * 0.75, z + CABINET.width / 2 + 0.1);
    b.box(7.8, 4, 0.2, glow(0x120f26), x, CABINET.height * 0.5, z + CABINET.width / 2 + 0.1);
  }
  const shell = glassMaterial(0x50cbeb, 0.04);
  b.own(shell);
  b.add(new THREE.Mesh(new THREE.BoxGeometry(ARCADE_SPAN, ARCADE_TOP, ARCADE_SPAN), shell), 0, ARCADE_TOP / 2, 0);
  const root = b.finish();

  return { root, update() {}, dispose: () => b.disposeAll() };
}
