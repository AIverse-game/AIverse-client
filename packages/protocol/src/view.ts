import { z } from 'zod';

// Read-only data the authority sends out; mirrors aiverse_server/server/protocol.py in the
// Python server. Clients render it as-is and never derive game results themselves.
//
// Coordinates: the origin (0, 0) is the north-west (top-left) corner of a square map,
// x grows east (right) and y grows south (down); both lie in [0, map.size]. Positions
// are continuous map units, not grid cells.

export type ResidentId = string;
export type SpringId = string;

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
  towerBalance: z.number().int().nonnegative(),
  /** Left the game: still shown and ranked, but can no longer act. */
  left: z.boolean(),
  /** Place by coins, 1 for the most; equal totals share a place. Final once the game ends. */
  rank: z.number().int().positive(),
  /**
   * Energy owned, including those set aside by pending offers: the resident's stamina. Walking
   * spends them, harvesting earns them, and a resident who runs out is out of the game.
   */
  energy: z.number().int().nonnegative(),
  /**
   * Crystals owned, tier to count, including those set aside by pending offers; tiers
   * with none are left out. Harvesting needs one, and the best one carried does the work.
   */
  crystals: z.record(z.string(), z.number().int().positive()),
  carriedCrystals: z.record(z.string(), z.number().int().positive()),
  /** Present while the resident is busy harvesting; they stay with the crystal until it ends. */
  harvesting: z
    .object({
      springId: z.string(),
      /** Energy paid out when the job ends. */
      amount: z.number().int().positive(),
      /** Tier of the crystal doing the work. */
      crystal: z.string(),
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

/** A spring on the ground. Placed when the game starts and never moves; only `reserve` drops. */
export const springSchema = z.object({
  id: z.string(),
  position: positionSchema,
  /** Residents within this distance of `position` can harvest here. */
  radius: z.number().positive(),
  /** Energy left in the ground. */
  reserve: z.number().int().nonnegative(),
});

/** A tier of crystal on sale at the market. Higher tiers draw more energy per job. */
export const crystalTierSchema = z.object({
  tier: z.string(),
  /** Coins one crystal costs; fixed. */
  price: z.number().int().positive(),
  /** Energy one harvesting job digs out while the spring has that many left. */
  energyPerJob: z.number().int().positive(),
});

/** What one more energy fetched at the market at a game time, before rounding. */
export const pricePointSchema = z.object({
  /** Game seconds since the start. */
  time: z.number().nonnegative(),
  price: z.number().positive(),
});

/**
 * Where residents sell energy for coins and buy crystals, and what sets the energy price. One more
 * energy fetches `basePrice * depth / (depth + p)` coins, where the distance of the pressure p of
 * recent sales from `restingPressure` halves every `halfLifeSeconds` after the server sent this;
 * selling q energy pays `floor(basePrice * depth * ln((depth + p + q) / (depth + p)))`. The
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
  /** Recent sales in energy when the server sent this; below zero after a quiet while. */
  pressure: z.number(),
  /** Crystals on sale at fixed prices, worst first. */
  crystals: z.array(crystalTierSchema),
  /**
   * The energy price over the game so far, oldest first: noted at every sale (a step, the price
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
  /** Item kind, such as `energy` or a crystal tier. */
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
  energy: z.number().int().nonnegative(),
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
    energyChange: z.number().int(),
  })).max(128),
});

export type AgentTurnView = z.infer<typeof agentTurnSchema>;

export const towerSlotSchema = z.object({
  id: z.number().int().positive(),
  residentId: z.string(),
  crystal: z.enum(['C1', 'C2', 'C3']),
  balance: z.number().int().nonnegative(),
  harvested: z.number().int().nonnegative(),
  rentPaid: z.number().int().nonnegative(),
  status: z.enum(['running', 'no_funds', 'spring_empty']),
  remainingSeconds: z.number().nonnegative(),
  energyPerCycle: z.number().int().nonnegative(),
  rentPerCycle: z.number().int().nonnegative(),
  upkeepPerCycle: z.number().int().nonnegative(),
});

export const towerSchema = z.object({
  id: z.number().int().positive(),
  ownerId: z.string(),
  springId: z.string(),
  slots: z.array(towerSlotSchema),
});

export const towerRulesSchema = z.object({
  price: z.number().int().positive(),
  capacity: z.number().int().positive(),
  cycleSeconds: z.number().positive(),
  /** A crystal in a tower harvests this many times its `energyPerJob` each cycle. */
  yieldMultiplier: z.number().int().positive(),
  rentPer100: z.number().int().nonnegative(),
  upkeepPer100: z.number().int().nonnegative(),
});

export type PricePointView = z.infer<typeof pricePointSchema>;
export type TowerView = z.infer<typeof towerSchema>;
export type TowerSlotView = z.infer<typeof towerSlotSchema>;

export const worldViewSchema = z
  .object({
    map: mapSchema,
    springs: z.array(springSchema),
    residents: z.array(residentSchema),
    game: gameSchema,
    towers: z.array(towerSchema),
    towerRules: towerRulesSchema,
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
    const springs = new Set<SpringId>();
    world.springs.forEach((spring, index) => {
      if (!inside(spring.position)) {
        context.addIssue({ code: 'custom', path: ['springs', index, 'position'], message: 'outside the map' });
      }
      if (springs.has(spring.id)) {
        context.addIssue({ code: 'custom', path: ['springs', index, 'id'], message: 'duplicate id' });
      }
      springs.add(spring.id);
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
      if (resident.harvesting && !springs.has(resident.harvesting.springId)) {
        context.addIssue({ code: 'custom', path: ['residents', index, 'harvesting'], message: 'unknown spring' });
      }
      if (resident.walking && !inside(resident.walking.target)) {
        context.addIssue({ code: 'custom', path: ['residents', index, 'walking'], message: 'target outside the map' });
      }
    });
    if (world.agentTimeline && !seen.has(world.agentTimeline.residentId)) {
      context.addIssue({ code: 'custom', path: ['agentTimeline', 'residentId'], message: 'unknown resident' });
    }
    const towers = new Set<number>();
    world.towers.forEach((tower, index) => {
      const owner = world.residents.find((resident) => resident.id === tower.ownerId);
      if (towers.has(tower.id) || !springs.has(tower.springId) || !owner || owner.left || tower.slots.length > world.towerRules.capacity) {
        context.addIssue({ code: 'custom', path: ['towers', index], message: 'invalid tower or owner' });
      }
      towers.add(tower.id);
      const slots = new Set<number>();
      tower.slots.forEach((slot, slotIndex) => {
        const resident = world.residents.find((person) => person.id === slot.residentId);
        if (slots.has(slot.id) || !resident || resident.left || world.game.ended) {
          context.addIssue({ code: 'custom', path: ['towers', index, 'slots', slotIndex], message: 'invalid slot or resident' });
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
export type SpringView = z.infer<typeof springSchema>;
export type MarketView = z.infer<typeof marketSchema>;
export type CrystalTierView = z.infer<typeof crystalTierSchema>;
export type GameView = z.infer<typeof gameSchema>;
export type SpeechView = z.infer<typeof speechSchema>;
export type OfferView = z.infer<typeof offerSchema>;
export type ContractProposalView = z.infer<typeof contractProposalSchema>;
export type ContractView = z.infer<typeof contractSchema>;
export type WorldView = z.infer<typeof worldViewSchema>;
