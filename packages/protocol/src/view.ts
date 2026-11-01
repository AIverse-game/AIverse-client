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
  /** Total coins, including those set aside by pending offers and contracts. */
  coins: z.number().int().nonnegative(),
  spendableCoins: z.number().int().nonnegative(),
  rigBalance: z.number().int().nonnegative(),
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
  carriedChips: z.record(z.string(), z.number().int().positive()),
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

/** What one more token fetched at the market at a game time, before rounding. */
export const pricePointSchema = z.object({
  /** Game seconds since the start. */
  time: z.number().nonnegative(),
  price: z.number().positive(),
});

/**
 * Where residents sell tokens for coins and buy chips, and what sets the token price. One more
 * token fetches `basePrice * depth / (depth + p)` coins, where the distance of the pressure p of
 * recent sales from `restingPressure` halves every `halfLifeSeconds` after the server sent this;
 * selling q tokens pays `floor(basePrice * depth * ln((depth + p + q) / (depth + p)))`. The
 * resting pressure is below zero, so a market nobody sells to pays more than `basePrice`. The
 * server decides each sale.
 */
export const marketSchema = z.object({
  position: positionSchema,
  /** Residents within this distance of `position` can sell here. */
  radius: z.number().positive(),
  basePrice: z.number().positive(),
  depth: z.number().positive(),
  halfLifeSeconds: z.number().positive(),
  /** Pressure the market drifts to with no sales, above `-depth`. */
  restingPressure: z.number(),
  /** Recent sales in tokens when the server sent this; below zero after a quiet while. */
  pressure: z.number(),
  /** Chips on sale at fixed prices, worst first. */
  chips: z.array(chipModelSchema),
  /**
   * The token price over the game so far, oldest first: noted at every sale (a step, the price
   * just before and just after) and every few seconds in between, so a market nobody sells to
   * still shows its price climbing.
   */
  priceHistory: z.array(pricePointSchema),
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

const count = z.number().int().positive();
const coins = z.number().int().nonnegative();

/** A trade offer waiting for an answer: items for coins, the whole lot at once. */
export const offerSchema = z.object({
  eventId: z.number().int().positive(),
  /** `buy` when the sender offers to buy, `sell` when the sender offers to sell. */
  side: z.enum(['buy', 'sell']),
  fromId: z.string(),
  toId: z.string(),
  /** Item kind, such as `token` or a chip model. */
  item: z.string().min(1),
  quantity: count,
  /** Coins for the whole lot. */
  price: count,
});

/**
 * A contract proposal waiting for an answer: the supplier is to deliver `quantity` of `item`
 * `deliveries` times within `durationSeconds` of the recipient accepting, each delivery paying
 * them `price` coins and staking `deposit` coins that go to the buyer if it is not made.
 */
export const contractProposalSchema = z.object({
  eventId: z.number().int().positive(),
  fromId: z.string(),
  toId: z.string(),
  supplierId: z.string(),
  buyerId: z.string(),
  item: z.string().min(1),
  quantity: count,
  /** Coins for each delivery. */
  price: count,
  deliveries: count,
  durationSeconds: count,
  /** Coins the supplier stakes on each delivery; 0 for none. */
  deposit: coins,
});

/** A contract in force; the buyer's coins and the supplier's deposit for the deliveries left wait set aside in it. */
export const contractSchema = z.object({
  id: z.number().int().positive(),
  supplierId: z.string(),
  buyerId: z.string(),
  item: z.string().min(1),
  quantity: count,
  price: count,
  deliveriesLeft: count,
  /** Coins set aside: `price` times `deliveriesLeft`. */
  escrow: count,
  /** Coins the supplier stakes on each delivery; 0 for none. */
  deposit: coins,
  /** The supplier's coins set aside: `deposit` times `deliveriesLeft`, the buyer's if not delivered. */
  depositHeld: coins,
  /** Time until it lapses when the server sent this. */
  remainingSeconds: z.number().nonnegative(),
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
const resourceBalanceSchema = z.object({
  coins: z.number().int().nonnegative(),
  tokens: z.number().int().nonnegative(),
});

export const agentTurnSchema = z.object({
  seq: z.number().int().positive(),
  time: z.number().nonnegative(),
  endedAt: z.number().nonnegative(),
  summary: z.string().refine((text) => [...text].length <= 500, 'text too long').optional(),
  error: z.string().optional(),
  before: resourceBalanceSchema,
  after: resourceBalanceSchema,
  calls: z.array(z.object({
    name: z.string().refine((text) => [...text].length <= 80, 'text too long'),
    arguments: z.string().refine((text) => [...text].length <= 300, 'text too long'),
    time: z.number().nonnegative(),
    ok: z.boolean(),
    code: z.string().optional(),
    coinsChange: z.number().int(),
    tokensChange: z.number().int(),
  })).max(128),
});

export type AgentTurnView = z.infer<typeof agentTurnSchema>;

export const rigSlotSchema = z.object({
  id: z.number().int().positive(),
  residentId: z.string(),
  chip: z.enum(['MK1', 'MK2', 'MK3']),
  balance: z.number().int().nonnegative(),
  mined: z.number().int().nonnegative(),
  rentPaid: z.number().int().nonnegative(),
  status: z.enum(['running', 'no_funds', 'pool_empty']),
  remainingSeconds: z.number().nonnegative(),
  tokensPerCycle: z.number().int().nonnegative(),
  rentPerCycle: z.number().int().nonnegative(),
  energyPerCycle: z.number().int().nonnegative(),
});

export const rigSchema = z.object({
  id: z.number().int().positive(),
  ownerId: z.string(),
  poolId: z.string(),
  slots: z.array(rigSlotSchema),
});

export const rigRulesSchema = z.object({
  price: z.number().int().positive(),
  capacity: z.number().int().positive(),
  cycleSeconds: z.number().positive(),
  /** A chip in a rig mines this many times its `tokensPerJob` each cycle. */
  yieldMultiplier: z.number().int().positive(),
  rentPer100: z.number().int().nonnegative(),
  energyPer100: z.number().int().nonnegative(),
});

export type PricePointView = z.infer<typeof pricePointSchema>;
export type RigView = z.infer<typeof rigSchema>;
export type RigSlotView = z.infer<typeof rigSlotSchema>;

export const worldViewSchema = z
  .object({
    map: mapSchema,
    pools: z.array(poolSchema),
    residents: z.array(residentSchema),
    game: gameSchema,
    rigs: z.array(rigSchema),
    rigRules: rigRulesSchema,
    /** Absent on a map without a market. */
    market: marketSchema.optional(),
    /** The latest lines this connection may see, oldest first: everything aloud, its viewer's whispers. */
    speech: z.array(speechSchema),
    /**
     * Deals of the resident the connection views as (`view_as`), oldest first; empty when it views
     * as nobody. Like whispers, the server sends no one else's.
     */
    offers: z.array(offerSchema),
    contractProposals: z.array(contractProposalSchema),
    contracts: z.array(contractSchema),
    agentTimeline: z.object({
      residentId: z.string(),
      turns: z.array(agentTurnSchema).max(30),
    }).optional(),
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
    if (world.agentTimeline && !seen.has(world.agentTimeline.residentId)) {
      context.addIssue({ code: 'custom', path: ['agentTimeline', 'residentId'], message: 'unknown resident' });
    }
    const rigs = new Set<number>();
    world.rigs.forEach((rig, index) => {
      const owner = world.residents.find((resident) => resident.id === rig.ownerId);
      if (rigs.has(rig.id) || !pools.has(rig.poolId) || !owner || owner.left || rig.slots.length > world.rigRules.capacity) {
        context.addIssue({ code: 'custom', path: ['rigs', index], message: 'invalid rig or owner' });
      }
      rigs.add(rig.id);
      const slots = new Set<number>();
      rig.slots.forEach((slot, slotIndex) => {
        const resident = world.residents.find((person) => person.id === slot.residentId);
        if (slots.has(slot.id) || !resident || resident.left || world.game.ended) {
          context.addIssue({ code: 'custom', path: ['rigs', index, 'slots', slotIndex], message: 'invalid slot or resident' });
        }
        slots.add(slot.id);
      });
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
    const checkParties = (path: (string | number)[], ...pairs: [ResidentId, ResidentId][]) => {
      for (const [one, other] of pairs) {
        if (!seen.has(one) || !seen.has(other)) context.addIssue({ code: 'custom', path, message: 'unknown resident' });
        else if (one === other) context.addIssue({ code: 'custom', path, message: 'a deal with oneself' });
      }
    };
    world.offers.forEach((offer, index) => checkParties(['offers', index], [offer.fromId, offer.toId]));
    world.contractProposals.forEach((proposal, index) => {
      checkParties(['contractProposals', index], [proposal.fromId, proposal.toId], [proposal.supplierId, proposal.buyerId]);
      const parties = [proposal.fromId, proposal.toId].sort().join();
      if ([proposal.supplierId, proposal.buyerId].sort().join() !== parties) {
        context.addIssue({ code: 'custom', path: ['contractProposals', index], message: 'parties differ from sender and recipient' });
      }
    });
    world.contracts.forEach((contract, index) => {
      checkParties(['contracts', index], [contract.supplierId, contract.buyerId]);
      if (contract.escrow !== contract.price * contract.deliveriesLeft) {
        context.addIssue({ code: 'custom', path: ['contracts', index, 'escrow'], message: 'not price times deliveries left' });
      }
      if (contract.depositHeld !== contract.deposit * contract.deliveriesLeft) {
        context.addIssue({ code: 'custom', path: ['contracts', index, 'depositHeld'], message: 'not deposit times deliveries left' });
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
export type OfferView = z.infer<typeof offerSchema>;
export type ContractProposalView = z.infer<typeof contractProposalSchema>;
export type ContractView = z.infer<typeof contractSchema>;
export type WorldView = z.infer<typeof worldViewSchema>;
