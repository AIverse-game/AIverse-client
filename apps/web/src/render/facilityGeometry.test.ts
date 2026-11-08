import type { ParcelView } from '@aiverse/protocol';
import { describe, expect, it } from 'vitest';
import { hitFacility } from './facilityGeometry';
import { projectMap } from './layout';

describe('hitFacility', () => {
  const projection = projectMap(150);
  const hall: ParcelView = {
    id: 'L8-7', col: 8, row: 7, ownerId: 'r1', shares: { r1: 100 },
    facility: { kind: 'game_hall', contents: 0, expiresIn: [] },
  };

  it('selects the hall through the raised glass where a ground ray reaches another parcel', () => {
    const raised = projection.toScreen({ x: 85, y: 79.75 }, 6.2);
    expect(projection.toMap(raised.x, raised.y)!.x).toBeLessThan(80);
    expect(hitFacility(projection, hall, 10, raised.x, raised.y + 3)).toBe(true);
  });

  it('does not claim an unrelated point', () => {
    const elsewhere = projection.toScreen({ x: 65, y: 95 });
    expect(hitFacility(projection, hall, 10, elsewhere.x, elsewhere.y)).toBe(false);
  });
});
