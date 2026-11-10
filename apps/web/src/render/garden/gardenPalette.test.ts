import { describe, expect, it } from 'vitest';
import { SEASON_NAMES, seasonColors, SEASONS } from './gardenPalette';

describe('SEASONS', () => {
  it('has two seasons, as the demo does', () => {
    expect(SEASON_NAMES).toEqual(['spring', 'autumn']);
  });

  it('gives every season a colour for every role the first season has', () => {
    const roles = Object.keys(seasonColors(SEASON_NAMES[0]!)).sort();

    for (const season of SEASON_NAMES) {
      expect(Object.keys(seasonColors(season)).sort()).toEqual(roles);
    }
  });

  it('names the roles the model asks for', () => {
    const roles = Object.keys(seasonColors('spring'));

    for (const role of ['grass', 'grassEdge', 'hedge', 'hedge2', 'leaf', 'petal', 'lavender', 'lilyPad', 'lilyFlower', 'canopy2', 'bed4', 'wisteria2', 'arch2']) {
      expect(roles).toContain(role);
    }
    expect(roles).not.toContain('canopy3');
  });

  it.each(SEASON_NAMES)('keeps every colour of %s a valid 24-bit colour', (season) => {
    for (const color of Object.values(seasonColors(season))) {
      expect(Number.isInteger(color)).toBe(true);
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThanOrEqual(0xffffff);
    }
    expect(SEASONS[season].canopy).toHaveLength(3);
  });
});
