import type { Position } from '@aiverse/protocol';

// Screen geometry is presentation only. Positions arrive in map units with the
// origin at the top-left and y pointing down, so mapping to the canvas is a scale
// plus an offset; no axis is flipped.

/** Side of the drawn map in canvas pixels. */
export const MAP_PIXELS = 800;
/** Space around the map for axis labels and residents standing on the edge. */
export const MARGIN = 48;
export const CANVAS_SIZE = MAP_PIXELS + MARGIN * 2;

export interface MapProjection {
  /** Canvas pixels per map unit. */
  scale: number;
  toScreen(position: Position): { x: number; y: number };
  /** Map position under a canvas point, or null outside the map. */
  toMap(x: number, y: number): Position | null;
}

export function projectMap(size: number): MapProjection {
  const scale = MAP_PIXELS / size;
  return {
    scale,
    toScreen: ({ x, y }) => ({ x: MARGIN + x * scale, y: MARGIN + y * scale }),
    toMap(x, y) {
      const position = { x: (x - MARGIN) / scale, y: (y - MARGIN) / scale };
      const inside = position.x >= 0 && position.y >= 0 && position.x <= size && position.y <= size;
      return inside ? position : null;
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
