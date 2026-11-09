import * as THREE from 'three';
import { canvasTex, glassMaterial, glow, lam, ModelBuilder, seeded, type ModelHandle } from './sceneKit';

/** Width and length of the mall plinth, the height of its slab and of its top, in model units. */
export const MALL_SPAN_X = 32;
export const MALL_SPAN_Z = 64;
export const MALL_SLAB = 1.4;
export const MALL_TOP = 46;
/** Widest the mall is drawn, in map units: its 10-wide land less the 2 an island may take from one side, so it is the same size wherever it stands. */
export const MALL_WIDTH_CAP = 7.5;

/**
 * The colours of the "雾蓝珊瑚" palette of `demos/voxel_mall_exterior_palettes.html`. The demo draws
 * the walls lit and dims the whole scene for night; the map's light is much brighter than the
 * demo's night, so the lit colours are dimmed here to what the night scene shows (`NIGHT`, found by
 * comparing the two renders) and the glowing ones are left as they are.
 */
const COLORS = {
  s1: 0xe4e9f0, s2: 0xb3bfcf, s3: 0x7d8ca0, in1: 0x2f3a4a, in0: 0x1f2733,
  tile: '#aab5c4', tileLine: '#97a3b4', glassA: '#22324a', glassB: '#314866', scr: '#121822', lit: '#ffd2c4',
  g1: 0xff6b5b, g2: 0xff9a4a, hi: 0xffe6df, acc: 0x4fd1ff,
} as const;
const NIGHT = 0.12;
const dim = (color: number) => {
  const channel = (shift: number) => Math.round(((color >> shift) & 255) * NIGHT);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
};
const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

const FLOORS = 6;
const FLOOR_HEIGHT = 6;
/** The tower: 22 across and 34 deep, its front on z = 4. */
const X0 = -11, X1 = 11, Z0 = -30, Z1 = 4;
const BZ = (Z0 + Z1) / 2;
const ROOF = FLOORS * FLOOR_HEIGHT + 1;

type Icon = (fill: (x: number, y: number, w: number, h: number) => void) => void;
const ICONS: Record<'shirt' | 'cup' | 'bag' | 'gem' | 'food', Icon> = {
  shirt: (f) => { f(4, 2, 2, 1); f(10, 2, 2, 1); f(2, 3, 12, 2); f(4, 5, 8, 5); f(2, 5, 2, 2); f(12, 5, 2, 2); },
  cup: (f) => { f(4, 4, 7, 6); f(11, 5, 2, 1); f(12, 6, 1, 2); f(11, 8, 2, 1); f(5, 1, 1, 2); f(7, 0, 1, 3); f(9, 1, 1, 2); },
  bag: (f) => { f(3, 4, 10, 6); f(6, 1, 1, 3); f(9, 1, 1, 3); f(6, 1, 4, 1); },
  gem: (f) => { f(5, 2, 6, 1); f(3, 3, 10, 2); f(4, 5, 8, 1); f(5, 6, 6, 1); f(6, 7, 4, 1); f(7, 8, 2, 1); },
  food: (f) => { f(3, 2, 10, 2); f(2, 4, 12, 1); f(2, 5, 12, 1); f(3, 6, 10, 2); f(2, 8, 12, 1); },
};

/** The same ease the demo's lift uses. */
const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

