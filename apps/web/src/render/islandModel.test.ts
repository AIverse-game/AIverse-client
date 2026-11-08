import { blockRects, islandRect } from '@aiverse/protocol';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createIslandRock, islandLinks } from './islandModel';

const islands = blockRects({ size: 150, parcelSize: 10, blockCells: 3 }).map(islandRect);

describe('islandLinks', () => {
  it('links every island to its eastern and southern neighbour, at the middle of the sides that face', () => {
    const links = islandLinks(islands);

    expect(links).toHaveLength(40);
    expect(links[0]).toEqual({ a: { x: 28.5, z: 15 }, b: { x: 31.5, z: 15 }, dx: 1, dz: 0 });
    expect(links[1]).toEqual({ a: { x: 15, z: 28.5 }, b: { x: 15, z: 31.5 }, dx: 0, dz: 1 });
  });

  it('links nothing for a single island', () => {
    expect(islandLinks(islands.slice(0, 1))).toEqual([]);
  });
});

describe('createIslandRock', () => {
  it('merges all islands into a few meshes that hang below the top plate', () => {
    const { root, dispose } = createIslandRock(islands);

    const meshes = root.children.filter((child) => child instanceof THREE.Mesh);
    const bounds = new THREE.Box3().setFromObject(root);
    expect(meshes.length).toBeLessThanOrEqual(6);
    expect(bounds.max.y).toBeLessThanOrEqual(0);
    expect(bounds.min.y).toBeLessThan(-8);
    dispose();
  });
});
