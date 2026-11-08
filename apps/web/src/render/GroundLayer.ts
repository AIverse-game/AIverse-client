import { blockRectOf, blockRects, ISLAND_INSET, islandRect, parcelRect, type MapGridSpec, type ParcelView, type Rect } from '@aiverse/protocol';
import * as THREE from 'three';
import floorCorners from '../assets/floor/metal-floor-corners.png';
import floorNodes from '../assets/floor/metal-floor-nodes.png';
import floorSparse from '../assets/floor/metal-floor-sparse.png';
import floorStrips from '../assets/floor/metal-floor-strips.png';
import { paintFloor } from './mapFloor';

const SLAB_LIT = 0x243846;
const SLAB_SHADED = 0x172633;
const GRID_COLOR = 0x6e91a4;
const ROAD_COLOR = 0x1c1636;
const RIM_COLOR = 0x5fe3f2;
const ROAD_LINE_COLOR = 0x8f6bff;
const OWNED_COLOR = 0x54cadc;
const SELECTED_COLOR = 0xffdb84;
/** Each tier of rock under an island: its width as a share of the island's, and its depth in map units. */
const ROCK_TIERS: Array<[number, number]> = [[1, 1.4], [0.8, 1.4], [0.55, 1.6], [0.3, 1.6]];
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

/** One floating island per block, the roads between them, owned blocks' tint and the selected parcel's frame. */
export class GroundLayer {
  private readonly root = new THREE.Group();
  private fixed = new THREE.Group();
  private tint: THREE.Mesh | null = null;
  private frame: THREE.Mesh | null = null;
  private map: MapGridSpec = { size: 0, parcelSize: 0, blockCells: 1 };
  private tintSignature = '';
  private frameSignature = '';
  private floorMaterial: THREE.MeshBasicMaterial | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
  }

  /** Builds the parts that depend only on the layout of the map: an island per block, the bridges between them, the lines on them. */
  build(map: MapGridSpec): void {
    const { size } = map;
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
    this.fixed.add(this.rock(blocks));
    this.fixed.add(this.bridges(map, size));

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

  /** Tints the islands of blocks that have an owner and frames the selected parcel; each is rebuilt only when it changed. */
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

  /** The rock under each island: a few tiers, each narrower than the one above, so it hangs in the air like a floating island. */
  private rock(islands: Rect[]): THREE.Group {
    const group = new THREE.Group();
    const lit = new THREE.MeshBasicMaterial({ color: SLAB_LIT });
    const shaded = new THREE.MeshBasicMaterial({ color: SLAB_SHADED });
    const sides = [shaded, shaded, shaded, shaded, lit, lit];
    for (const island of islands) {
      const width = island.x1 - island.x0;
      let top = -0.01;
      ROCK_TIERS.forEach(([shrink, depth]) => {
        const side = width * shrink;
        const tier = new THREE.Mesh(new THREE.BoxGeometry(side, depth, side), sides);
        tier.position.set((island.x0 + island.x1) / 2, top - depth / 2, (island.z0 + island.z1) / 2);
        group.add(tier);
        top -= depth;
      });
    }
    return group;
  }

  /** The roads: flat strips across the gaps between neighbouring islands, drawn only for the look. */
  private bridges(map: MapGridSpec, size: number): THREE.Group {
    const group = new THREE.Group();
    const strips: Rect[] = [];
    const lines: number[] = [];
    const edges = new Set<number>();
    for (const block of blockRects(map)) for (const edge of [block.x0, block.x1, block.z0, block.z1]) if (edge > 0 && edge < size) edges.add(edge);
    for (const edge of edges) {
      strips.push({ x0: edge - ISLAND_INSET, z0: ISLAND_INSET, x1: edge + ISLAND_INSET, z1: size - ISLAND_INSET });
      strips.push({ x0: ISLAND_INSET, z0: edge - ISLAND_INSET, x1: size - ISLAND_INSET, z1: edge + ISLAND_INSET });
      lines.push(edge, ROAD_HEIGHT + 0.005, ISLAND_INSET, edge, ROAD_HEIGHT + 0.005, size - ISLAND_INSET, ISLAND_INSET, ROAD_HEIGHT + 0.005, edge, size - ISLAND_INSET, ROAD_HEIGHT + 0.005, edge);
    }
    group.add(new THREE.Mesh(quads(strips, ROAD_HEIGHT), new THREE.MeshBasicMaterial({ color: ROAD_COLOR, side: THREE.DoubleSide })));
    group.add(this.lines(lines, ROAD_LINE_COLOR, 0.8));
    return group;
  }

  private lines(positions: number[], color: number, opacity: number): THREE.LineSegments {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
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
