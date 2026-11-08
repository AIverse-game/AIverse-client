// Coordinates and axis labels. Positions arrive in map units with the origin at the north-west
// corner and y pointing south; how the map is seen is up to the camera in `mapCamera.ts`.

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
