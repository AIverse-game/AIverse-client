import * as THREE from 'three';
import { canvasTex, floorPlate, glow, lam, ModelBuilder, PALETTE as P, seeded, type ModelHandle } from './sceneKit';

/** Width of the portal plot and the height of its crystal, in model units. The demo's arch is 11 wide, so it fills about half the plot. */
export const PORTAL_SPAN = 20;
export const PORTAL_TOP = 18;
export const PORTAL_SLAB = 0.6;

/** The gate's stripes of light, from the demo's pink portal. */
const GATE = ['#e05bf0', '#7F77DD', '#3C3489'];

/**
 * The portal arch of the spawn lobby demo, taken out of the lobby to stand on a plot of its own: a
 * plinth with a step, two pillars and a lintel framing a gate of flowing light, a cube spinning above.
 */
export function createPortal(): ModelHandle {
  const b = new ModelBuilder();
  const plate = floorPlate(PORTAL_SPAN, PORTAL_SLAB);
  b.own(plate);
  b.add(plate.mesh);
  b.box(PORTAL_SPAN + 0.4, 0.2, PORTAL_SPAN + 0.4, glow(P.cyan), 0, -0.4, 0);

  const gm = glow(P.pink);
  b.box(11, 1.2, 6, lam(P.base), 0, 0.6, 0);
  b.box(9, 0.6, 1.4, lam(P.base), 0, 0.3, 3.7);
  b.box(11, 0.12, 0.06, gm, 0, 0.95, 3.03);
  b.box(1.6, 12, 1.6, lam(P.pillar), -4.2, 7.2, 0);
  b.box(1.6, 12, 1.6, lam(P.pillar), 4.2, 7.2, 0);
  b.box(10, 1.6, 1.6, lam(P.pillar), 0, 13.8, 0);
  b.box(1.2, 1.2, 1.8, gm, 0, 13.8, 0);
  b.box(0.2, 11.4, 0.5, gm, -3.3, 6.9, 0);
  b.box(0.2, 11.4, 0.5, gm, 3.3, 6.9, 0);

  const random = seeded(7);
  const stripes = b.own(canvasTex(8, 32, (g) => {
    for (let y = 0; y < 32; y++) {
      g.fillStyle = GATE[Math.floor(y / 3 + random() * 0.6) % 3]!;
      g.fillRect(0, y, 8, 1);
    }
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 10; i++) g.fillRect(Math.floor(random() * 8), Math.floor(random() * 32), 1, 1);
  }));
  stripes.wrapS = stripes.wrapT = THREE.RepeatWrapping;
  const gate = b.own(new THREE.MeshBasicMaterial({ map: stripes, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 11.4), gate);
  b.add(surface, 0, 6.9, 0);
  const spinner = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), gm);
  b.add(spinner, 0, 17, 0);
  const root = b.finish();

  return {
    root,
    update(_time, dt) {
      stripes.offset.y -= dt * 0.5;
      spinner.rotation.y += dt * 1.2;
      spinner.rotation.x += dt * 0.4;
    },
    dispose: () => b.disposeAll(),
  };
}
