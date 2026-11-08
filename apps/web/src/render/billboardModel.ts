import * as THREE from 'three';
import { bench, lamp, tree } from './modelProps';
import { canvasTex, floorPlate, glow, lam, ModelBuilder, PALETTE as P, type ModelHandle } from './sceneKit';

/** Width of the billboard plinth and the height of its screen, in model units (the demo's). */
export const BILLBOARD_SPAN = 28;
export const BILLBOARD_TOP = 28;
export const BILLBOARD_SLAB = 3;

const BOARD_Z = -6;
/** Seconds each ad plays, and the demo's countdown for its third ad. */
const AD_SECONDS = 5;
const COUNTDOWN_ENDS_AFTER = 2 * 3600 + 14 * 60 + 37;

type Draw = (g: CanvasRenderingContext2D, text: (s: string, x: number, y: number, size: number, color: string, font?: string) => void) => void;

/** The demo's three advertisements on a 192 × 98 screen. */
const ADS: Array<{ draw: Draw }> = [
  {
    draw: (g, text) => {
      g.fillStyle = '#1b1340'; g.fillRect(0, 0, 192, 98);
      g.fillStyle = '#251a52'; for (let i = 0; i < 7; i++) g.fillRect(0, 4 + i * 14, 192, 6);
      g.fillStyle = '#B4B2A9'; g.fillRect(29, 17, 26, 4); g.fillRect(29, 79, 26, 3);
      g.fillStyle = '#e05bf0'; g.fillRect(27, 21, 30, 58);
      g.fillStyle = '#22e5f0'; g.fillRect(27, 40, 30, 10);
      g.fillStyle = '#ffffff'; g.fillRect(31, 25, 3, 44);
      g.fillStyle = '#22e5f0'; for (const [x, y] of [[64, 32], [70, 22], [62, 14], [75, 44], [68, 52]] as const) g.fillRect(x, y, 3, 3);
      text('霓虹汽水', 126, 40, 22, '#ffffff');
      text('能量满格', 126, 66, 13, '#22e5f0');
    },
  },
  {
    draw: (g, text) => {
      g.fillStyle = '#120f26'; g.fillRect(0, 0, 192, 98);
      g.fillStyle = '#2a2148'; for (let i = 0; i < 12; i++) g.fillRect(i * 16, 0, 8, 98);
      g.fillStyle = '#ffc24a'; g.fillRect(26, 20, 30, 26); g.fillRect(20, 22, 6, 12); g.fillRect(56, 22, 6, 12); g.fillRect(37, 46, 8, 12); g.fillRect(28, 58, 26, 6);
      g.fillStyle = '#BA7517'; g.fillRect(26, 40, 30, 6); g.fillRect(28, 62, 26, 2);
      g.fillStyle = '#ffffff'; for (const [x, y] of [[18, 14], [64, 16], [60, 52], [14, 48]] as const) { g.fillRect(x, y, 3, 1); g.fillRect(x + 1, y - 1, 1, 3); }
      text('S3 新赛季', 128, 38, 22, '#ffffff');
      text('竞技场现已开放', 128, 64, 12, '#e05bf0');
    },
  },
  {
    draw: (g, text) => {
      g.fillStyle = '#1b1742'; g.fillRect(0, 0, 192, 98);
      text('限时活动', 96, 22, 20, '#ffc24a');
      text('双倍经验', 96, 44, 12, '#22e5f0');
      const seconds = Math.max(0, COUNTDOWN_ENDS_AFTER - Math.floor(Date.now() / 1000) % COUNTDOWN_ENDS_AFTER);
      const part = (n: number) => String(n).padStart(2, '0');
      g.fillStyle = '#2c2558'; for (const x of [46, 82, 118]) g.fillRect(x, 62, 28, 22);
      text(part(Math.floor(seconds / 3600)), 60, 74, 18, '#ffffff', 'monospace');
      text(part(Math.floor((seconds % 3600) / 60)), 96, 74, 18, '#ffffff', 'monospace');
      text(part(seconds % 60), 132, 74, 18, '#ffffff', 'monospace');
      text(':', 78, 73, 16, '#e05bf0', 'monospace');
      text(':', 114, 73, 16, '#e05bf0', 'monospace');
    },
  },
];

/**
 * The floating billboard of the neon demo on its plinth: a screen bobbing over a glowing pad, a ticker
 * under it, trees, lamps and a bench. Its screen is dark until the ad slot shows content, then plays
 * one ad per content (up to the demo's three), with the demo's static burst between ads.
 */
