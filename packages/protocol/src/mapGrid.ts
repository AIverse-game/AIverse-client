// Where parcels and blocks lie on the map. The server decides the layout and describes it in
// `MapView`; this is the same arithmetic as the server's `economy/land.py`, so both sides agree
// on it. Blocks touch: one ends where the next begins. The gaps, bridges and island edges the
// page draws between them take no map units.

export interface MapGridSpec {
  size: number;
  parcelSize: number;
  /** Parcels along each side of a block, which is bought whole. */
  blockCells: number;
  /** Parcels along each side of the square a game hall or workspace takes up, with its north-west corner on the parcel it is built on. */
  venueCells: number;
}

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Parcels along each side of the map. */
export function gridCount({ size, parcelSize }: MapGridSpec): number {
  return Math.max(1, Math.floor(size / parcelSize));
}

function span({ size, parcelSize }: MapGridSpec, count: number, first: number, last: number): [number, number] {
  return [first * parcelSize, last === count - 1 ? size : (last + 1) * parcelSize];
}

/** The square a parcel covers, in map units; the last column and row reach the map's edge. */
export function parcelRect(map: MapGridSpec, col: number, row: number): Rect {
  const count = gridCount(map);
  const [x0, x1] = span(map, count, col, col);
  const [z0, z1] = span(map, count, row, row);
  return { x0, z0, x1, z1 };
}

/** A mall takes up one parcel from west to east and two from north to south (10 × 20 map units). */
export const MALL_CELLS = { cols: 1, rows: 2 } as const;

/** Parcels a venue of `kind` takes up from west to east and from north to south: a mall `MALL_CELLS`, a game hall or workspace `venueCells` each way. */
export function venueSize(map: MapGridSpec, kind?: string): { cols: number; rows: number } {
  if (kind === 'mall') return MALL_CELLS;
  const side = Math.max(1, map.venueCells);
  return { cols: side, rows: side };
}

/** The land a venue of `kind` built on a parcel takes up, the parcel at its north-west corner. */
export function venueRect(map: MapGridSpec, col: number, row: number, kind?: string): Rect {
  const count = gridCount(map);
  const { cols, rows } = venueSize(map, kind);
  const [x0, x1] = span(map, count, col, Math.min(col + cols - 1, count - 1));
  const [z0, z1] = span(map, count, row, Math.min(row + rows - 1, count - 1));
  return { x0, z0, x1, z1 };
}

/** Whether a venue of `kind` built on a parcel stays inside that parcel's block. */
export function venueFits(map: MapGridSpec, col: number, row: number, kind?: string): boolean {
  const cells = Math.max(1, map.blockCells);
  const { cols, rows } = venueSize(map, kind);
  return (col % cells) + cols <= cells && (row % cells) + rows <= cells;
}

/** The parcel of a venue, among `venues`, whose land takes up the parcel at `col`, `row` without being that parcel. A venue without a `kind` is a game hall or workspace. */
export function venueTaking<T extends { col: number; row: number; kind?: string }>(map: MapGridSpec, venues: readonly T[], col: number, row: number): T | undefined {
  return venues.find((anchor) => {
    const { cols, rows } = venueSize(map, anchor.kind);
    return (anchor.col !== col || anchor.row !== row) && col >= anchor.col && col < anchor.col + cols && row >= anchor.row && row < anchor.row + rows;
  });
}

/** The squares of every block, row by row. */
export function blockRects(map: MapGridSpec): Rect[] {
  const count = gridCount(map);
  const cells = Math.max(1, map.blockCells);
  const rects: Rect[] = [];
  for (let row = 0; row < count; row += cells) {
    for (let col = 0; col < count; col += cells) {
      const [x0, x1] = span(map, count, col, Math.min(col + cells, count) - 1);
      const [z0, z1] = span(map, count, row, Math.min(row + cells, count) - 1);
      rects.push({ x0, z0, x1, z1 });
    }
  }
  return rects;
}

/** The block a parcel lies in. */
export function blockRectOf(map: MapGridSpec, col: number, row: number): Rect {
  const count = gridCount(map);
  const cells = Math.max(1, map.blockCells);
  const firstCol = Math.floor(col / cells) * cells;
  const firstRow = Math.floor(row / cells) * cells;
  const [x0, x1] = span(map, count, firstCol, Math.min(firstCol + cells, count) - 1);
  const [z0, z1] = span(map, count, firstRow, Math.min(firstRow + cells, count) - 1);
  return { x0, z0, x1, z1 };
}

/** The middle block, where the spawn lobby stands. */
export function lobbyRect(map: MapGridSpec): Rect {
  const rects = blockRects(map);
  return rects[Math.floor(rects.length / 2)]!;
}

/** How far each island's edge is drawn inside its block, so the gap between two islands is twice this. */
export const ISLAND_INSET = 2;

/** The part of a block its island covers on the page. */
export function islandRect(block: Rect): Rect {
  return { x0: block.x0 + ISLAND_INSET, z0: block.z0 + ISLAND_INSET, x1: block.x1 - ISLAND_INSET, z1: block.z1 - ISLAND_INSET };
}

export interface ParcelHit {
  col: number;
  row: number;
}

/** The parcel at a map position. */
export function parcelAt(map: MapGridSpec, x: number, y: number): ParcelHit {
  const last = gridCount(map) - 1;
  const clamp = (value: number) => Math.min(Math.max(Math.floor(value / map.parcelSize), 0), last);
  return { col: clamp(x), row: clamp(y) };
}

/** Whether a parcel belongs to the lobby block. */
export function inLobby(map: MapGridSpec, col: number, row: number): boolean {
  const cells = Math.max(1, map.blockCells);
  const middle = Math.floor(Math.floor(gridCount(map) / cells) / 2);
  return Math.floor(col / cells) === middle && Math.floor(row / cells) === middle;
}

/** Whether two parcels are in the same block. */
export function sameBlock(map: MapGridSpec, a: ParcelHit, b: ParcelHit): boolean {
  const cells = Math.max(1, map.blockCells);
  return Math.floor(a.col / cells) === Math.floor(b.col / cells) && Math.floor(a.row / cells) === Math.floor(b.row / cells);
}
