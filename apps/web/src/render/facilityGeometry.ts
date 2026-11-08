import type { ParcelView } from '@aiverse/protocol';
import type { MapProjection, ScreenPoint } from './layout';

export function facilityShape(parcel: ParcelView, parcelSize: number) {
  const isArcade = parcel.facility?.kind === 'game_hall';
  const margin = parcelSize * (isArcade ? 0.025 : 0.12);
  return {
    x: parcel.col * parcelSize + margin,
    y: parcel.row * parcelSize + margin,
    side: parcelSize - margin * 2,
    floorHeight: isArcade ? 0.8 : 0.3,
    high: isArcade ? 6.2 : parcel.facility?.kind === 'ad' ? 2.6 : 3.2,
    isArcade,
  };
}

function cross(a: ScreenPoint, b: ScreenPoint, c: ScreenPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** A raised glass click belongs to its facility even when its ground ray reaches another plot. */
export function hitFacility(
  projection: MapProjection,
  parcel: ParcelView,
  parcelSize: number,
  screenX: number,
  screenY: number,
): boolean {
  if (!parcel.facility || parcel.facility.kind === 'portal') return false;
  const { x, y, side, high } = facilityShape(parcel, parcelSize);
  const corners = [[0, 0], [side, 0], [side, side], [0, side]] as const;
  const points = corners.flatMap(([dx, dy]) => [0, high].map((height) =>
    projection.toScreen({ x: x + dx, y: y + dy }, height)));
  const sorted = points.sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: ScreenPoint[] = [], upper: ScreenPoint[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) lower.pop();
    lower.push(point);
  }
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) upper.pop();
    upper.push(point);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  const click = { x: screenX, y: screenY };
  return hull.every((point, index) => {
    const next = hull[(index + 1) % hull.length]!;
    const edgeLength = Math.hypot(next.x - point.x, next.y - point.y);
    return cross(point, next, click) >= -6 * edgeLength;
  });
}
