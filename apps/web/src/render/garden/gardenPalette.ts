/**
 * The colours of the garden, after `demos/voxel_floating_garden.html`: what changes with the season,
 * what never does, and how the night dims it. The map's own lights are fixed, so night is done by
 * darkening the garden's materials, see `GardenMaterials`.
 */

/** What a season recolours. Every colour the garden takes from the season is named here. */
export interface SeasonPalette {
  /** The brightest of the grass's three shades; the texture darkens it, see `GRASS_SHADES`. */
  grass: number;
  /** The grass slab's sides. */
  grassEdge: number;
  hedge: number;
  hedge2: number;
  /** Leaves on the arch, the pergola and its wisteria. */
  leaf: number;
  /** Petals on the ground and falling from the tree. */
  petal: number;
  lavender: number;
  lilyPad: number;
  lilyFlower: number;
  /** Three colours the tree's blocks are picked from. */
  canopy: readonly [number, number, number];
  /** Five tulip colours. */
  bed: readonly [number, number, number, number, number];
  wisteria: readonly [number, number, number];
  /** Flowers on the gate's arch. */
  arch: readonly [number, number, number];
}

/**
 * The seasons, in the order they come round. Add an entry to add a season: the clock and the
 * materials read this table and nothing else.
 */
export const SEASONS = {
  spring: {
    grass: 0x79c254, grassEdge: 0x62a842, hedge: 0x3f7a2e, hedge2: 0x4c8c38, leaf: 0x4c8c38, petal: 0xf8b4cc, lavender: 0x9a7ae0,
    lilyPad: 0x4f9a3a, lilyFlower: 0xff9ac0,
    canopy: [0xf4a6c4, 0xe98ab0, 0xfbc4d8],
    bed: [0xff5a6e, 0xffd84a, 0xff9ac0, 0xf4f0e8, 0xb67dff],
    wisteria: [0xb48cff, 0x9a6ef0, 0xd2b8ff],
    arch: [0xff9ac0, 0xf4f0e8, 0xff7aa8],
  },
  autumn: {
    grass: 0xb2bc58, grassEdge: 0x97a344, hedge: 0x5f6a2a, hedge2: 0x737a30, leaf: 0x8a7a2a, petal: 0xe8873a, lavender: 0x8a6a9a,
    lilyPad: 0x7a8a3a, lilyFlower: 0xf0c040,
    canopy: [0xe0702a, 0xd4552a, 0xf0a040],
    bed: [0xe8701a, 0xffb02e, 0xc0392b, 0xf0d060, 0x8e3a59],
    wisteria: [0xd4552a, 0xe8873a, 0xb83a2a],
    arch: [0xe8873a, 0xf0c040, 0xc0392b],
  },
} as const satisfies Record<string, SeasonPalette>;

export type SeasonName = keyof typeof SEASONS;

/** The seasons in the order the clock runs through them. */
export const SEASON_NAMES = Object.keys(SEASONS) as SeasonName[];

/** Colours that do not depend on the season, by the role a material plays; they are still dimmed at night. */
export const FIXED_COLORS = {
  dirt: 0x7a5232, rock: 0x6b6458, stone: 0xc4bfb2, stone2: 0xa6a093, wood: 0x8a5a35, wood2: 0x6e4527,
  white: 0xf2efe6, stem: 0x4c8c38, soil: 0x4a2f1c, yellow: 0xffc43a, pondBed: 0x24506a,
  canBlue: 0x5aa6d6, canDark: 0x4a86b0, tuftA: 0x3b6d11, tuftB: 0x639922,
  stoolRed: 0xe24b4a, stoolGold: 0xd4a24a, fur: 0xe8913a, fur2: 0xf4c27a, dark: 0x2a1e1e,
  /** Plain white: every colour of a koi, a butterfly or a drop of water comes from its instance. */
  critter: 0xffffff,
} as const;

export type FixedRole = keyof typeof FIXED_COLORS;

/** Every seasonal colour by its role name, `canopy0`, `bed3` and so on, for the materials to hold. */
export function seasonColors(season: SeasonName): Record<string, number> {
  const palette: SeasonPalette = SEASONS[season];
  const colors: Record<string, number> = {};
  for (const [key, value] of Object.entries(palette)) {
    if (typeof value === 'number') colors[key] = value;
    else (value as readonly number[]).forEach((color, index) => { colors[`${key}${index}`] = color; });
  }
  return colors;
}

/** The three shades of grass, as the share of the season's `grass` colour each pixel keeps. */
export const GRASS_SHADES = ['#ffffff', '#ebebeb', '#d6d6d6'] as const;
/** The grass slab's pixel texture, in pixels along a side, and how many times it repeats over the slab. */
export const GRASS_TEXTURE_SIZE = 16;
export const GRASS_REPEAT = 8;

/** The share of each colour channel the garden keeps at night: darker, and bluer than it is dark. */
export const NIGHT_TINT = [0.36, 0.42, 0.64] as const;
/** The colour of a lantern's window by day and by night. */
export const LANTERN_DAY = 0xf0d8a8;
export const LANTERN_NIGHT = 0xffc46b;
/** The colour of the pool of light a lantern throws on the ground, and how opaque it is at its brightest. */
export const POOL_COLOR = 0xffb86b;
export const POOL_OPACITY = 0.7;
/** Fireflies' colour and their opacity at full night. */
export const FIREFLY_COLOR = 0xd8ff7a;
export const FIREFLY_OPACITY = 0.95;
