import { SEASON_NAMES, type SeasonName } from './gardenPalette';

/** Game seconds each season lasts; a 40-minute game sees spring, autumn, spring and autumn. */
export const SEASON_SECONDS = 600;
/** Game seconds from one morning to the next. */
export const DAY_SECONDS = 180;
/**
 * Where in the day, as a share of it, the light turns. A day starts in the morning at full light,
 * which holds until `dayEnd`, fades to dark by `duskEnd`, stays dark until `nightEnd` and comes back
 * by the end of the day.
 */
export const DAY_CYCLE = { dayEnd: 0.55, duskEnd: 0.65, nightEnd: 0.9 } as const;

/** The light and the season at a moment of the garden's life. */
export interface GardenEnvironment {
  season: SeasonName;
  /** 1 in full daylight, 0 at night, between at dusk and dawn. */
  daylight: number;
}

/** What someone chose to see in place of the clock; a part left out follows the clock. */
export interface EnvironmentOverride {
  season?: SeasonName;
  daylight?: number;
}

/** The names a URL may use for a time of day, and the daylight each stands for. */
export const DAYLIGHT_NAMES = { day: 1, dusk: 0.5, night: 0 } as const;

const smooth = (u: number) => u * u * (3 - 2 * u);

/** The daylight at a share `phase` (0 to 1) of a day. */
export function daylightAt(phase: number): number {
  const { dayEnd, duskEnd, nightEnd } = DAY_CYCLE;
  if (phase < dayEnd) return 1;
  if (phase < duskEnd) return 1 - smooth((phase - dayEnd) / (duskEnd - dayEnd));
  if (phase < nightEnd) return 0;
  return smooth((phase - nightEnd) / (1 - nightEnd));
}

/**
 * The environment `gameSeconds` into the game, which starts on a spring morning. The one place that
 * decides the season and the light, so what the garden shows can be had for any time, and any part
 * of it overridden.
 */
export function environmentAt(gameSeconds: number | null, override?: EnvironmentOverride | null): GardenEnvironment {
  const time = gameSeconds !== null && Number.isFinite(gameSeconds) && gameSeconds > 0 ? gameSeconds : 0;
  const season = SEASON_NAMES[Math.floor(time / SEASON_SECONDS) % SEASON_NAMES.length]!;
  const daylight = daylightAt((time % DAY_SECONDS) / DAY_SECONDS);
  return { season: override?.season ?? season, daylight: override?.daylight ?? daylight };
}

/**
 * Reads a season and a time of day from a URL query such as `?garden=autumn,night`: the value of
 * `garden` is a list of a season name, `day`, `dusk` or `night`, in any order. Words that mean
 * neither are ignored; null when nothing is left to override.
 */
export function parseEnvironmentOverride(search: string): EnvironmentOverride | null {
  const value = new URLSearchParams(search).get('garden');
  if (!value) return null;
  const override: EnvironmentOverride = {};
  for (const word of value.toLowerCase().split(',')) {
    const name = word.trim();
    if ((SEASON_NAMES as string[]).includes(name)) override.season = name as SeasonName;
    else if (Object.hasOwn(DAYLIGHT_NAMES, name)) override.daylight = DAYLIGHT_NAMES[name as keyof typeof DAYLIGHT_NAMES];
  }
  return override.season === undefined && override.daylight === undefined ? null : override;
}
