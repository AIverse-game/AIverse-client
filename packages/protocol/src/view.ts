import { z } from 'zod';

// Read-only data the authority sends out; mirrors aiverse_server/protocol.py in the
// Python server. Clients render it as-is and never derive game results themselves.
//
// Coordinates: the origin (0, 0) is the north-west (top-left) corner of a square map,
// x grows east (right) and y grows south (down); both lie in [0, map.size]. Positions
// are continuous map units, not grid cells.

export type ResidentId = string;
export type PoolId = string;

export const positionSchema = z.object({ x: z.number(), y: z.number() });

export const residentSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  position: positionSchema,
  /** Total coins, including those set aside by pending offers. */
  coins: z.number().int().nonnegative(),
  /** Left the game: still shown and ranked, but can no longer act. */
  left: z.boolean(),
  /** Place by coins, 1 for the most; equal totals share a place. Final once the game ends. */
  rank: z.number().int().positive(),
  /**
   * Tokens owned, including those set aside by pending offers: the resident's stamina. Walking
   * spends them, mining earns them, and a resident who runs out is out of the game.
   */
  tokens: z.number().int().nonnegative(),
  /** Present while the resident is busy mining. */
  mining: z
    .object({
      poolId: z.string(),
      /** Tokens paid out when the job ends. */
      amount: z.number().int().positive(),
      /** Time left in the job when the server sent this. */
      remainingSeconds: z.number().nonnegative(),
    })
    .optional(),
});

/** A token pool on the ground. Placed when the game starts and never moves; only `reserve` drops. */
export const poolSchema = z.object({
  id: z.string(),
  position: positionSchema,
  /** Residents within this distance of `position` can mine here. */
  radius: z.number().positive(),
  /** Tokens left in the ground. */
  reserve: z.number().int().nonnegative(),
});

export const mapSchema = z.object({
  /** Side length of the square map, in map units. */
  size: z.number().positive(),
});

export const gameSchema = z.object({
  ended: z.boolean(),
  /** Time left when the server sent this; 0 once the game has ended. */
  remainingSeconds: z.number().nonnegative(),
});

// The server guarantees these invariants; checking them here catches protocol drift
// between the two codebases before it turns into a broken picture.
export const worldViewSchema = z
  .object({ map: mapSchema, pools: z.array(poolSchema), residents: z.array(residentSchema), game: gameSchema })
  .superRefine((world, context) => {
    const inside = ({ x, y }: Position) => x >= 0 && y >= 0 && x <= world.map.size && y <= world.map.size;
    const pools = new Set<PoolId>();
    world.pools.forEach((pool, index) => {
      if (!inside(pool.position)) {
        context.addIssue({ code: 'custom', path: ['pools', index, 'position'], message: 'outside the map' });
      }
      if (pools.has(pool.id)) {
        context.addIssue({ code: 'custom', path: ['pools', index, 'id'], message: 'duplicate id' });
      }
      pools.add(pool.id);
    });
    const seen = new Set<ResidentId>();
    world.residents.forEach((resident, index) => {
      if (!inside(resident.position)) {
        context.addIssue({ code: 'custom', path: ['residents', index, 'position'], message: 'outside the map' });
      }
      if (seen.has(resident.id)) {
        context.addIssue({ code: 'custom', path: ['residents', index, 'id'], message: 'duplicate id' });
      }
      seen.add(resident.id);
      if (resident.mining && !pools.has(resident.mining.poolId)) {
        context.addIssue({ code: 'custom', path: ['residents', index, 'mining'], message: 'unknown pool' });
      }
    });
  });

export type Position = z.infer<typeof positionSchema>;
export type ResidentView = z.infer<typeof residentSchema>;
export type MapView = z.infer<typeof mapSchema>;
export type PoolView = z.infer<typeof poolSchema>;
export type GameView = z.infer<typeof gameSchema>;
export type WorldView = z.infer<typeof worldViewSchema>;
