import type { MapGridSpec, ParcelView } from '@aiverse/protocol';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from './gardenClock';
import { GardenLayer } from './GardenLayer';

const MAP: MapGridSpec = { size: 150, parcelSize: 10, blockCells: 3, venueCells: 2 };
const parcel = (col: number, row: number, kind?: 'garden' | 'ad'): ParcelView => ({
  id: `L${col}-${row}`, col, row, ownerId: 'a', shares: { a: 100 },
  ...(kind ? { facility: { kind, contents: 0, expiresIn: [], orientation: 'north_south' as const } } : {}),
});
const layer = () => new GardenLayer(new THREE.Scene());

describe('GardenLayer', () => {
  it('builds a garden for each parcel that has one and for no other', () => {
    const gardens = layer();

    gardens.sync([parcel(3, 6, 'garden'), parcel(4, 6, 'ad'), parcel(5, 6), parcel(4, 8, 'garden')], MAP);

    expect(gardens.targets().map((target) => target.userData.parcelId).sort()).toEqual(['L3-6', 'L4-8']);
    expect(gardens.anchor('L4-6')).toBeNull();
  });

  it('puts the garden over its parcel, on the island, with its anchor on the roof', () => {
    const gardens = layer();

    gardens.sync([parcel(4, 7, 'garden')], MAP);

    const anchor = gardens.anchor('L4-7')!;
    expect(anchor.top.x).toBeCloseTo(45);
    expect(anchor.top.z).toBeCloseTo(75);
    expect(anchor.top.y).toBeGreaterThan(2);
    expect(anchor.side).toBeCloseTo(7.2);
  });

  it('keeps a garden that is already standing when it syncs again, and drops one whose parcel lost it', () => {
    const gardens = layer();
    gardens.sync([parcel(4, 7, 'garden')], MAP);
    const target = gardens.targets()[0];

    gardens.sync([parcel(4, 7, 'garden')], MAP);
    const kept = gardens.targets()[0];
    gardens.sync([parcel(4, 7)], MAP);

    expect(kept).toBe(target);
    expect(gardens.targets()).toHaveLength(0);
    expect(gardens.anchor('L4-7')).toBeNull();
  });

  it('shows a spring morning before the game has a time', () => {
    const gardens = layer();

    gardens.update(0, 0.016, null);

    expect(gardens.environment()).toEqual({ season: 'spring', daylight: 1 });
  });

  it('follows the game clock through the seasons and the day', () => {
    const gardens = layer();

    // Four days and three quarters in: past the first season's end, in the middle of the night.
    gardens.update(0, 0.016, DAY_SECONDS * 4.75);

    expect(gardens.environment()).toEqual({ season: 'autumn', daylight: 0 });
  });

  it('shows what an override says in place of the clock, and the clock again when it is cleared', () => {
    const gardens = layer();

    gardens.setOverride({ season: 'autumn', daylight: 0 });
    gardens.update(0, 0.016, 0);
    const overridden = gardens.environment();
    gardens.setOverride(null);
    gardens.update(1, 0.016, 0);

    expect(overridden).toEqual({ season: 'autumn', daylight: 0 });
    expect(gardens.environment()).toEqual({ season: 'spring', daylight: 1 });
  });

  it('takes its gardens and itself out of the scene when disposed', () => {
    const scene = new THREE.Scene();
    const gardens = new GardenLayer(scene);
    gardens.sync([parcel(3, 6, 'garden')], MAP);

    gardens.dispose();

    expect(scene.children).toHaveLength(0);
    expect(gardens.targets()).toHaveLength(0);
  });
});
