import type { Position } from '@aiverse/protocol';

// Screen geometry is presentation only. Positions arrive in map units with the
// origin at the north-west corner and y pointing south. The map is drawn as a
// ground plane seen from a fixed camera above it, Don't Starve style: turned 45° so
// the origin sits at the far (top) corner, tilted so the far side is smaller.

/** The full map is three viewport widths high-resolution pixels, so sprites keep their size. */
export const MAP_DISPLAY_SCALE = 3;
export const CANVAS_WIDTH = 1200 * MAP_DISPLAY_SCALE;
export const CANVAS_HEIGHT = 1000 * MAP_DISPLAY_SCALE;
/** Space around the map for axis labels and residents standing on the edge. */
export const MARGIN = 48 * MAP_DISPLAY_SCALE;
/** Extra space above the map so a resident at the far corner keeps its head and name. */
export const HEADROOM = 48 * MAP_DISPLAY_SCALE;

/** Camera heading: 45° puts the origin at the top corner, x down-right, y down-left. */
const YAW = Math.PI / 4;
/** Angle between the line of sight and the ground. */
const PITCH = (40 * Math.PI) / 180;
/** Camera distance from the map centre, in map sides; smaller exaggerates perspective. */
const DISTANCE = 3.5;
/** Thickness of the earth under the map, as a fraction of the map side. */
export const SLAB_DEPTH = 0.05;

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface MapProjection {
  /** Canvas point of a map position, optionally raised `height` map units off the ground. */
  toScreen(position: Position, height?: number): ScreenPoint;
  /** How much larger things look at a ground position than at the map centre. */
  scaleAt(position: Position): number;
  /** Ground position under a canvas point, or null outside the map. */
  toMap(x: number, y: number): Position | null;
}

/** Put a machine beside the pool marker while keeping its base within mining reach. */
export function rigPositionOnPool(pool: { position: Position; radius: number }): Position {
  const distance = pool.radius * 0.55;
  return {
    x: pool.position.x + distance,
    y: pool.position.y,
  };
}

const cosYaw = Math.cos(YAW);
const sinYaw = Math.sin(YAW);
const cosPitch = Math.cos(PITCH);
const sinPitch = Math.sin(PITCH);

/**
 * Perspective image of a point given in map sides relative to the map centre:
 * `u` east, `v` south, `h` up. Returns the image-plane point (y down) and the
 * distance from the camera along its line of sight.
 */
function camera(u: number, v: number, h: number): { a: number; b: number; depth: number } {
  // Turn the map, then express the point in the tilted camera's frame.
  const across = u * cosYaw - v * sinYaw;
  const toward = u * sinYaw + v * cosYaw;
  const depth = DISTANCE - h * sinPitch - toward * cosPitch;
  return { a: across / depth, b: (toward * sinPitch - h * cosPitch) / depth, depth };
}

export function projectMap(size: number): MapProjection {
  // Fit the whole slab, top and bottom edges, inside the margins.
  const corners = [-0.5, 0.5].flatMap((u) =>
    [-0.5, 0.5].flatMap((v) => [camera(u, v, 0), camera(u, v, -SLAB_DEPTH)]),
  );
  const as = corners.map((c) => c.a);
  const bs = corners.map((c) => c.b);
  const [minA, maxA, minB, maxB] = [Math.min(...as), Math.max(...as), Math.min(...bs), Math.max(...bs)];
  const zoom = Math.min(
    (CANVAS_WIDTH - 2 * MARGIN) / (maxA - minA),
    (CANVAS_HEIGHT - 2 * MARGIN - HEADROOM) / (maxB - minB),
  );
  const originX = CANVAS_WIDTH / 2 - (zoom * (minA + maxA)) / 2;
  const originY = (CANVAS_HEIGHT + HEADROOM) / 2 - (zoom * (minB + maxB)) / 2;

  return {
    toScreen({ x, y }, height = 0) {
      const { a, b } = camera(x / size - 0.5, y / size - 0.5, height / size);
      return { x: originX + zoom * a, y: originY + zoom * b };
    },
    scaleAt({ x, y }) {
      return DISTANCE / camera(x / size - 0.5, y / size - 0.5, 0).depth;
    },
    toMap(x, y) {
      // Intersect the line of sight through the canvas point with the ground.
      const a = (x - originX) / zoom;
      const b = (y - originY) / zoom;
      const denominator = sinPitch + b * cosPitch;
      if (denominator <= 0) return null; // At or above the horizon.
      const toward = (b * DISTANCE) / denominator;
      const across = a * (DISTANCE - toward * cosPitch);
      const east = (across * cosYaw + toward * sinYaw + 0.5) * size;
      const south = (toward * cosYaw - across * sinYaw + 0.5) * size;
      // Rounding can put a point on the edge a hair outside; keep it on the map.
      const slack = size * 1e-9;
      const inside = east >= -slack && south >= -slack && east <= size + slack && south <= size + slack;
      const clamp = (value: number) => Math.min(Math.max(value, 0), size);
      return inside ? { x: clamp(east), y: clamp(south) } : null;
    },
  };
}

/** Round-numbered tick values from 0 to `size`, roughly `target` intervals per axis. */
export function axisTicks(size: number, target = 10): number[] {
  const rough = size / target;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const ticks: number[] = [];
  // Multiply instead of accumulating so fractional steps do not drift.
  for (let i = 0; i * step <= size * (1 + 1e-9); i++) ticks.push(Number((i * step).toPrecision(12)));
  return ticks;
}

/** Short, stable text for a coordinate: at most two decimals, no trailing zeros. */
export function formatCoordinate(value: number): string {
  return String(Math.round(value * 100) / 100);
}