export function createBillboard(contents: number): ModelHandle {
  const b = new ModelBuilder();
  const plate = floorPlate(BILLBOARD_SPAN, BILLBOARD_SLAB);
  b.own(plate);
  b.add(plate.mesh);
  b.box(BILLBOARD_SPAN + 0.4, 0.5, BILLBOARD_SPAN + 0.4, glow(P.cyan), 0, -1.6, 0);

  // The screen and its text are drawn on a small canvas, as in the demo.
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 98;
  const g = canvas.getContext('2d')!;
  const adTexture = b.own(new THREE.CanvasTexture(canvas));
  adTexture.magFilter = adTexture.minFilter = THREE.NearestFilter;
  const text = (s: string, x: number, y: number, size: number, color: string, font = 'sans-serif') => {
    g.font = `bold ${size}px ${font}`;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(s, x, y);
  };
  const scanlines = () => {
    g.fillStyle = 'rgba(0,0,0,0.2)';
    for (let y = 0; y < 98; y += 2) g.fillRect(0, y, 192, 1);
  };
  const playing = Math.min(contents, ADS.length);
  const showAd = (index: number) => {
    if (playing === 0) {
      g.fillStyle = '#120f26'; g.fillRect(0, 0, 192, 98);
    } else {
      ADS[index]!.draw(g, text);
    }
    scanlines();
    adTexture.needsUpdate = true;
  };
  const noise = () => {
    const image = g.createImageData(192, 98);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = (Math.random() * 200) | 0;
      image.data[i] = v; image.data[i + 1] = (v * 0.8) | 0; image.data[i + 2] = Math.min(255, v + 40); image.data[i + 3] = 255;
    }
    g.putImageData(image, 0, 0);
    scanlines();
    adTexture.needsUpdate = true;
  };

  const ticker = b.own(canvasTex(512, 24, (t) => {
    t.fillStyle = '#120f26'; t.fillRect(0, 0, 512, 24);
    t.font = 'bold 15px sans-serif'; t.textBaseline = 'middle'; t.fillStyle = '#ffc24a';
    t.fillText('★ 霓虹汽水 能量满格     ★ S3 新赛季已开启     ★ 限时活动 双倍经验     ', 6, 12);
  }));
  ticker.wrapS = THREE.RepeatWrapping;

  // The board is built apart so it can bob.
  const board = new ModelBuilder();
  board.box(22, 12, 1.2, lam(P.furn), 0, 0, 0);
  board.box(20, 0.15, 0.1, glow(P.cyan), 0, 0, -0.65);
  board.add(new THREE.Mesh(new THREE.BoxGeometry(20.4, 10.4, 0.05), new THREE.MeshBasicMaterial({ map: adTexture })), 0, 0, 0.63);
  for (const y of [6.1, -6.1]) board.box(22.4, 0.3, 0.3, glow(P.pink), 0, y, 0.7);
  for (const x of [-11.1, 11.1]) board.box(0.3, 12.4, 0.3, glow(P.pink), x, 0, 0.7);
  for (const y of [5.3, -5.3]) board.box(20.8, 0.15, 0.1, glow(P.cyan), 0, y, 0.66);
  for (const x of [-10.35, 10.35]) board.box(0.15, 10.8, 0.1, glow(P.cyan), x, 0, 0.66);
  board.box(22, 1.4, 1, lam(P.furn), 0, -6.95, 0);
  board.add(new THREE.Mesh(new THREE.BoxGeometry(21.6, 1.1, 0.05), new THREE.MeshBasicMaterial({ map: ticker })), 0, -6.95, 0.51);
  const boardRoot = b.attach(board, 0, 21.6, BOARD_Z);

  // The pad, its ring and the rising sparks.
  b.cylinder(3.6, 3.4, 0.5, lam(P.dark), 0, 0.25, BOARD_Z);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.12, 4, 8), glow(P.cyan));
  ring.rotation.x = -Math.PI / 2;
  b.add(ring, 0, 0.53, BOARD_Z);
  b.box(1.4, 0.2, 1.4, glow(P.pink), 0, 0.6, BOARD_Z);
  const beamMaterial = b.own(new THREE.MeshBasicMaterial({ color: P.cyan, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }));
  b.add(new THREE.Mesh(new THREE.CylinderGeometry(6, 2.2, 12, 8, 1, true), beamMaterial), 0, 6.6, BOARD_Z);
  const sparks = Array.from({ length: 14 }, (_, i) => {
    const spark = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), glow(i % 2 ? P.cyan : P.pink));
    b.add(spark, 0, 0, BOARD_Z);
    return { spark, angle: Math.random() * Math.PI * 2, y: Math.random() * 12, speed: 1.5 + Math.random() * 2 };
  });

  tree(b, -9, 7, P.pinkA, P.pinkB);
  bench(b, 4, 7, 0);
  lamp(b, 11, 9, 6);
  lamp(b, -11, -10, 6);
  ([[10, -10, 1.6], [-4, -11, 1.3], [11.5, -7.5, 1.1], [-11, 3, 1.4]] as const).forEach(([x, z, size], i) => {
    b.box(size, size, size, lam(i % 2 ? P.leafA : P.leafB), x, size / 2, z);
  });
  const root = b.finish();

  let index = 0, adTime = 0, glitch = 0, lastSecond = -1;
  showAd(0);

  return {
    root,
    update(time, dt) {
      ticker.offset.x += dt * 0.06;
      boardRoot.position.y = 21.6 + Math.sin(time * 1.5) * 0.45;
      ring.rotation.z += dt * 0.6;
      for (const s of sparks) {
        s.y += dt * s.speed;
        if (s.y > 12) s.y = 0.6;
        s.angle += dt * 0.7;
        const radius = 2 + s.y * 0.3;
        s.spark.position.set(radius * Math.cos(s.angle), s.y, BOARD_Z + radius * Math.sin(s.angle));
      }
      if (playing === 0) return;
      adTime += dt;
      if (playing > 1 && adTime > AD_SECONDS) {
        index = (index + 1) % playing;
        adTime = 0;
        glitch = 0.3;
      }
      if (glitch > 0) {
        glitch -= dt;
        noise();
        if (glitch <= 0) showAd(index);
      } else if (index === 2) {
        const second = Math.floor(Date.now() / 1000);
        if (second !== lastSecond) {
          lastSecond = second;
          showAd(index);
        }
      }
    },
    dispose: () => b.disposeAll(),
  };
}
