import { describe, expect, it } from 'vitest';
import { DAY_CYCLE, DAY_SECONDS, daylightAt, environmentAt, parseEnvironmentOverride, SEASON_SECONDS } from './gardenClock';
import { SEASON_NAMES } from './gardenPalette';

describe('environmentAt', () => {
  it('starts the game on a spring morning', () => {
    expect(environmentAt(0)).toEqual({ season: 'spring', daylight: 1 });
  });

  it.each([[null], [-5], [Number.NaN], [Number.POSITIVE_INFINITY]])('takes %s as the start of the game', (seconds) => {
    expect(environmentAt(seconds)).toEqual(environmentAt(0));
  });

  it('changes season every SEASON_SECONDS, through the table and round again', () => {
    const seasons = Array.from({ length: SEASON_NAMES.length + 1 }, (_, i) => environmentAt(i * SEASON_SECONDS).season);

    expect(seasons.slice(0, SEASON_NAMES.length)).toEqual(SEASON_NAMES);
    expect(seasons[SEASON_NAMES.length]).toBe(SEASON_NAMES[0]);
    expect(environmentAt(SEASON_SECONDS - 0.001).season).toBe(SEASON_NAMES[0]);
  });

  it('repeats the day every DAY_SECONDS', () => {
    const dusk = DAY_SECONDS * 0.6;

    expect(environmentAt(dusk + 3 * DAY_SECONDS).daylight).toBeCloseTo(environmentAt(dusk).daylight);
  });

  it('puts what the override names in place of the clock and leaves the rest to it', () => {
    const night = DAY_SECONDS * 0.75;

    expect(environmentAt(night, { season: 'autumn' })).toEqual({ season: 'autumn', daylight: 0 });
    expect(environmentAt(0, { daylight: 0.3 })).toEqual({ season: 'spring', daylight: 0.3 });
  });
});

describe('daylightAt', () => {
  it('is full all morning, dark all night and back by the end of the day', () => {
    expect(daylightAt(0)).toBe(1);
    expect(daylightAt(DAY_CYCLE.dayEnd)).toBe(1);
    expect(daylightAt(DAY_CYCLE.duskEnd)).toBe(0);
    expect(daylightAt((DAY_CYCLE.duskEnd + DAY_CYCLE.nightEnd) / 2)).toBe(0);
    expect(daylightAt(0.999999)).toBeCloseTo(1, 4);
  });

  it('stays between 0 and 1 and moves in small steps, so the light never jumps', () => {
    const steps = Array.from({ length: 1001 }, (_, i) => daylightAt(i / 1000));

    expect(Math.min(...steps)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...steps)).toBeLessThanOrEqual(1);
    const biggest = Math.max(...steps.slice(1).map((value, i) => Math.abs(value - steps[i]!)));
    expect(biggest).toBeLessThan(0.1);
  });

  it('falls through dusk and rises through dawn', () => {
    const dusk = [0.56, 0.6, 0.64].map(daylightAt);
    const dawn = [0.91, 0.95, 0.99].map(daylightAt);

    expect(dusk).toEqual([...dusk].sort((a, b) => b - a));
    expect(dawn).toEqual([...dawn].sort((a, b) => a - b));
    expect(dusk[1]).toBeGreaterThan(0);
    expect(dusk[1]).toBeLessThan(1);
  });
});

describe('parseEnvironmentOverride', () => {
  it.each([
    ['?garden=autumn,night', { season: 'autumn', daylight: 0 }],
    ['?garden=day,spring', { season: 'spring', daylight: 1 }],
    ['garden=dusk', { daylight: 0.5 }],
    ['?a=1&garden=Autumn', { season: 'autumn' }],
  ])('reads %s', (search, expected) => {
    expect(parseEnvironmentOverride(search)).toEqual(expected);
  });

  it.each([[''], ['?garden='], ['?garden=winter,noon'], ['?other=night'], ['?garden=toString,__proto__']])('ignores %j, which names nothing it knows', (search) => {
    expect(parseEnvironmentOverride(search)).toBeNull();
  });

  it('keeps what it knows from a list that holds something it does not', () => {
    expect(parseEnvironmentOverride('?garden=winter,night')).toEqual({ daylight: 0 });
  });
});
