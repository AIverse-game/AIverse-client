import { blockRectOf, blockRects, islandRect, parcelRect, venueRect, type MapGridSpec, type ParcelView, type Rect } from '@aiverse/protocol';
import * as THREE from 'three';
import floorCorners from '../assets/floor/metal-floor-corners.png';
import floorNodes from '../assets/floor/metal-floor-nodes.png';
import floorSparse from '../assets/floor/metal-floor-sparse.png';
import floorStrips from '../assets/floor/metal-floor-strips.png';
import { createIslandBridges, createIslandRock, islandLinks } from './islandModel';
import { paintFloor } from './mapFloor';
import type { ModelHandle } from './sceneKit';

const GRID_COLOR = 0x6e91a4;
const RIM_COLOR = 0x5fe3f2;
const OWNED_COLOR = 0x54cadc;
const SELECTED_COLOR = 0xffdb84;
const FRAME_WIDTH = 0.25;

/** Heights of the flat layers above the floor, so they never fight each other. */
const TINT_HEIGHT = 0.02;
const GRID_HEIGHT = 0.03;
const FRAME_HEIGHT = 0.07;

function quads(rects: Array<{ x0: number; z0: number; x1: number; z1: number }>, y: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const { x0, z0, x1, z1 } of rects) positions.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

