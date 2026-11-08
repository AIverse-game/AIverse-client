import * as THREE from 'three';

/** Each supplied image contains 4 × 4 panels, so the map is 5 × 5 images of them. */
export const FLOOR_TILES_PER_SIDE = 5;
/** Prefer quiet panels, with occasional bright junctions and strips. */
const VARIANTS = [1, 2, 1, 3, 2, 1, 2, 0] as const;
const TILE_PIXELS = 512;

/** Which of the four supplied images covers a floor tile, chosen by a fixed hash of its place. */
export function floorVariant(col: number, row: number): number {
  const hash = (Math.imul(col + 1, 73856093) ^ Math.imul(row + 1, 19349663)) >>> 0;
  return VARIANTS[hash % VARIANTS.length]!;
}

/** The metal floor of the whole map as one texture, tiled from the four supplied images. */
export function paintFloor(images: readonly HTMLImageElement[]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = FLOOR_TILES_PER_SIDE * TILE_PIXELS;
  const context = canvas.getContext('2d')!;
  for (let row = 0; row < FLOOR_TILES_PER_SIDE; row++) {
    for (let col = 0; col < FLOOR_TILES_PER_SIDE; col++) {
      context.drawImage(images[floorVariant(col, row)]!, col * TILE_PIXELS, row * TILE_PIXELS, TILE_PIXELS, TILE_PIXELS);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}
