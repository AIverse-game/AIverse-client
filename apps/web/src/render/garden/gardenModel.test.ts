import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GardenMaterials } from './GardenMaterials';
import { createGarden, GARDEN_SLAB, GARDEN_SPAN, GARDEN_TOP } from './gardenModel';

const meshes = (root: THREE.Object3D) => {
  const found: THREE.Mesh[] = [];
  root.traverse((object) => { if (object instanceof THREE.Mesh) found.push(object); });
  return found;
};

describe('createGarden', () => {
  it('stays within its slab and its height, and the slab goes down GARDEN_SLAB below the ground', () => {
    const materials = new GardenMaterials();
    const garden = createGarden(materials);

    garden.update(3, 0.016);
    const box = new THREE.Box3().setFromObject(garden.root);

    // The corner pillars' caps reach 0.3 past the slab.
    const half = GARDEN_SPAN / 2 + 0.3;
    expect(box.min.x).toBeGreaterThanOrEqual(-half);
    expect(box.max.x).toBeLessThanOrEqual(half);
    expect(box.min.z).toBeGreaterThanOrEqual(-half);
    expect(box.max.z).toBeLessThanOrEqual(half);
    expect(box.min.y).toBeCloseTo(-GARDEN_SLAB);
    expect(box.max.y).toBeLessThanOrEqual(GARDEN_TOP);
    expect(box.max.y).toBeGreaterThan(GARDEN_TOP - 2);
  });

  it('costs a few dozen meshes, not one for each block', () => {
    const garden = createGarden(new GardenMaterials());

    expect(meshes(garden.root).length).toBeLessThan(70);
  });

  it('draws with the shared materials, so a recolour reaches it', () => {
    const materials = new GardenMaterials();
    const garden = createGarden(materials);

    const used = new Set(meshes(garden.root).map((mesh) => mesh.material));

    expect(used.has(materials.lit('canopy0'))).toBe(true);
    expect(used.has(materials.lantern)).toBe(true);
  });

  it('gives every vertex of a swaying material the two wind numbers, and those of other materials none', () => {
    const materials = new GardenMaterials();
    const garden = createGarden(materials);

    for (const mesh of meshes(garden.root)) {
      expect(mesh.geometry.hasAttribute('aSway')).toBe(materials.isSwaying(mesh.material as THREE.Material));
    }
  });

  it('hangs the wisteria and lifts the flowers more the further a vertex is from where they are rooted', () => {
    const materials = new GardenMaterials();
    const garden = createGarden(materials);
    const tulips = meshes(garden.root).find((mesh) => mesh.material === materials.lit('bed0'))!;

    const arm = tulips.geometry.getAttribute('aSway') as THREE.BufferAttribute;
    const reach = Array.from({ length: arm.count }, (_, i) => arm.getY(i));

    expect(Math.min(...reach)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...reach)).toBeGreaterThan(1);
    expect(Math.max(...reach)).toBeLessThan(2.5);
  });

  it('shows the fireflies only when it is dark', () => {
    const materials = new GardenMaterials();
    const garden = createGarden(materials);
    const fireflies = meshes(garden.root).find((mesh) => mesh.material === materials.firefly)!;

    materials.setDaylight(1);
    garden.update(1, 0.016);
    const byDay = fireflies.visible;
    materials.setDaylight(0);
    garden.update(2, 0.016);

    expect(byDay).toBe(false);
    expect(fireflies.visible).toBe(true);
  });

  it('moves its fish, butterflies and drops as time goes on', () => {
    const garden = createGarden(new GardenMaterials());
    const critters = meshes(garden.root).find((mesh): mesh is THREE.InstancedMesh => mesh instanceof THREE.InstancedMesh && mesh.count > 30)!;
    const first = new THREE.Matrix4();
    const later = new THREE.Matrix4();

    garden.update(1, 0.016);
    critters.getMatrixAt(14, first);
    garden.update(4, 0.016);
    critters.getMatrixAt(14, later);

    expect(later.equals(first)).toBe(false);
  });

  it('releases what it holds when it is disposed', () => {
    const garden = createGarden(new GardenMaterials());
    const geometry = meshes(garden.root)[0]!.geometry;
    let freed = 0;
    geometry.addEventListener('dispose', () => freed++);

    garden.dispose();

    expect(freed).toBe(1);
  });
});
