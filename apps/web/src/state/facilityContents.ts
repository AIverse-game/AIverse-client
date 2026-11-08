import type { FacilityView } from '@aiverse/protocol';

/** Content disappears on the client's clock even if the authority sends no new snapshot. */
export function activeContents(facility: FacilityView, countdown: (seconds: number) => number): number {
  return facility.expiresIn.filter((remaining) => countdown(remaining) > 0).length;
}
