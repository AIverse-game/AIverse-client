import { blockRectOf, islandRect, parcelRect, type MapGridSpec, type ParcelView } from '@aiverse/protocol';
import * as THREE from 'three';
import type { FacilityAnchor } from '../FacilityLayer';
import { floorHeightAt, plotShape, type PlotShape } from '../plotShape';
import type { ModelHandle } from '../sceneKit';
import { environmentAt, type EnvironmentOverride, type GardenEnvironment } from './gardenClock';
import { GardenMaterials } from './GardenMaterials';
import { createGarden } from './gardenModel';

/** The daylight changes smoothly, so the materials are only touched when it has moved this far since they last were. */
const DAYLIGHT_STEP = 0.004;

interface Built {
  handle: ModelHandle;
  wrapper: THREE.Group;
  /** Invisible box that stands for the garden under the pointer. */
  target: THREE.Mesh;
  anchor: FacilityAnchor;
  shape: PlotShape;
}

/**
 * The gardens on the map, a rendering layer of its own: it owns the gardens' materials and the one
 * place that decides their season and light (`environment`, from the game's clock unless overridden),
 * and builds a garden when a parcel gets one. A garden is built once; season and daylight only change
 * the shared materials, so they cost nothing however many gardens there are.
 */
export class GardenLayer {
  private readonly root = new THREE.Group();
  private readonly materials = new GardenMaterials();
  private readonly built = new Map<string, Built>();
  private override: EnvironmentOverride | null = null;
  private shown: GardenEnvironment | null = null;
  private layoutKey = '';

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
  }

  /** Brings the gardens in line with the parcels; a garden that is already standing is left as it is. */
  sync(parcels: readonly ParcelView[], map: MapGridSpec): void {
    const layoutKey = `${map.size}:${map.parcelSize}:${map.blockCells}:${map.venueCells}`;
    if (layoutKey !== this.layoutKey) this.clear();
    this.layoutKey = layoutKey;
    const present = new Set<string>();
    for (const parcel of parcels) {
      if (parcel.facility?.kind !== 'garden') continue;
      present.add(parcel.id);
      if (!this.built.has(parcel.id)) this.built.set(parcel.id, this.place(parcel, map));
    }
    for (const id of [...this.built.keys()]) if (!present.has(id)) this.remove(id);
  }

  /** The invisible boxes to test a pointer ray against; each remembers its parcel in `userData`. */
  targets(): THREE.Object3D[] {
    return [...this.built.values()].map((built) => built.target);
  }

  /** Where effects over the garden on a parcel go, or null when it has none. */
  anchor(parcelId: string): FacilityAnchor | null {
    return this.built.get(parcelId)?.anchor ?? null;
  }

  /** Height of the garden's floor under a map position, 0 where no garden stands. */
  floorHeight(x: number, y: number): number {
    let height = 0;
    for (const { shape } of this.built.values()) height = Math.max(height, floorHeightAt(shape, x, y));
    return height;
  }

  /** Shows a fixed season or time of day instead of the clock's; null goes back to the clock. */
  setOverride(override: EnvironmentOverride | null): void {
    this.override = override;
  }

  /** The season and light the gardens are drawn in now. */
  environment(): GardenEnvironment | null {
    return this.shown;
  }

  /** `time` is seconds on a steady clock, `gameSeconds` the game's own, or null before it is known. */
  update(time: number, dt: number, gameSeconds: number | null): void {
    this.apply(environmentAt(gameSeconds, this.override));
    this.materials.update(time);
    for (const { handle } of this.built.values()) handle.update(time, dt);
  }

  dispose(): void {
    this.clear();
    this.materials.dispose();
    this.root.removeFromParent();
  }

  private apply(next: GardenEnvironment): void {
    const shown = this.shown;
    if (shown && shown.season === next.season && Math.abs(shown.daylight - next.daylight) < DAYLIGHT_STEP) return;
    if (!shown || shown.season !== next.season) this.materials.setSeason(next.season);
    this.materials.setDaylight(next.daylight);
    this.shown = next;
  }

  private place(parcel: ParcelView, map: MapGridSpec): Built {
    // Kept to the part of the parcel its island covers, like a venue, so it never hangs over the edge.
    const shape = plotShape('garden', parcelRect(map, parcel.col, parcel.row), islandRect(blockRectOf(map, parcel.col, parcel.row)));
    const handle = createGarden(this.materials);
    const wrapper = new THREE.Group();
    wrapper.position.set(shape.centre.x, shape.floor, shape.centre.y);
    wrapper.scale.setScalar(shape.scale);
    wrapper.add(handle.root);
    this.root.add(wrapper);
    const target = new THREE.Mesh(new THREE.BoxGeometry(shape.extent.x, shape.height, shape.extent.z), new THREE.MeshBasicMaterial({ visible: false }));
    target.position.set(shape.centre.x, shape.height / 2, shape.centre.y);
    target.userData = { parcelId: parcel.id };
    this.root.add(target);
    return { handle, wrapper, target, anchor: { top: new THREE.Vector3(shape.centre.x, shape.height, shape.centre.y), side: shape.side }, shape };
  }

  private remove(id: string): void {
    const built = this.built.get(id);
    if (!built) return;
    this.root.remove(built.wrapper, built.target);
    built.handle.dispose();
    built.target.geometry.dispose();
    (built.target.material as THREE.Material).dispose();
    this.built.delete(id);
  }

  private clear(): void {
    for (const id of [...this.built.keys()]) this.remove(id);
  }
}
