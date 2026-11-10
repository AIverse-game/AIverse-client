import type { FacilityView, MallOrientation, Rect } from '@aiverse/protocol';
import { ARCADE_SLAB, ARCADE_SPAN, ARCADE_TOP } from './arcadeModel';
import { BILLBOARD_SLAB, BILLBOARD_SPAN, BILLBOARD_TOP } from './billboardModel';
import { GARDEN_SLAB, GARDEN_SPAN, GARDEN_TOP, GARDEN_WIDTH_CAP } from './garden/gardenModel';
import { MALL_SLAB, MALL_SPAN_X, MALL_SPAN_Z, MALL_TOP, MALL_WIDTH_CAP } from './mallModel';
import { PORTAL_SLAB, PORTAL_SPAN, PORTAL_TOP } from './portalModel';
import { WORKSPACE_SLAB, WORKSPACE_SPAN, WORKSPACE_TOP } from './workspaceModel';

type Kind = FacilityView['kind'];

/**
 * Per kind: the share of its land left empty on each side, and the model's width, slab and height in model
 * units. A model longer than it is wide has a `depth` too, and one that must stay clear of the island's edge
 * wherever it stands has a `cap` on its width in map units.
 */
const SPECS: Record<Kind, { margin: number; span: number; depth?: number; cap?: number; slab: number; top: number }> = {
  ad: { margin: 0.12, span: BILLBOARD_SPAN, slab: BILLBOARD_SLAB, top: BILLBOARD_TOP },
  workspace: { margin: 0.03, span: WORKSPACE_SPAN, slab: WORKSPACE_SLAB, top: WORKSPACE_TOP },
  mall: { margin: 0.03, span: MALL_SPAN_X, depth: MALL_SPAN_Z, cap: MALL_WIDTH_CAP, slab: MALL_SLAB, top: MALL_TOP },
  portal: { margin: 0.12, span: PORTAL_SPAN, slab: PORTAL_SLAB, top: PORTAL_TOP },
  game_hall: { margin: 0.025, span: ARCADE_SPAN, slab: ARCADE_SLAB, top: ARCADE_TOP },
  garden: { margin: 0.05, span: GARDEN_SPAN, cap: GARDEN_WIDTH_CAP, slab: GARDEN_SLAB, top: GARDEN_TOP },
};

export interface PlotShape {
  /** Map position of the plot's middle. */
  centre: { x: number; y: number };
  /** Width of the model in map units, across its front. */
  side: number;
  /** Length of the model in map units, from front to back; the same as `side` for a model that is square. */
  depth: number;
  /** What the model covers on the map, from west to east and from north to south: `side` by `depth`, the other way round for a mall running east to west. */
  extent: { x: number; z: number };
  /** Turn about the vertical axis that puts the model's front, its +z side, on the south or, for a mall running east to west, the east. */
  turn: number;
  /** Map units per model unit. */
  scale: number;
  /** Height of the plinth's top above the ground, in map units. */
  floor: number;
  /** Height of the model's top above the ground, in map units. */
  height: number;
}

/**
 * Where a facility's model stands on the land it takes up and how big it is drawn. With an
 * `island`, the model is kept to the part of the land the island covers, so it never hangs over the edge.
 */
export function plotShape(kind: Kind, land: Rect, island?: Rect, orientation: MallOrientation = 'north_south'): PlotShape {
  const { margin, span, depth, cap, slab, top } = SPECS[kind];
  const area = island
    ? { x0: Math.max(land.x0, island.x0), z0: Math.max(land.z0, island.z0), x1: Math.min(land.x1, island.x1), z1: Math.min(land.z1, island.z1) }
    : land;
  // A model that runs east to west is turned a quarter, so it is fitted to the land with its two axes swapped.
  const turned = kind === 'mall' && orientation === 'east_west';
  const across = turned ? area.z1 - area.z0 : area.x1 - area.x0;
  const along = turned ? area.x1 - area.x0 : area.z1 - area.z0;
  const width = across * (1 - 2 * margin);
  const length = along * (1 - 2 * margin);
  const scale = depth === undefined
    ? Math.min(width, length, cap ?? Infinity) / span
    : Math.min(width, cap ?? Infinity, length * span / depth) / span;
  const side = span * scale;
  const long = (depth ?? span) * scale;
  return {
    centre: { x: (area.x0 + area.x1) / 2, y: (area.z0 + area.z1) / 2 },
    side,
    depth: long,
    extent: turned ? { x: long, z: side } : { x: side, z: long },
    turn: turned ? Math.PI / 2 : 0,
    scale,
    floor: slab * scale,
    height: (slab + top) * scale,
  };
}
