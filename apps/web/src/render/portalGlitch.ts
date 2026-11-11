/**
 * The glitch a visitor goes through a portal in: where it leaves, its picture tears into sideways
 * slices of pink, cyan and white and a block of pixel noise, and a ghost of it twitches and drops out;
 * where it comes out, the same tearing settles while the visitor itself shakes and flickers into
 * place. The effect jumps from one look to the next in steps, as a broken signal does, and every step
 * is drawn from a hash of the seed and the step, so a visitor's glitch is the same each time it is
 * played. Distances are in figure heights, so the layer can scale it to the figures; times are in seconds.
 */

/** Seconds the whole glitch lasts at either end. */
export const GLITCH_SECONDS = 0.6;
/** Seconds the ghost left at the portal it went into keeps twitching. */
export const GHOST_SECONDS = 0.3;
/** Seconds one look of the glitch holds before it jumps to the next. */
export const GLITCH_STEP = 1 / 20;
/** Torn slices drawn at each step. */
export const SLICES = 7;

export type GlitchColor = 'pink' | 'cyan' | 'white';
const COLORS: readonly GlitchColor[] = ['pink', 'cyan', 'pink', 'cyan', 'white'];

export interface GlitchSlice {
  /** Height of its middle over the floor. */
  y: number;
  height: number;
  width: number;
  /** How far it is torn sideways from the figure's upright axis. */
  offset: number;
  color: GlitchColor;
}

export interface GlitchFrame {
  /** How strong the glitch is, 1 at the start falling to 0. */
  strength: number;
  slices: GlitchSlice[];
  /** Where the block of pixel noise is shifted to, sideways and up, or null on a step without it. */
  noise: { offset: number; y: number } | null;
  /** Whether the visitor that came out is drawn this step; it drops out on some steps. */
  shown: boolean;
  /** Whether the ghost at the portal it went into is drawn this step. */
  ghost: boolean;
  /** How far the visitor and its ghost are shaken sideways. */
  shake: number;
}

/** A number in [0, 1) from `seed`, `step` and `salt`, the same every time for the same three. */
export function glitchHash(seed: number, step: number, salt: number): number {
  let h = Math.imul(seed | 0, 0x27d4eb2d) ^ Math.imul(step | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The glitch `age` seconds after the visitor went through, for the visitor `seed`; null once it is over. */
export function glitchFrame(age: number, seed: number): GlitchFrame | null {
  if (age < 0 || age >= GLITCH_SECONDS) return null;
  const step = Math.floor(age / GLITCH_STEP);
  // Held for the whole step, so the look jumps rather than eases.
  const strength = 1 - (step * GLITCH_STEP) / GLITCH_SECONDS;
  const roll = (salt: number) => glitchHash(seed, step, salt);
  const slices: GlitchSlice[] = [];
  for (let i = 0; i < SLICES; i++) {
    const salt = 16 + i * 8;
    // Fewer slices tear as the glitch dies down.
    if (roll(salt) > 0.35 + 0.6 * strength) continue;
    slices.push({
      y: 0.05 + roll(salt + 1) * 1.05,
      height: 0.03 + roll(salt + 2) * 0.12,
      width: 0.3 + roll(salt + 3) * (0.5 + 0.9 * strength),
      offset: (roll(salt + 4) * 2 - 1) * 0.7 * strength,
      color: COLORS[Math.floor(roll(salt + 5) * COLORS.length)]!,
    });
  }
  const noisy = roll(1) < 0.25 + 0.5 * strength;
  return {
    strength,
    slices,
    noise: noisy ? { offset: (roll(2) * 2 - 1) * 0.4 * strength, y: 0.3 + roll(3) * 0.5 } : null,
    // The first two steps always show the visitor torn up, so the arrival is seen.
    shown: step < 2 || roll(4) > 0.4 * strength,
    ghost: age < GHOST_SECONDS && roll(5) < 0.7,
    shake: (roll(6) * 2 - 1) * 0.25 * strength,
  };
}
