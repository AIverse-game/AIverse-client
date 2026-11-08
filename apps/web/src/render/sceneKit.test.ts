import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { lam, ModelBuilder } from './sceneKit';

const meshes = (root: THREE.Object3D) => root.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
const box = (mesh: THREE.Mesh) => new THREE.Box3().setFromObject(mesh);

describe('ModelBuilder', () => {
  it('merges the boxes of one material into a single mesh', () => {
    const b = new ModelBuilder();

    b.box(2, 2, 2, lam(0xaa0000), 0, 1, 0);
    b.box(2, 2, 2, lam(0xaa0000), 10, 1, 0);
    b.box(1, 1, 1, lam(0x00aa00), 0, 0, 0);
    const root = b.finish();

    expect(meshes(root)).toHaveLength(2);
    const red = meshes(root).find((mesh) => mesh.material === lam(0xaa0000))!;
    expect(box(red).min.x).toBeCloseTo(-1);
    expect(box(red).max.x).toBeCloseTo(11);
  });

  it('moves and turns the boxes of a group, as a Three.js group would', () => {
    const b = new ModelBuilder();

    b.group(5, 0, 0, Math.PI / 2, () => b.box(4, 2, 2, lam(0x0000aa), 3, 1, 0));
    const [mesh] = meshes(b.finish());

    const centre = box(mesh!).getCenter(new THREE.Vector3());
    expect(centre.x).toBeCloseTo(5);
    expect(centre.y).toBeCloseTo(1);
    expect(centre.z).toBeCloseTo(-3);
    // Turned a quarter, the box's 4-unit length now runs along z.
    expect(box(mesh!).getSize(new THREE.Vector3()).z).toBeCloseTo(4);
  });

  it('places an object that is not merged in the current group', () => {
    const b = new ModelBuilder();
    const spinner = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff));

    b.group(10, 2, 0, 0, () => b.add(spinner, 1, 1, 0));
    b.finish();

    expect(spinner.parent).toBe(b.root);
    expect(spinner.position.x).toBeCloseTo(11);
    expect(spinner.position.y).toBeCloseTo(3);
  });
});
