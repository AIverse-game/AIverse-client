// Where parcels lie on the map. The server decides the layout and describes it in `MapView`;
// this is the same arithmetic as the server's `economy/land.py`, so both sides agree on it.

export interface MapGridSpec {
  size: number;
  parcelSize: number;
  /** Parcels along each side of a block, which is bought whole. */
  blockCells: number;
  /** Width of the roads between blocks and around the edge; no parcel lies on one. */
  road: number;
}

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

interface Axis {
  starts: number[];
  ends: number[];
}

function axisOf({ size, parcelSize, blockCells, road }: MapGridSpec): Axis {
  if (blockCells <= 1) {
    const count = Math.max(1, Math.floor(size / parcelSize));
    const starts = Array.from({ length: count }, (_, i) => i * parcelSize);
    return { starts, ends: starts.map((start, i) => (i === count - 1 ? size : start + parcelSize)) };
  }
  const block = blockCells * parcelSize;
  const blocks = Math.max(1, Math.floor((size - road) / (block + road)));
  const starts: number[] = [];
  for (let b = 0; b < blocks; b++) {
    for (let k = 0; k < blockCells; k++) starts.push(road + b * (block + road) + k * parcelSize);
  }
  return { starts, ends: starts.map((start) => start + parcelSize) };
}

/** Parcels along each side of the map. */
export function gridCount(map: MapGridSpec): number {
  return axisOf(map).starts.length;
}

/** The square a parcel covers, in map units. */
export function parcelRect(map: MapGridSpec, col: number, row: number): Rect {
  const axis = axisOf(map);
  return { x0: axis.starts[col]!, z0: axis.starts[row]!, x1: axis.ends[col]!, z1: axis.ends[row]! };
}

/** The squares of every block, for drawing roads as what lies between them. */
export function blockRects(map: MapGridSpec): Rect[] {
  const axis = axisOf(map);
  const cells = Math.max(1, map.blockCells);
  const rects: Rect[] = [];
  for (let row = 0; row < axis.starts.length; row += cells) {
    for (let col = 0; col < axis.starts.length; col += cells) {
      rects.push({ x0: axis.starts[col]!, z0: axis.starts[row]!, x1: axis.ends[col + cells - 1]!, z1: axis.ends[row + cells - 1]! });
    }
  }
  return rects;
}

/** The middle block, where the spawn lobby stands. */
export function lobbyRect(map: MapGridSpec): Rect {
  const rects = blockRects(map);
  return rects[Math.floor(rects.length / 2)]!;
}

export interface ParcelHit {
  col: number;
  row: number;
  /** The point is on a road, so the parcel is only the nearest one. */
  onRoad: boolean;
}

/** The parcel at a map position; on a road, the nearest parcel to it. */
export function parcelAt(map: MapGridSpec, x: number, y: number): ParcelHit {
  const axis = axisOf(map);
  const find = (value: number) => {
    let index = 0;
    while (index + 1 < axis.starts.length && axis.starts[index + 1]! <= value) index++;
    return { index, off: value < axis.starts[index]! || value > axis.ends[index]! };
  };
  const col = find(x);
  const row = find(y);
  return { col: col.index, row: row.index, onRoad: col.off || row.off };
}

/** Whether a parcel belongs to the lobby block. */
export function inLobby(map: MapGridSpec, col: number, row: number): boolean {
  const cells = Math.max(1, map.blockCells);
  const blocks = gridCount(map) / cells;
  const middle = Math.floor(blocks / 2);
  return Math.floor(col / cells) === middle && Math.floor(row / cells) === middle;
}