/** The big screen over the door; the demo's three scenes, each four seconds. */
function drawScreen(g: CanvasRenderingContext2D, t: number): void {
  const scene = Math.floor(t / 4) % 3;
  g.fillStyle = COLORS.scr; g.fillRect(0, 0, 96, 64);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (scene === 0) {
    g.fillStyle = css(COLORS.g2); g.fillRect(0, 0, 96, 64);
    g.fillStyle = css(COLORS.g1);
    for (let i = 0; i < 8; i++) g.fillRect(((i * 14 + t * 30) % 110) - 14, 0, 6, 64);
    g.fillStyle = '#ffffff'; g.font = 'bold 20px sans-serif'; g.fillText('限时特惠', 48, 26);
    g.font = 'bold 13px sans-serif'; g.fillStyle = COLORS.scr; g.fillText('全场五折起', 48, 46);
  } else if (scene === 1) {
    g.fillStyle = css(COLORS.g1);
    ICONS.bag((a, b, w, h) => g.fillRect(10 + a * 3, 10 + b * 3 + Math.sin(t * 3) * 2, w * 3, h * 3));
    g.fillStyle = '#ffffff'; g.font = 'bold 16px sans-serif'; g.fillText('新品', 72, 24);
    g.fillStyle = css(COLORS.acc); g.fillText('到店', 72, 44);
  } else {
    for (let i = 0; i < 10; i++) {
      const height = 8 + Math.abs(Math.sin(t * 2.5 + i * 0.7)) * 40;
      g.fillStyle = i % 3 === 1 ? css(COLORS.acc) : css(COLORS.g1);
      g.fillRect(6 + i * 9, 60 - height, 6, height);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < 64; y += 2) g.fillRect(0, y, 96, 1);
}

/**
 * The mall: a six-storey tower of the demo with a lit entrance and its sliding doors, a screen over
 * the door, a blade sign down the corner, a glass lift on the side, a roof garden with a halo and a
 * plaza of trees, benches and lamps in front, drawn in the demo's 雾蓝珊瑚 palette at night. Its land
 * is 1 x 2 parcels, 10 x 20 map units: 32 x 64 model units.
 */
export function createMall(): ModelHandle {
  const b = new ModelBuilder();
  const random = seeded(7);
  const s1 = lam(dim(COLORS.s1)), s2 = lam(dim(COLORS.s2)), s3 = lam(dim(COLORS.s3));
  const in0 = lam(dim(COLORS.in0)), in1 = lam(dim(COLORS.in1));
  const g1 = glow(COLORS.g1), g2 = glow(COLORS.g2), hi = glow(COLORS.hi), acc = glow(COLORS.acc);
  const animations: Array<(time: number) => void> = [];

  const windows = (columns: number) => {
    const width = 6, height = 10;
    const texture = b.own(canvasTex(columns * width, height, (g) => {
      for (let i = 0; i < columns; i++) {
        const x = i * width;
        if (random() < 0.28) {
          g.fillStyle = COLORS.lit; g.fillRect(x, 0, width, height);
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, 0, width, 2);
        } else {
          g.fillStyle = COLORS.glassA; g.fillRect(x, 0, width, height);
          g.fillStyle = COLORS.glassB; g.fillRect(x, 0, width, 4);
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 1 + ((i * 3) % 3), 1, 1, height - 3);
        }
        g.fillStyle = css(COLORS.s3); g.fillRect(x, 0, 1, height);
      }
    }));
    return b.own(new THREE.MeshBasicMaterial({ map: texture }));
  };

  // The plinth, tiled on top, with a coral rim.
  const tiles = b.own(canvasTex(16, 16, (g) => {
    g.fillStyle = COLORS.tile; g.fillRect(0, 0, 16, 16);
    g.fillStyle = COLORS.tileLine; g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16);
  }));
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  tiles.repeat.set(MALL_SPAN_X / 4, MALL_SPAN_Z / 4);
  const paving = b.own(new THREE.MeshLambertMaterial({ map: tiles, color: dim(0xffffff) }));
  b.add(new THREE.Mesh(new THREE.BoxGeometry(MALL_SPAN_X, MALL_SLAB, MALL_SPAN_Z), [s3, s3, paving, in0, s3, s3]), 0, -MALL_SLAB / 2, 0);
  b.box(MALL_SPAN_X + 0.3, 0.25, MALL_SPAN_Z + 0.3, g1, 0, -MALL_SLAB + 0.15, 0);
  b.box(16, 0.08, 13, s2, 0, 0.04, Z1 + 7);
  b.box(15.2, 0.06, 0.18, g1, 0, 0.09, Z1 + 1.2);

  // The tower, one slab and one glass band a floor.
  const width = X1 - X0, length = Z1 - Z0;
  const sideColumns = Math.round(length / 2.2), frontColumns = Math.round(width / 2.2);
  const cx = (X0 + X1) / 2;
  for (let floor = 0; floor < FLOORS; floor++) {
    const y = floor * FLOOR_HEIGHT, glass = FLOOR_HEIGHT - 1.3;
    b.box(width, 1.3, length, s1, cx, y + 0.65, BZ);
    b.box(width + 0.12, 0.2, length + 0.12, g1, cx, y + 1.25, BZ);
    b.add(
      new THREE.Mesh(new THREE.BoxGeometry(width - 0.6, glass, length - 0.6), [windows(sideColumns), windows(sideColumns), s2, s2, windows(frontColumns), windows(frontColumns)]),
      cx, y + 1.3 + glass / 2, BZ,
    );
  }
  const height = FLOORS * FLOOR_HEIGHT;
  b.box(width + 0.6, 1, length + 0.6, s1, cx, height + 0.5, BZ);
  b.box(width + 0.7, 0.22, length + 0.7, g2, cx, height + 0.1, BZ);
  for (const [x, z] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]] as const) b.box(1.2, height, 1.2, s2, x, height / 2, z);
  for (let x = X0 + 6; x < X1 - 1; x += 6) b.box(0.5, height, 0.5, s1, x, height / 2, Z1 + 0.05);

  // The entrance with its sliding doors and the canopy over it.
  const ez = Z1 + 0.3;
  b.box(11, 8.2, 0.4, in0, 0, 4.1, ez);
  const doorGlass = b.own(glassMaterial(COLORS.hi, 0.16));
  const doors = [-1, 1].map((side) => b.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 6.6, 0.12), doorGlass), side * 1.3, 3.3, ez + 0.3));
  b.box(0.15, 6.6, 0.16, g1, -2.6, 3.3, ez + 0.32);
  b.box(0.15, 6.6, 0.16, g1, 2.6, 3.3, ez + 0.32);
  b.box(1.2, 8.4, 1.2, s1, -5.6, 4.2, ez + 0.4);
  b.box(1.2, 8.4, 1.2, s1, 5.6, 4.2, ez + 0.4);
  b.box(16, 0.7, 6, s1, 0, 8.7, ez + 2.6);
  b.box(15, 0.15, 5.4, hi, 0, 8.3, ez + 2.6);
  b.box(16.1, 0.2, 0.2, g1, 0, 8.7, ez + 5.62);
  for (let i = 0; i < 6; i++) b.box(1.6, 0.25, 0.1, i % 2 ? acc : g1, -4 + i * 1.6, 9.2, ez + 5.66);
  animations.push((time) => {
    const open = Math.max(0, Math.sin(time * 0.9)) * 1.8;
    doors[0]!.position.x = -1.3 - open;
    doors[1]!.position.x = 1.3 + open;
  });

  // The big screen over the door.
  const screen = b.own(canvasTex(96, 64, (g) => drawScreen(g, 0)));
  const screenZ = Z1 + 0.6;
  b.box(16, 11.4, 0.8, s1, -3, 16, screenZ);
  b.box(16.2, 0.25, 0.9, g1, -3, 16 + 5.75, screenZ);
  b.box(16.2, 0.25, 0.9, g1, -3, 16 - 5.75, screenZ);
  b.add(new THREE.Mesh(new THREE.BoxGeometry(15, 10.4, 0.05), b.own(new THREE.MeshBasicMaterial({ map: screen }))), -3, 16, screenZ + 0.43);
  let screenFrame = -1;
  animations.push((time) => {
    // A new picture a twelfth of a second is plenty for a screen this small.
    const frame = Math.floor(time * 12);
    if (frame === screenFrame) return;
    screenFrame = frame;
    drawScreen(screen.image.getContext('2d') as CanvasRenderingContext2D, frame / 12);
    screen.needsUpdate = true;
  });

  // The blade sign down the front corner, one lit icon to a shop.
  const signX = X1 - 1.8, signZ = Z1 + 0.8;
  b.box(2.6, 26, 1.2, s1, signX, 17, signZ);
  b.box(0.15, 25, 1.25, g1, signX - 1.3, 17, signZ);
  b.box(0.15, 25, 1.25, g1, signX + 1.3, 17, signZ);
  (['shirt', 'cup', 'bag', 'gem', 'food'] as const).forEach((name, i) => {
    const icon = b.own(canvasTex(16, 11, (g) => {
      g.fillStyle = COLORS.scr; g.fillRect(0, 0, 16, 11);
      g.fillStyle = css(i % 2 ? COLORS.acc : COLORS.g1);
      ICONS[name]((x, y, w, h) => g.fillRect(x, y, w, h));
    }));
    b.add(new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.45, 0.08), b.own(new THREE.MeshBasicMaterial({ map: icon }))), signX, 27 - i * 4.6, signZ + 0.64);
  });

  // The glass lift up the side, its car riding to the top and back.
  const liftX = X1 + 2, liftZ = BZ, liftTop = ROOF - 1.5;
  b.box(3.4, liftTop, 3.4, b.own(glassMaterial(COLORS.hi, 0.16)), liftX, liftTop / 2, liftZ);
  for (const [dx, dz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]] as const) b.box(0.3, liftTop, 0.3, s3, liftX + dx, liftTop / 2, liftZ + dz);
  for (let y = FLOOR_HEIGHT; y < liftTop; y += FLOOR_HEIGHT) b.box(3.6, 0.3, 3.6, s2, liftX, y, liftZ);
  b.box(3.8, 0.6, 3.8, s1, liftX, liftTop + 0.3, liftZ);
  b.box(3.9, 0.15, 3.9, g1, liftX, liftTop, liftZ);
  const car = new ModelBuilder();
  car.box(2.6, 0.4, 2.6, s1, 0, 0.2, 0);
  car.box(2.6, 0.4, 2.6, s1, 0, 3.4, 0);
  car.add(new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.8, 2.5), car.own(glassMaterial(COLORS.g1, 0.25))), 0, 1.8, 0);
  car.box(2.7, 0.12, 2.7, g1, 0, 0.45, 0);
  const cab = b.attach(car, liftX, 0.3, liftZ);
  animations.push((time) => {
    const t = time % 14;
    const k = t < 2 ? 0 : t < 7 ? ease((t - 2) / 5) : t < 9 ? 1 : 1 - ease((t - 9) / 5);
    cab.position.y = 0.3 + k * (liftTop - 4.2);
  });

  // The roof: a deck with a row of planters along the front, a machine room and fans, a mast with a
  // blinking light, and the halo.
  b.box(20, 0.12, length - 2, s2, 0, ROOF + 0.06, BZ);
  b.box(width + 0.4, 0.18, 0.18, g1, 0, ROOF + 1.1, Z1 + 0.25);
  for (const x of [-X1 + 0.5, X1 - 0.5]) b.box(0.2, 1.1, 0.2, s3, x, ROOF + 0.55, Z1 + 0.25);
  for (let x = -9; x <= 9; x += 3) {
    b.box(2.2, 0.8, 1.6, s1, x, ROOF + 0.4, Z1 - 2);
    b.box(1.6, 0.9, 1.2, lam(dim(x % 2 ? 0x3b6d11 : 0x639922)), x, ROOF + 1.1, Z1 - 2);
  }
  b.box(8, 2.4, 6, s2, -6, ROOF + 1.2, Z0 + 8);
  b.box(8.2, 0.15, 6.2, g1, -6, ROOF + 2.3, Z0 + 8);
  for (const [x, z] of [[3, Z0 + 6], [6, Z0 + 6], [9, Z0 + 6], [3, Z0 + 9], [6, Z0 + 9]] as const) {
    b.box(2.2, 1.4, 2.2, s3, x, ROOF + 0.7, z);
    b.box(1.4, 0.1, 1.4, in1, x, ROOF + 1.45, z);
  }
  b.box(0.4, 8, 0.4, s3, 8, ROOF + 4, BZ + 3);
  const blink = b.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), glow(0xff3b3b)), 8, ROOF + 8.2, BZ + 3);
  const halo = new ModelBuilder();
  const outer = halo.add(new THREE.Mesh(new THREE.TorusGeometry(6, 0.25, 4, 32), g1), 0, 0, 0);
  const inner = halo.add(new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.12, 4, 32), acc), 0, 0, 0);
  outer.rotation.x = inner.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 4; i++) halo.box(0.3, 5, 0.3, s3, Math.cos((i * Math.PI) / 2) * 6, -2.5, Math.sin((i * Math.PI) / 2) * 6);
  const ring = b.attach(halo, 0, ROOF + 5, BZ);
  animations.push((time) => {
    outer.rotation.z = time * 0.4;
    inner.rotation.z = -time * 0.7;
    ring.position.y = ROOF + 5 + Math.sin(time * 1.2) * 0.25;
    blink.visible = Math.floor(time * 1.5) % 2 === 0;
  });

  // The plaza: lamps along the front, trees and benches.
  for (const [x, z] of [[-13, 14], [13, 14], [-13, 26], [13, 26]] as const) {
    b.box(0.5, 7, 0.5, s3, x, 3.5, z);
    b.box(2.2, 0.4, 0.8, s1, x + 0.6, 7.1, z);
    b.box(1.8, 0.12, 0.6, hi, x + 0.6, 6.86, z);
    b.box(1, 0.6, 1, s2, x, 0.3, z);
  }
  const trunk = lam(dim(0x7a5232));
  for (const [x, z] of [[-12.5, 9], [12.5, 9], [-12.5, 29], [12.5, 29]] as const) {
    b.box(3.4, 1.2, 3.4, s1, x, 0.6, z);
    b.box(3.5, 0.15, 3.5, g1, x, 1.15, z);
    b.box(0.7, 3, 0.7, trunk, x, 2.7, z);
    for (const [dx, y, dz, size, color] of [[0, 4.6, 0, 2.8, 0x3b6d11], [0, 6.2, 0, 1.9, 0x639922], [-1.1, 4.9, 0.8, 1.5, 0x639922], [1.1, 5.1, -0.7, 1.4, 0x3b6d11]] as const) {
      b.box(size, size, size, lam(dim(color)), x + dx, y, z + dz);
    }
  }
  for (const x of [-8, 8]) {
    b.box(3.6, 0.35, 1.2, s1, x, 1, 21);
    b.box(3.6, 0.12, 1.25, g1, x, 0.8, 21);
    b.box(0.4, 0.8, 1, s3, x - 1.5, 0.4, 21);
    b.box(0.4, 0.8, 1, s3, x + 1.5, 0.4, 21);
  }

  const root = b.finish();
  return {
    root,
    update: (time) => animations.forEach((animate) => animate(time)),
    dispose: () => b.disposeAll(),
  };
}
