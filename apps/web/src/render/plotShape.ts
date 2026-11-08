import type { FacilityView, Rect } from '@aiverse/protocol';
import { ARCADE_SLAB, ARCADE_SPAN, ARCADE_TOP } from './arcadeModel';
import { BILLBOARD_SLAB, BILLBOARD_SPAN, BILLBOARD_TOP } from './billboardModel';
import { PORTAL_SLAB, PORTAL_SPAN, PORTAL_TOP } from './portalModel';
import { WORKSPACE_SLAB, WORKSPACE_SPAN, WORKSPACE_TOP } from './workspaceModel';

type Kind = FacilityView['kind'];

/** Per kind: the share of a parcel left empty on each side, and the model's width, slab and height in model units. */
const SPECS: Record<Kind, { margin: number; span: number; slab: number; top: number }> = {
  ad: { margin: 0.12, span: BILLBOARD_SPAN, slab: BILLBOARD_SLAB, top: BILLBOARD_TOP },
  workspace: { margin: 0.03, span: WORKSPACE_SPAN, slab: WORKSPACE_SLAB, top: WORKSPACE_TOP },
  portal: { margin: 0.12, span: PORTAL_SPAN, slab: PORTAL_SLAB, top: PORTAL_TOP },
  game_hall: { margin: 0.025, span: ARCADE_SPAN, slab: ARCADE_SLAB, top: ARCADE_TOP },
};

export interface PlotShape {
  /** Map position of the plot's middle. */
  centre: { x: number; y: number };
  /** Width of the plot in map units. */
  side: number;
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
export function plotShape(kind: Kind, land: Rect, island?: Rect): PlotShape {
  const { margin, span, slab, top } = SPECS[kind];
  const area = island
    ? { x0: Math.max(land.x0, island.x0), z0: Math.max(land.z0, island.z0), x1: Math.min(land.x1, island.x1), z1: Math.min(land.z1, island.z1) }
    : land;
  const side = Math.min(area.x1 - area.x0, area.z1 - area.z0) * (1 - 2 * margin);
  const scale = side / span;
  return {
    centre: { x: (area.x0 + area.x1) / 2, y: (area.z0 + area.z1) / 2 },
    side,
    scale,
    floor: slab * scale,
    height: (slab + top) * scale,
  };
}
