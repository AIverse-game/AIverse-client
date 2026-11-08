import { lam, glow, ModelBuilder, PALETTE as P } from './sceneKit';

/** A blocky tree. `size` 1 is the billboard demo's tree, about 1.2 the lobby demo's. */
export function tree(b: ModelBuilder, x: number, z: number, leafA: number, leafB: number, size = 1): void {
  b.box(1.4 * size, 5 * size, 1.4 * size, lam(P.trunk), x, 2.5 * size, z);
  const leaves = [[0, 6, 0, 4.2, leafA], [0, 8.2, 0, 3, leafB], [-1.5, 6.4, 1.2, 2, leafB], [1.6, 6.8, -0.9, 1.8, leafA], [0, 9.8, 0, 1.6, leafA]] as const;
  for (const [dx, y, dz, s, color] of leaves) b.box(s * size, s * size, s * size, lam(color), x + dx * size, y * size, z + dz * size);
}

export function bench(b: ModelBuilder, x: number, z: number, ry: number): void {
  b.group(x, 0, z, ry, () => {
    b.box(6, 0.5, 2, lam(P.desk), 0, 2.2, 0);
    b.box(6, 2, 0.4, lam(P.desk), 0, 3.6, 0.9);
    b.box(0.5, 2, 1.8, lam(P.furn), -2.6, 1, 0);
    b.box(0.5, 2, 1.8, lam(P.furn), 2.6, 1, 0);
  });
}

/** A lamp on a post; `pole` is the height of the post. */
export function lamp(b: ModelBuilder, x: number, z: number, pole: number): void {
  b.box(1.2, 0.4, 1.2, lam(P.dark), x, 0.2, z);
  b.box(0.5, pole, 0.5, lam(P.furn), x, 0.4 + pole / 2, z);
  b.box(1.1, 1.1, 1.1, glow(P.amber), x, 0.95 + pole, z);
}

export function plant(b: ModelBuilder, x: number, z: number, size: number): void {
  b.box(3 * size, 2.6 * size, 3 * size, lam(P.pot), x, 1.3 * size, z);
  const blocks = [[0, 4, 0, 2.2, 0], [-1, 5.5, 0.5, 1.6, 1], [1, 5, -0.8, 1.6, 1], [0.3, 6.8, 0, 1.3, 0], [-0.9, 3.8, 1, 1.2, 1], [1.1, 3.7, 0.9, 1.1, 0]] as const;
  for (const [dx, y, dz, s, light] of blocks) {
    b.box(s * size, s * size, s * size, lam(light ? P.leafB : P.leafA), x + dx * size, y * size, z + dz * size);
  }
}
