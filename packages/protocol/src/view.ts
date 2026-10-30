import { z } from 'zod';

// Read-only data the authority sends out; mirrors aiverse_server/server/protocol.py in the
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
  /** Where the resident is when the server sent this; on the way while walking. */
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
  /**
   * Chips owned, model to count, including those set aside by pending offers; models
   * with none are left out. Mining needs one, and the best one carried does the work.
   */
  chips: z.record(z.string(), z.number().int().positive()),
  /** Present while the resident is busy mining; they stay with the chip until it ends. */
  mining: z
    .object({
      poolId: z.string(),
      /** Tokens paid out when the job ends. */
      amount: z.number().int().positive(),
      /** Model of the chip doing the work. */
      chip: z.string(),
      /** Time left in the job when the server sent this. */
      remainingSeconds: z.number().nonnegative(),
    })
    .optional(),
  /**
   * Present while the resident is walking: they head straight from `position` to `target` at a
   * steady pace, arriving after `remainingSeconds`, and are busy until then.
   */
  walking: z
    .object({
      target: positionSchema,
      /** Time left until arrival when the server sent this. */
      remainingSeconds: z.number().nonnegative(),
    })
    .optional(),
  /** Present while an agent drives the resident rather than the pages. */
  agent: z
    .object({
      /** The language model asking; left out for a scripted brain. */
      model: z.string().optional(),
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

/** A model of chip on sale at the market. Better models dig more tokens per job. */
export const chipModelSchema = z.object({
  model: z.string(),
  /** Coins one chip costs; fixed. */
  price: z.number().int().positive(),
  /** Tokens one mining job digs out while the pool has that many left. */
  tokensPerJob: z.number().int().positive(),
});

/**
 * Where residents sell tokens for coins and buy chips, and what sets the token price. One more
 * token fetches `basePrice * depth / (depth + p)` coins, where the pressure p of recent sales
 * halves every `halfLifeSeconds` after the server sent this; selling q tokens pays
 * `floor(basePrice * depth * ln((depth + p + q) / (depth + p)))`. The server decides each sale.
 */
export const marketSchema = z.object({
  position: positionSchema,
  /** Residents within this distance of `position` can sell here. */
  radius: z.number().positive(),
  basePrice: z.number().positive(),
  depth: z.number().positive(),
  halfLifeSeconds: z.number().positive(),
  /** Recent sales in tokens when the server sent this. */
  pressure: z.number().nonnegative(),
  /** Chips on sale at fixed prices, worst first. */
  chips: z.array(chipModelSchema),
});

/**
 * A line of speech: one spoken aloud, or a whisper to or from the resident the connection views
 * as (`view_as`). Residents hear only what reached them, which the server settles when it is said.
 */
export const speechSchema = z.object({
  seq: z.number().int().positive(),
  /** Game seconds since the start when it was said. */
  time: z.number().nonnegative(),
  speakerId: z.string(),
  text: z.string().min(1),
  /** The one resident spoken to; absent when spoken aloud. */
  to: z.string().optional(),
  /** Who heard it, not counting the speaker. */
  listeners: z.array(z.string()),
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
  .object({
    map: mapSchema,
    pools: z.array(poolSchema),
    residents: z.array(residentSchema),
    game: gameSchema,
    /** Absent on a map without a market. */
    market: marketSchema.optional(),
    /** The latest lines this connection may see, oldest first: everything aloud, its viewer's whispers. */
    speech: z.array(speechSchema),
  })
  .superRefine((world, context) => {
    const inside = ({ x, y }: Position) => x >= 0 && y >= 0 && x <= world.map.size && y <= world.map.size;
    if (world.market && !inside(world.market.position)) {
      context.addIssue({ code: 'custom', path: ['market', 'position'], message: 'outside the map' });
    }
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
      if (resident.walking && !inside(resident.walking.target)) {
        context.addIssue({ code: 'custom', path: ['residents', index, 'walking'], message: 'target outside the map' });
      }
    });
    world.speech.forEach((line, index) => {
      const people = [line.speakerId, ...line.listeners, ...(line.to === undefined ? [] : [line.to])];
      if (people.some((id) => !seen.has(id))) {
        context.addIssue({ code: 'custom', path: ['speech', index], message: 'unknown resident' });
      }
      if (line.to === line.speakerId || line.listeners.includes(line.speakerId)) {
        context.addIssue({ code: 'custom', path: ['speech', index], message: 'speaker hears themselves' });
      }
    });
  });

export type Position = z.infer<typeof positionSchema>;
export type ResidentView = z.infer<typeof residentSchema>;
export type MapView = z.infer<typeof mapSchema>;
export type PoolView = z.infer<typeof poolSchema>;
export type MarketView = z.infer<typeof marketSchema>;
export type ChipModelView = z.infer<typeof chipModelSchema>;
export type GameView = z.infer<typeof gameSchema>;
export type SpeechView = z.infer<typeof speechSchema>;
export type WorldView = z.infer<typeof worldViewSchema>;
