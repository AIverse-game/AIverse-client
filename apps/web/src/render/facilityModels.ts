import type { ParcelView } from '@aiverse/protocol';
import * as Phaser from 'phaser';
import type { MapProjection } from './layout';

const DARK = 0x29294a;
const TOP = 0x45416e;
const CYAN = 0x38e8ff;
const VIOLET = 0xc878ff;

/** Small isometric models share a square plinth, lit glass edges and an open interior. */
export function drawFacility(
  graphics: Phaser.GameObjects.Graphics,
  projection: MapProjection,
  parcel: ParcelView,
  parcelSize: number,
  activeContents: number,
): void {
  const x = parcel.col * parcelSize + parcelSize * 0.12;
  const y = parcel.row * parcelSize + parcelSize * 0.12;
  const side = parcelSize * 0.76;
  const point = (dx: number, dy: number, h = 0) => projection.toScreen({ x: x + dx, y: y + dy }, h);
  const polygon = (points: ReturnType<typeof point>[], color: number, alpha = 1) => {
    graphics.fillStyle(color, alpha);
    graphics.fillPoints(points.map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
  };
  const line = (a: ReturnType<typeof point>, b: ReturnType<typeof point>, color: number, width = 3, alpha = 1) => {
    graphics.lineStyle(width, color, alpha);
    graphics.lineBetween(a.x, a.y, b.x, b.y);
  };
  const box = (bx: number, by: number, w: number, d: number, height: number, color: number, glow = CYAN) => {
    const b = point(bx + w, by, 0.3), c = point(bx + w, by + d, 0.3), e = point(bx, by + d, 0.3);
    const at = point(bx, by, height), bt = point(bx + w, by, height), ct = point(bx + w, by + d, height), et = point(bx, by + d, height);
    polygon([b, c, ct, bt], color, 0.9);
    polygon([e, c, ct, et], DARK, 0.95);
    polygon([at, bt, ct, et], color, 1);
    line(at, bt, glow, 2);
    line(bt, ct, glow, 2);
  };

  const f = parcel.facility!;
  const a = point(0, 0, 0.3), b = point(side, 0, 0.3), c = point(side, side, 0.3), d = point(0, side, 0.3);
  polygon([point(side, 0), point(side, side), c, b], DARK);
  polygon([point(0, side), point(side, side), c, d], 0x363359);
  polygon([a, b, c, d], TOP);
  for (const [first, second] of [[d, c], [b, c]] as const) line(first, second, CYAN, 5);

  if (f.kind === 'portal') {
    box(side * 0.2, side * 0.2, side * 0.6, side * 0.6, 0.7, DARK, VIOLET);
    const centre = point(side / 2, side / 2, 2.2);
    graphics.lineStyle(12, VIOLET, 0.6);
    graphics.strokeEllipse(centre.x, centre.y, 70, 95);
    graphics.lineStyle(5, CYAN, 1);
    graphics.strokeEllipse(centre.x, centre.y, 58, 83);
    graphics.fillStyle(CYAN, 0.18);
    graphics.fillEllipse(centre.x, centre.y, 50, 75);
    return;
  }

  // Glass sides are translucent so content added later stays visible.
  const high = f.kind === 'ad' ? 2.6 : 3.2;
  polygon([a, b, point(side, 0, high), point(0, 0, high)], 0x50cbeb, 0.08);
  polygon([a, d, point(0, side, high), point(0, 0, high)], 0x50cbeb, 0.08);

  if (f.kind === 'game_hall') drawArcadeContents(activeContents, side, box);
  if (f.kind === 'ad') drawAdContents(activeContents, side, box);
  if (f.kind === 'workspace') {
    box(side * 0.18, side * 0.22, side * 0.25, side * 0.25, 0.9, 0x596188);
    box(side * 0.55, side * 0.45, side * 0.25, side * 0.25, 0.9, 0x596188);
    box(side * 0.19, side * 0.25, side * 0.21, side * 0.04, 1.15, CYAN);
    box(side * 0.56, side * 0.48, side * 0.21, side * 0.04, 1.15, CYAN);
  }

  const corners = [[0, 0], [side, 0], [side, side], [0, side]] as const;
  for (let i = 0; i < corners.length; i++) {
    const [dx, dy] = corners[i]!;
    line(point(dx, dy, 0.3), point(dx, dy, high), CYAN, 3, 0.8);
    const [nx, ny] = corners[(i + 1) % corners.length]!;
    line(point(dx, dy, high), point(nx, ny, high), CYAN, 3, 0.9);
  }
  polygon([d, c, point(side, side, high), point(0, side, high)], 0x7ce5ff, 0.055);
  polygon([b, c, point(side, side, high), point(side, 0, high)], 0x7ce5ff, 0.055);
  if (f.kind === 'game_hall') line(point(0, side * 0.52, 0.3), point(0, side * 0.52, 2.2), VIOLET, 5);
}

type BoxDrawer = (x: number, y: number, w: number, d: number, h: number, color: number, glow?: number) => void;

function drawArcadeContents(contents: number, side: number, box: BoxDrawer): void {
  for (let index = 0; index < contents; index++) {
    const col = index % 3, row = Math.floor(index / 3);
    const x = side * (0.14 + col * 0.28), y = side * (0.2 + row * 0.37);
    box(x, y, side * 0.18, side * 0.18, 1.9, 0x35375f, index % 2 ? VIOLET : CYAN);
    box(x + side * 0.025, y + side * 0.02, side * 0.13, side * 0.03, 1.55, index % 2 ? VIOLET : CYAN);
  }
}

function drawAdContents(contents: number, side: number, box: BoxDrawer): void {
  for (let index = 0; index < contents; index++) {
    const x = side * (0.2 + (index % 3) * 0.28), y = side * (0.28 + Math.floor(index / 3) * 0.32);
    box(x, y, side * 0.1, side * 0.1, 1.5 + index * 0.1, index % 2 ? VIOLET : CYAN);
  }
}
