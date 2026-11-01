import { type MapProjection } from './layout';

/** Each supplied image contains 4 × 4 panels, yielding 20 panels across the map. */
const TILES_PER_SIDE = 5;
/** Prefer quiet panels, with occasional bright junctions and strips. */
const VARIANTS = [1, 2, 1, 3, 2, 1, 2, 0] as const;

/** Read source pixels once after loading; the original image files stay unchanged. */
export function readFloorSources(images: readonly HTMLImageElement[]): ImageData[] {
  return images.map((image) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Cannot read floor texture pixels');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  });
}

/**
 * Paint a static ground surface by inverse projection. Every visible canvas pixel looks
 * up the same map coordinate as clicking it does. This avoids gaps between warped tiles
 * and matches the map's perspective exactly, including its smaller far edge.
 * Called only on initial layout or map-size changes, never per frame or state update.
 */
export function paintFloorSurface(
  context: CanvasRenderingContext2D,
  sources: readonly ImageData[],
  projection: MapProjection,
  size: number,
): void {
  const { width, height } = context.canvas;
  const surface = context.createImageData(width, height);
  const tiles = Array.from({ length: TILES_PER_SIDE }, (_, x) =>
    Array.from({ length: TILES_PER_SIDE }, (_, y) => {
      const hash = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0;
      return sources[VARIANTS[hash % VARIANTS.length]!]!;
    }),
  );
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const position = projection.toMap(x + 0.5, y + 0.5);
      if (!position) continue;
      const u = (position.x / size) * TILES_PER_SIDE;
      const v = (position.y / size) * TILES_PER_SIDE;
      const column = Math.min(Math.floor(u), TILES_PER_SIDE - 1);
      const row = Math.min(Math.floor(v), TILES_PER_SIDE - 1);
      const source = tiles[column]![row]!;
      const sx = Math.min(Math.floor((u - column) * source.width), source.width - 1);
      const sy = Math.min(Math.floor((v - row) * source.height), source.height - 1);
      const from = (sy * source.width + sx) * 4;
      const to = (y * width + x) * 4;
      surface.data[to] = source.data[from]!;
      surface.data[to + 1] = source.data[from + 1]!;
      surface.data[to + 2] = source.data[from + 2]!;
      surface.data[to + 3] = source.data[from + 3]!;
    }
  }
  context.putImageData(surface, 0, 0);
}