/** One floating island per block, the light bridges between them, owned blocks' tint and the selected parcel's frame. */
export class GroundLayer {
  private readonly root = new THREE.Group();
  private fixed = new THREE.Group();
  private models: ModelHandle[] = [];
  private tint: THREE.Mesh | null = null;
  private frame: THREE.Mesh | null = null;
  private map: MapGridSpec = { size: 0, parcelSize: 0, blockCells: 1, venueCells: 1 };
  private tintSignature = '';
  private frameSignature = '';
  private floorMaterial: THREE.MeshBasicMaterial | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
  }

  /** Builds the parts that depend only on the layout of the map: an island per block, the light bridges between them, the lines on them. */
  build(map: MapGridSpec): void {
    const { size } = map;
    this.disposeModels();
    this.clear(this.fixed);
    this.root.remove(this.fixed);
    this.fixed = new THREE.Group();
    this.root.add(this.fixed);
    this.map = map;
    this.tintSignature = this.frameSignature = '\0';

    this.floorMaterial = new THREE.MeshBasicMaterial({ color: 0x1a2430 });
    this.loadFloor().catch((error: unknown) => console.error(error));

    const blocks = blockRects(map).map(islandRect);
    this.fixed.add(this.plates(blocks, size));
    this.models = [createIslandRock(blocks), createIslandBridges(islandLinks(blocks))];
    for (const model of this.models) this.root.add(model.root);

    const outline = (rect: Rect, y: number) => [
      rect.x0, y, rect.z0, rect.x1, y, rect.z0, rect.x1, y, rect.z0, rect.x1, y, rect.z1,
      rect.x1, y, rect.z1, rect.x0, y, rect.z1, rect.x0, y, rect.z1, rect.x0, y, rect.z0,
    ];
    this.fixed.add(this.lines(blocks.flatMap((rect) => outline(rect, GRID_HEIGHT + 0.01)), RIM_COLOR, 0.95));
    // The lines between the parcels of a block, from edge to edge of its island.
    const inner: number[] = [];
    const cells = Math.max(1, map.blockCells);
    blockRects(map).forEach((block, index) => {
      const island = blocks[index]!;
      for (let k = 1; k < cells; k++) {
        const x = block.x0 + k * map.parcelSize, z = block.z0 + k * map.parcelSize;
        inner.push(x, GRID_HEIGHT, island.z0, x, GRID_HEIGHT, island.z1, island.x0, GRID_HEIGHT, z, island.x1, GRID_HEIGHT, z);
      }
    });
    this.fixed.add(this.lines(inner, GRID_COLOR, 0.3));
  }

  /** Tints the islands of blocks that have an owner and frames the selected parcel, or the whole square of the venue on it; each is rebuilt only when it changed. */
  setParcels(parcels: readonly ParcelView[], selectedId: string | null): void {
    const tintSignature = parcels.map((parcel) => parcel.id).join('|');
    if (tintSignature !== this.tintSignature) {
      this.tintSignature = tintSignature;
      if (this.tint) this.disposeMesh(this.tint);
      const owned = new Map<string, Rect>();
      for (const parcel of parcels) {
        const block = blockRectOf(this.map, parcel.col, parcel.row);
        owned.set(`${block.x0}:${block.z0}`, islandRect(block));
      }
      this.tint = new THREE.Mesh(quads([...owned.values()], TINT_HEIGHT), new THREE.MeshBasicMaterial({ color: OWNED_COLOR, transparent: true, opacity: 0.16, depthWrite: false }));
      this.root.add(this.tint);
    }
    const selectedKind = parcels.find((parcel) => parcel.id === selectedId)?.facility?.kind;
    const venue = selectedKind === 'game_hall' || selectedKind === 'workspace';
    const frameSignature = `${selectedId ?? ''}:${venue}`;
    if (frameSignature !== this.frameSignature) {
      this.frameSignature = frameSignature;
      if (this.frame) this.disposeMesh(this.frame);
      this.frame = null;
      const match = selectedId?.match(/^L(\d+)-(\d+)$/);
      if (!match) return;
      const col = Number(match[1]), row = Number(match[2]);
      const land = venue ? venueRect(this.map, col, row) : parcelRect(this.map, col, row);
      // A venue's frame stops at the edge of its island, as its model does.
      const island = venue ? islandRect(blockRectOf(this.map, col, row)) : land;
      const x0 = Math.max(land.x0, island.x0), z0 = Math.max(land.z0, island.z0), x1 = Math.min(land.x1, island.x1), z1 = Math.min(land.z1, island.z1);
      const w = FRAME_WIDTH;
      this.frame = new THREE.Mesh(
        quads([
          { x0, z0, x1, z1: z0 + w }, { x0, z0: z1 - w, x1, z1 }, { x0, z0, x1: x0 + w, z1 }, { x0: x1 - w, z0, x1, z1 },
        ], FRAME_HEIGHT),
        new THREE.MeshBasicMaterial({ color: SELECTED_COLOR, side: THREE.DoubleSide }),
      );
      this.root.add(this.frame);
    }
  }

  /** The top of every island, textured with the metal floor as if it were one sheet over the whole map. */
  private plates(islands: Rect[], size: number): THREE.Mesh {
    const positions: number[] = [];
    const uvs: number[] = [];
    for (const { x0, z0, x1, z1 } of islands) {
      for (const [x, z] of [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]] as const) {
        positions.push(x, 0, z);
        uvs.push(x / size, 1 - z / size);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return new THREE.Mesh(geometry, this.floorMaterial!);
  }

  private lines(positions: number[], color: number, opacity: number): THREE.LineSegments {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  }

  /** Moves the bridges' lights; `time` is seconds on a steady clock. */
  update(time: number, dt: number): void {
    for (const model of this.models) model.update(time, dt);
  }

  dispose(): void {
    this.disposed = true;
    this.disposeModels();
    this.clear(this.root);
  }

  /** The models own their materials and share the rest, so they go before the sweep over what remains. */
  private disposeModels(): void {
    for (const model of this.models) {
      this.root.remove(model.root);
      model.dispose();
    }
    this.models = [];
  }

  private async loadFloor(): Promise<void> {
    const images = await Promise.all([floorCorners, floorSparse, floorNodes, floorStrips].map((url) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`floor image failed to load: ${url}`));
      image.src = url;
    })));
    const material = this.floorMaterial;
    if (this.disposed || !material) return;
    material.map?.dispose();
    material.map = paintFloor(images);
    material.color.setHex(0xffffff);
    material.needsUpdate = true;
  }

  private disposeMesh(mesh: THREE.Mesh): void {
    this.root.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }

  private clear(group: THREE.Object3D): void {
    group.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.LineLoop) {
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          (material as THREE.MeshBasicMaterial).map?.dispose();
          material.dispose();
        }
      }
    });
  }
}
