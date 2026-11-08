import { blockRects, gridCount, parcelRect, type MapGridSpec, type ParcelView, type Rect } from '@aiverse/protocol';
import * as THREE from 'three';
import floorCorners from '../assets/floor/metal-floor-corners.png';
import floorNodes from '../assets/floor/metal-floor-nodes.png';
import floorSparse from '../assets/floor/metal-floor-sparse.png';
import floorStrips from '../assets/floor/metal-floor-strips.png';
import { paintFloor } from './mapFloor';

const EDGE_COLOR = 0x487d91;
const SLAB_LIT = 0x243846;
const SLAB_SHADED = 0x172633;
const GRID_COLOR = 0x6e91a4;
const ROAD_COLOR = 0x0e151d;
const BLOCK_LINE_COLOR = 0x8fb4c6;
const OWNED_COLOR = 0x54cadc;
const SELECTED_COLOR = 0xffdb84;
/** Thickness of the earth under the map, as a fraction of the map side. */
const SLAB_DEPTH = 0.05;
const FRAME_WIDTH = 0.25;

/** Heights of the flat layers above the floor, so they never fight each other. */
const TINT_HEIGHT = 0.02;
const GRID_HEIGHT = 0.03;
const ROAD_HEIGHT = 0.015;
const FRAME_HEIGHT = 0.07;

function quads(rects: Array<{ x0: number; z0: number; x1: number; z1: number }>, y: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const { x0, z0, x1, z1 } of rects) positions.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

/** The metal floor, the earth slab under it, the parcel grid, owned parcels' tint and the selected parcel's frame. */
export class GroundLayer {
  private readonly root = new THREE.Group();
  private fixed = new THREE.Group();
  private tint: THREE.Mesh | null = null;
  private frame: THREE.Mesh | null = null;
  private size = 0;
  private map: MapGridSpec = { size: 0, parcelSize: 0, blockCells: 1, road: 0 };
  private tintSignature = '';
  private frameSignature = '';
  private floorMaterial: THREE.MeshBasicMaterial | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
  }

  /** Builds the parts that depend only on the layout of the map: floor, roads, block and parcel lines. */
  build(map: MapGridSpec): void {
    const { size } = map;
    this.clear(this.fixed);
    this.root.remove(this.fixed);
    this.fixed = new THREE.Group();
    this.root.add(this.fixed);
    this.size = size;
    this.map = map;
    this.tintSignature = this.frameSignature = '\0';

    this.floorMaterial = new THREE.MeshBasicMaterial({ color: 0x1a2430 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(size / 2, 0, size / 2);
    this.fixed.add(floor);
    this.loadFloor().catch((error: unknown) => console.error(error));

    const depth = SLAB_DEPTH * size;
    const side = (color: number) => new THREE.MeshBasicMaterial({ color });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(size, depth, size), [
      side(SLAB_SHADED), side(SLAB_SHADED), side(SLAB_SHADED), side(SLAB_SHADED), side(SLAB_LIT), side(SLAB_LIT),
    ]);
    slab.position.set(size / 2, -depth / 2 - 0.01, size / 2);
    this.fixed.add(slab);

    const blocks = blockRects(map);
    if (map.road > 0) this.fixed.add(this.roadMesh(map.size, blocks));
    const outline = (rect: Rect, y: number) => [
      rect.x0, y, rect.z0, rect.x1, y, rect.z0, rect.x1, y, rect.z0, rect.x1, y, rect.z1,
      rect.x1, y, rect.z1, rect.x0, y, rect.z1, rect.x0, y, rect.z1, rect.x0, y, rect.z0,
    ];
    const count = gridCount(map);
    const cells: number[] = [];
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) cells.push(...outline(parcelRect(map, col, row), GRID_HEIGHT));
    this.fixed.add(this.lines(cells, GRID_COLOR, 0.3));
    if (map.blockCells > 1) this.fixed.add(this.lines(blocks.flatMap((rect) => outline(rect, GRID_HEIGHT + 0.01)), BLOCK_LINE_COLOR, 0.8));
    const edge = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(size, 0.05, 0), new THREE.Vector3(size, 0.05, size), new THREE.Vector3(0, 0.05, size),
    ]);
    this.fixed.add(new THREE.LineLoop(edge, new THREE.LineBasicMaterial({ color: EDGE_COLOR })));
  }

  /** Tints the parcels that have an owner and frames the selected one; each is rebuilt only when it changed. */
  setParcels(parcels: readonly ParcelView[], selectedId: string | null): void {
    const owned = parcels;
    const tintSignature = owned.map((parcel) => parcel.id).join('|');
    if (tintSignature !== this.tintSignature) {
      this.tintSignature = tintSignature;
      if (this.tint) this.disposeMesh(this.tint);
      const rects = owned.map((parcel) => parcelRect(this.map, parcel.col, parcel.row));
      this.tint = new THREE.Mesh(quads(rects, TINT_HEIGHT), new THREE.MeshBasicMaterial({ color: OWNED_COLOR, transparent: true, opacity: 0.13, depthWrite: false }));
      this.root.add(this.tint);
    }
    if (selectedId !== this.frameSignature) {
      this.frameSignature = selectedId ?? '';
      if (this.frame) this.disposeMesh(this.frame);
      this.frame = null;
      const match = selectedId?.match(/^L(\d+)-(\d+)$/);
      if (!match) return;
      const { x0, z0, x1, z1 } = parcelRect(this.map, Number(match[1]), Number(match[2]));
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

  private lines(positions: number[], color: number, opacity: number): THREE.LineSegments {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  }

  /** The roads: everything on the map that is not inside a block, drawn as strips between and around the blocks. */
  private roadMesh(size: number, blocks: Rect[]): THREE.Mesh {
    const xs = [...new Set(blocks.flatMap((rect) => [rect.x0, rect.x1]))].sort((a, b) => a - b);
    const zs = [...new Set(blocks.flatMap((rect) => [rect.z0, rect.z1]))].sort((a, b) => a - b);
    const strips: Rect[] = [];
    for (let i = 0; i <= xs.length; i += 2) strips.push({ x0: i === 0 ? 0 : xs[i - 1]!, z0: 0, x1: i === xs.length ? size : xs[i]!, z1: size });
    for (let i = 0; i <= zs.length; i += 2) strips.push({ x0: 0, z0: i === 0 ? 0 : zs[i - 1]!, x1: size, z1: i === zs.length ? size : zs[i]! });
    return new THREE.Mesh(quads(strips, ROAD_HEIGHT), new THREE.MeshBasicMaterial({ color: ROAD_COLOR, side: THREE.DoubleSide }));
  }

  dispose(): void {
    this.disposed = true;
    this.clear(this.root);
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
