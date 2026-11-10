import { describe, expect, it } from 'vitest';
import { GardenMaterials } from './GardenMaterials';
import { LANTERN_DAY, LANTERN_NIGHT, NIGHT_TINT } from './gardenPalette';

const channels = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

describe('GardenMaterials', () => {
  it('colours a seasonal role from the season it is set to', () => {
    const materials = new GardenMaterials();

    materials.setSeason('autumn');

    expect(materials.lit('canopy0').color.getHex()).toBe(0xe0702a);
    materials.setSeason('spring');
    expect(materials.lit('canopy0').color.getHex()).toBe(0xf4a6c4);
  });

  it('leaves a fixed role as it is when the season changes', () => {
    const materials = new GardenMaterials();
    const before = materials.lit('stone').color.getHex();

    materials.setSeason('autumn');

    expect(materials.lit('stone').color.getHex()).toBe(before);
  });

  it('keeps one material for a role, so a change reaches every garden that uses it', () => {
    const materials = new GardenMaterials();

    expect(materials.lit('hedge')).toBe(materials.lit('hedge'));
  });

  it('dims lit materials at night by the night tint, and the blue the least', () => {
    const materials = new GardenMaterials();

    materials.setDaylight(0);

    const [r, g, b] = channels(0xc4bfb2);
    const { color } = materials.lit('stone');
    expect([color.r, color.g, color.b]).toEqual([r * NIGHT_TINT[0], g * NIGHT_TINT[1], b * NIGHT_TINT[2]].map((value) => expect.closeTo(value, 5)));
    expect(NIGHT_TINT[2]).toBeGreaterThan(NIGHT_TINT[0]);
  });

  it('is undimmed in full daylight, however dark it was before', () => {
    const materials = new GardenMaterials();
    materials.setDaylight(0);

    materials.setDaylight(1);

    expect(materials.lit('stone').color.getHex()).toBe(0xc4bfb2);
  });

  it('keeps a season while the light changes and the light while the season changes', () => {
    const materials = new GardenMaterials();
    materials.setDaylight(0.5);

    materials.setSeason('autumn');
    const dusk = materials.lit('canopy0').color.r;
    materials.setDaylight(1);

    expect(dusk).toBeLessThan(materials.lit('canopy0').color.r);
    expect(materials.lit('canopy0').color.getHex()).toBe(0xe0702a);
  });

  it('lights the lanterns, the pools and the fireflies at night and not by day', () => {
    const materials = new GardenMaterials();

    materials.setDaylight(1);
    const day = { lantern: materials.lantern.color.getHex(), pool: materials.pool.opacity, firefly: materials.firefly.opacity };
    materials.setDaylight(0);

    expect(day).toEqual({ lantern: LANTERN_DAY, pool: 0, firefly: 0 });
    expect(materials.lantern.color.getHex()).toBe(LANTERN_NIGHT);
    expect(materials.pool.opacity).toBeGreaterThan(0);
    expect(materials.firefly.opacity).toBeGreaterThan(0);
    expect(materials.darkness).toBe(1);
  });

  it('marks the plants as swaying and the stonework as not', () => {
    const materials = new GardenMaterials();

    expect(materials.isSwaying(materials.lit('wisteria1'))).toBe(true);
    expect(materials.isSwaying(materials.lit('stone'))).toBe(false);
  });

  it('refuses a role it does not have', () => {
    expect(() => new GardenMaterials().lit('canopy7')).toThrow(/canopy7/);
  });
});
