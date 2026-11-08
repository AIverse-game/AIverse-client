/**
 * The timeline of the coins that pop up over a facility when it is paid, after `demos/arcade_owner_income_fx.html`:
 * each coin is thrown up and turns, hangs, then shrinks away in a few sparks, one coin after another,
 * while the amount rises beside them and fades. Distances are in coin diameters, so the layer can
 * scale the whole effect to the facility; times are in seconds.
 */

/** Seconds between one coin of a burst and the next. */
export const COIN_STAGGER = 0.12;
/** Seconds a coin is on screen: thrown up, hanging, then shrinking. */
export const COIN_LIFE = 0.8;
/** Seconds the sparks of a coin that ended last. */
export const SPARK_LIFE = 0.25;
/** Seconds the amount stays on screen. */
export const AMOUNT_LIFE = 1.1;
/** Sparks a coin ends in, flying out along the diagonals. */
export const SPARKS_PER_COIN = 4;
/** Frames the half turn of a coin is drawn in; the other half looks the same mirrored. */
export const COIN_FRAMES = 8;

const THROW_SECONDS = 0.3;
const THROW_HEIGHT = 2.2;
const SHRINK_SECONDS = 0.15;
/** Coins paid that call for one more coin in the burst, from the second on. */
const COIN_STEPS = [10, 50, 150, 500] as const;

const easeOut = (k: number): number => 1 - (1 - k) ** 3;

/** How many coins a payout of `coins` is shown with: one for a few coins, up to five for hundreds. */
export function coinCount(coins: number): number {
  return 1 + COIN_STEPS.filter((step) => coins >= step).length;
}

/** Seconds a whole burst of `count` coins lasts, until its last spark is gone. */
export function burstDuration(count: number): number {
  return Math.max((count - 1) * COIN_STAGGER + COIN_LIFE + SPARK_LIFE, AMOUNT_LIFE);
}

export interface CoinPose {
  /** Height over where the coin started. */
  rise: number;
  /** 1 while it shows, shrinking to 0 as it goes. */
  scale: number;
  /** Which frame of the half turn to draw, 0 to `COIN_FRAMES` - 1. */
  frame: number;
}

/** The coin `age` seconds after it was thrown; null before it is, and after it has gone. */
export function coinPose(age: number): CoinPose | null {
  if (age < 0 || age >= COIN_LIFE) return null;
  const rise = age < THROW_SECONDS
    ? THROW_HEIGHT * easeOut(age / THROW_SECONDS)
    : THROW_HEIGHT + (0.4 * (age - THROW_SECONDS)) / (COIN_LIFE - THROW_SECONDS);
  const spin = age < THROW_SECONDS ? 5 * age : 5 * THROW_SECONDS + 12 * (age - THROW_SECONDS);
  const half = ((spin % Math.PI) + Math.PI) % Math.PI;
  return {
    rise,
    scale: Math.min(1, (COIN_LIFE - age) / SHRINK_SECONDS),
    frame: Math.min(COIN_FRAMES - 1, Math.floor((half / Math.PI) * COIN_FRAMES)),
  };
}

export interface SparkPose {
  /** How far it has flown from where the coin ended, along its diagonal. */
  distance: number;
  /** White at first, then pale gold. */
  white: boolean;
}

/** A spark `age` seconds after its coin ended; null before and after. */
export function sparkPose(age: number): SparkPose | null {
  if (age < 0 || age >= SPARK_LIFE) return null;
  const k = age / SPARK_LIFE;
  return { distance: 0.9 * easeOut(k), white: k < 0.5 };
}

export interface AmountPose {
  rise: number;
  /** 1 while it shows, fading to 0 at the end. */
  opacity: number;
}

/** The amount `age` seconds after the burst started; null after it has gone. */
export function amountPose(age: number): AmountPose | null {
  if (age < 0 || age >= AMOUNT_LIFE) return null;
  const k = age / AMOUNT_LIFE;
  return { rise: 1.6 * easeOut(k), opacity: k < 0.7 ? 1 : (1 - k) / 0.3 };
}
