import type { ZoneId } from '@aiverse/protocol';

// Screen geometry is presentation only; game rules never depend on it.

export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 600;

export interface ZoneBox {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
}

export const ZONE_LAYOUT: Record<ZoneId, ZoneBox> = {
  market: { x: 480, y: 300, width: 240, height: 150, color: 0xc98b3a },
  farm: { x: 180, y: 130, width: 220, height: 140, color: 0x9bb84a },
  forest: { x: 780, y: 130, width: 220, height: 140, color: 0x3f7d4e },
  workshop: { x: 780, y: 470, width: 220, height: 140, color: 0x8a6a8f },
  home: { x: 180, y: 470, width: 220, height: 140, color: 0x5a7fa8 },
};

const SLOT_COLUMNS = 4;
const SLOT_SPACING = 46;

/** Each seat has a fixed slot inside every zone so residents never overlap. */
export function residentPosition(zone: ZoneId, seat: number): { x: number; y: number } {
  const box = ZONE_LAYOUT[zone];
  const column = seat % SLOT_COLUMNS;
  const row = Math.floor(seat / SLOT_COLUMNS);
  return {
    x: box.x + (column - (SLOT_COLUMNS - 1) / 2) * SLOT_SPACING,
    y: box.y + 4 + row * SLOT_SPACING,
  };
}
