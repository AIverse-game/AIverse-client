import type { ParcelView } from '@aiverse/protocol';
import * as Phaser from 'phaser';
import { facilityShape } from './facilityGeometry';
import type { MapProjection } from './layout';

const DARK = 0x29294a;
const TOP = 0x45416e;
const CYAN = 0x38e8ff;
const VIOLET = 0xc878ff;

/** Isometric models share a square plinth, lit glass edges and an open interior. */
export function drawFacility(
  graphics: Phaser.GameObjects.Graphics,
  projection: MapProjection,
  parcel: ParcelView,
  parcelSize: number,
  activeContents: number,
): void {
  const { x, y, side, floorHeight, high, isArcade } = facilityShape(parcel, parcelSize);
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
    const b = point(bx + w, by, floorHeight), c = point(bx + w, by + d, floorHeight), e = point(bx, by + d, floorHeight);
    const at = point(bx, by, height), bt = point(bx + w, by, height), ct = point(bx + w, by + d, height), et = point(bx, by + d, height);
    polygon([b, c, ct, bt], color, 0.9);
    polygon([e, c, ct, et], DARK, 0.95);
    polygon([at, bt, ct, et], color, 1);
    line(at, bt, glow, 2);
    line(bt, ct, glow, 2);
  };

  const f = parcel.facility!;
  const a = point(0, 0, floorHeight), b = point(side, 0, floorHeight);
  const c = point(side, side, floorHeight), d = point(0, side, floorHeight);
  polygon([point(side, 0), point(side, side), c, b], DARK);
  polygon([point(0, side), point(side, side), c, d], 0x363359);
  polygon([a, b, c, d], TOP);
  if (isArcade) {
    // The hall fills nearly the whole plot. Layered side rails and panel seams
    // keep its raised plinth readable even when the glass is empty.
    for (const height of [0.17, 0.6]) {
      const color = height < 0.3 ? VIOLET : CYAN;
      line(point(0, side, height), point(side, side, height), color, height < 0.3 ? 3 : 5, 0.9);
      line(point(side, 0, height), point(side, side, height), color, height < 0.3 ? 3 : 5, 0.9);
    }
    for (let tile = 1; tile < 5; tile++) {
      const offset = (side * tile) / 5;
      line(point(offset, side, 0.1), point(offset, side, floorHeight - 0.08), 0x746c9e, 1.5, 0.8);
      line(point(side, offset, 0.1), point(side, offset, floorHeight - 0.08), 0x746c9e, 1.5, 0.8);
    }
    const inset = side * 0.07;
    polygon([
      point(inset, inset, floorHeight + 0.01), point(side - inset, inset, floorHeight + 0.01),
      point(side - inset, side - inset, floorHeight + 0.01), point(inset, side - inset, floorHeight + 0.01),
    ], 0x302e56);
    for (let tile = 1; tile < 7; tile++) {
      const offset = inset + ((side - 2 * inset) * tile) / 7;
      line(point(offset, inset, floorHeight + 0.02), point(offset, side - inset, floorHeight + 0.02), 0x5c5682, 1, 0.55);
      line(point(inset, offset, floorHeight + 0.02), point(side - inset, offset, floorHeight + 0.02), 0x5c5682, 1, 0.55);
    }
    // Floor lanes remain visible before any game is installed.
    for (const offset of [0.37, 0.42, 0.58, 0.63]) {
      const color = offset < 0.5 ? CYAN : VIOLET;
      line(point(side * offset, side * 0.13, floorHeight + 0.04),
        point(side * offset, side * 0.87, floorHeight + 0.04), color, 3, 0.85);
    }
    for (const [px, py] of [[0.04, 0.04], [0.88, 0.04], [0.88, 0.88], [0.04, 0.88]] as const) {
      box(side * px, side * py, side * 0.08, side * 0.08, 1.85, DARK, VIOLET);
      box(side * (px + 0.015), side * (py + 0.015), side * 0.05, side * 0.05, 2.05, 0xffbd64, 0xffbd64);
    }
  } else {
    for (const [first, second] of [[d, c], [b, c]] as const) line(first, second, CYAN, 5);
  }

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
    if (isArcade) line(point(dx, dy, floorHeight), point(dx, dy, high), CYAN, 10, 0.18);
    line(point(dx, dy, floorHeight), point(dx, dy, high), CYAN, 3, 0.9);
    const [nx, ny] = corners[(i + 1) % corners.length]!;
    if (isArcade) line(point(dx, dy, high), point(nx, ny, high), CYAN, 10, 0.18);
    line(point(dx, dy, high), point(nx, ny, high), CYAN, 3, 0.9);
  }
  polygon([d, c, point(side, side, high), point(0, side, high)], 0x7ce5ff, 0.055);
  polygon([b, c, point(side, side, high), point(side, 0, high)], 0x7ce5ff, 0.055);
  if (isArcade) {
    // A lit entrance sits in the near glass wall rather than obscuring the floor.
    const left = point(side * 0.34, side, floorHeight);
    const right = point(side * 0.66, side, floorHeight);
    const leftTop = point(side * 0.34, side, 3.15);
    const rightTop = point(side * 0.66, side, 3.15);
    line(left, leftTop, VIOLET, 6);
    line(right, rightTop, VIOLET, 6);
    line(leftTop, rightTop, CYAN, 6);
    line(point(side * 0.34, side, floorHeight + 0.18), point(side * 0.66, side, floorHeight + 0.18), CYAN, 5);
  }
}

type BoxDrawer = (x: number, y: number, w: number, d: number, h: number, color: number, glow?: number) => void;

function drawArcadeContents(contents: number, side: number, box: BoxDrawer): void {
  for (let index = 0; index < contents; index++) {
    const col = index % 3, row = Math.floor(index / 3);
    const x = side * (0.14 + col * 0.28), y = side * (0.2 + row * 0.37);
    box(x, y, side * 0.18, side * 0.18, 2.8, 0x35375f, index % 2 ? VIOLET : CYAN);
    box(x + side * 0.025, y + side * 0.02, side * 0.13, side * 0.03, 2.35, index % 2 ? VIOLET : CYAN);
  }
}

function drawAdContents(contents: number, side: number, box: BoxDrawer): void {
  for (let index = 0; index < contents; index++) {
    const x = side * (0.2 + (index % 3) * 0.28), y = side * (0.28 + Math.floor(index / 3) * 0.32);
    box(x, y, side * 0.1, side * 0.1, 1.5 + index * 0.1, index % 2 ? VIOLET : CYAN);
  }
}
