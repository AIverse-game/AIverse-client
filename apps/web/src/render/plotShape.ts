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

/** Where a facility's model stands on its parcel and how big it is drawn. */
export function plotShape(kind: Kind, parcel: Rect): PlotShape {
  const { margin, span, slab, top } = SPECS[kind];
  const side = (parcel.x1 - parcel.x0) * (1 - 2 * margin);
  const scale = side / span;
  return {
    centre: { x: (parcel.x0 + parcel.x1) / 2, y: (parcel.z0 + parcel.z1) / 2 },
    side,
    scale,
    floor: slab * scale,
    height: (slab + top) * scale,
  };
}
