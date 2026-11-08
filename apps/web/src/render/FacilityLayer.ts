import { parcelRect, type FacilityView, type MapGridSpec, type ParcelView } from '@aiverse/protocol';
import * as THREE from 'three';
import { createArcade } from './arcadeModel';
import { createBillboard } from './billboardModel';
import { plotShape } from './plotShape';
import { createPortal } from './portalModel';
import type { ModelHandle } from './sceneKit';
import { createWorkspace } from './workspaceModel';

interface Built {
  signature: string;
  handle: ModelHandle;
  wrapper: THREE.Group;
  /** Invisible box that stands for the facility under the pointer; portals have none. */
  target: THREE.Mesh | null;
}

function create(kind: FacilityView['kind'], contents: number): ModelHandle {
  switch (kind) {
    case 'ad': return createBillboard(contents);
    case 'game_hall': return createArcade(contents);
    case 'workspace': return createWorkspace();
    case 'portal': return createPortal();
  }
}

/** The facility models on their parcels, each rebuilt only when its kind or the content it shows changes. */
export class FacilityLayer {
  private readonly root = new THREE.Group();
  private readonly built = new Map<string, Built>();
  private layoutKey = '';
  private map: MapGridSpec = { size: 1, parcelSize: 1, blockCells: 1, road: 0 };

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
  }

  /** Brings the models in line with the parcels; `contents` says how many items a facility shows now. */
  sync(parcels: readonly ParcelView[], map: MapGridSpec, contents: (facility: FacilityView) => number): void {
    const layoutKey = `${map.size}:${map.parcelSize}:${map.blockCells}:${map.road}`;
    if (layoutKey !== this.layoutKey) this.clear();
    this.layoutKey = layoutKey;
    this.map = map;
    const present = new Set<string>();
    for (const parcel of parcels) {
      const facility = parcel.facility;
      if (!facility) continue;
      present.add(parcel.id);
      const shown = facility.kind === 'ad' || facility.kind === 'game_hall' ? contents(facility) : 0;
      const signature = `${facility.kind}:${shown}`;
      if (this.built.get(parcel.id)?.signature === signature) continue;
      this.remove(parcel.id);
      this.built.set(parcel.id, this.place(parcel, facility.kind, shown, signature));
    }
    for (const id of [...this.built.keys()]) if (!present.has(id)) this.remove(id);
  }

  /** The invisible boxes to test a pointer ray against; each remembers its parcel in `userData`. */
  targets(): THREE.Object3D[] {
    return [...this.built.values()].flatMap((built) => (built.target ? [built.target] : []));
  }

  update(time: number, dt: number): void {
    for (const { handle } of this.built.values()) handle.update(time, dt);
  }

  dispose(): void {
    this.clear();
  }

  private place(parcel: ParcelView, kind: FacilityView['kind'], contents: number, signature: string): Built {
    const shape = plotShape(kind, parcelRect(this.map, parcel.col, parcel.row));
    const handle = create(kind, contents);
    const wrapper = new THREE.Group();
    wrapper.position.set(shape.centre.x, shape.floor, shape.centre.y);
    wrapper.scale.setScalar(shape.scale);
    wrapper.add(handle.root);
    this.root.add(wrapper);
    let target: THREE.Mesh | null = null;
    if (kind !== 'portal') {
      target = new THREE.Mesh(new THREE.BoxGeometry(shape.side, shape.height, shape.side), new THREE.MeshBasicMaterial({ visible: false }));
      target.position.set(shape.centre.x, shape.height / 2, shape.centre.y);
      target.userData = { parcelId: parcel.id };
      this.root.add(target);
    }
    return { signature, handle, wrapper, target };
  }

  private remove(id: string): void {
    const built = this.built.get(id);
    if (!built) return;
    this.root.remove(built.wrapper);
    built.handle.dispose();
    if (built.target) {
      this.root.remove(built.target);
      built.target.geometry.dispose();
      (built.target.material as THREE.Material).dispose();
    }
    this.built.delete(id);
  }

  private clear(): void {
    for (const id of [...this.built.keys()]) this.remove(id);
  }
}
