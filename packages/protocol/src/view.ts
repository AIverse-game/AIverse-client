import { z } from 'zod';
import { gridCount } from './mapGrid';

// Read-only data the authority sends out; mirrors aiverse_server/server/protocol.py in the
// Python server. Clients render it as-is and never derive game results themselves.
//
// Coordinates: the origin (0, 0) is the north-west (top-left) corner of a square map,
// x grows east (right) and y grows south (down); both lie in [0, map.size]. Positions
// are continuous map units, not grid cells.

export type ResidentId = string;

export const positionSchema = z.object({ x: z.number(), y: z.number() });

export const residentSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** Where the resident is when the server sent this; on the way while walking. */
  position: positionSchema,
  /** Total coins, including those set aside by pending offers, contracts and buy orders. */
  coins: z.number().int().nonnegative(),
  spendableCoins: z.number().int().nonnegative(),
  /** Left the game: still shown and ranked, but can no longer act. */
  left: z.boolean(),
  /** Place by coins, 1 for the most; equal totals share a place. Final once the game ends. */
  rank: z.number().int().positive(),
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
      /** Present while the agent waits for its brain's answer. */
      thinking: z.literal(true).optional(),
      /** The latest time the resident talked or something worked out for it; absent before the first. */
      cue: z
        .object({
          kind: z.enum(['talk', 'happy']),
          /** Counts up over the whole game; a cue is new when its `seq` has not been seen. */
          seq: z.number().int().positive(),
        })
        .optional(),
    })
    .optional(),
});

const levelSchema = z.object({
  /** Coins per unit. */
  price: z.number().int().positive(),
  /** Units resting at that price, of every order together. */
  quantity: z.number().int().positive(),
});

/** One item's book, without who placed the orders. */
export const bookSchema = z.object({
  item: z.string().min(1),
  /** The best buy prices, highest first. */
  bids: z.array(levelSchema),
  /** The best sell prices, lowest first. */
  asks: z.array(levelSchema),
});

/** Units that changed hands on the exchange, at the resting order's price, without who traded. */
export const fillSchema = z.object({
  seq: z.number().int().positive(),
  /** Game seconds since the start, to a tenth of a second. */
  time: z.number().nonnegative(),
  item: z.string().min(1),
  quantity: z.number().int().positive(),
  /** Coins per unit. */
  price: z.number().int().positive(),
  /** Present when the resident the connection views as took part. */
  own: z.enum(['bought', 'sold']).optional(),
});

/** A resting order of the resident the connection views as. */
export const orderSchema = z.object({
  id: z.number().int().positive(),
  side: z.enum(['buy', 'sell']),
  item: z.string().min(1),
  /** Units still wanted or offered. */
  quantity: z.number().int().positive(),
  /** Coins per unit. */
  price: z.number().int().positive(),
  /** Time until it expires when the server sent this. */
  remainingSeconds: z.number().nonnegative(),
});

/** The anonymous exchange, where residents trade from anywhere. */
export const exchangeSchema = z.object({
  /** One per item traded, in a fixed order. */
  books: z.array(bookSchema),
  /** The latest fills of every item, oldest first. */
  fills: z.array(fillSchema),
  /**
   * The resident the connection viewed as when the server sent this, whose orders `orders` lists
   * and whose fills `own` marks; absent for nobody. Right after choosing someone else, a state
   * about the previous choice can still arrive.
   */
  viewerId: z.string().optional(),
  /** Resting orders of the resident the connection views as (`view_as`); empty for nobody. */
  orders: z.array(orderSchema),
  /** Resting orders a resident may have at once. */
  maxOrders: z.number().int().positive(),
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
  /** Item kind. */
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
  parcelSize: z.number().positive(),
  /** Parcels along each side of a block, which is bought whole. */
  blockCells: z.number().int().positive(),
  /** Parcels along each side of the square a game hall or workspace takes up, with its north-west corner on the parcel it is built on. A mall takes up 1 × 2, west to east and north to south. */
  venueCells: z.number().int().positive(),
  /** Whether the middle block is the spawn lobby, which nobody owns. */
  lobby: z.boolean(),
  parcelPrices: z.array(z.array(z.number().int().positive())),
});

export const incomeSchema = z.object({
  /** Game time of the payday that paid the facility; one later than the page last saw is a new payout. */
  at: z.number().nonnegative(),
  /** Whole coins paid then, sponsors and admission fees together. */
  coins: z.number().int().positive(),
});

/** Which way a mall's long side runs: north_south takes the parcel and the one south of it, east_west the parcel and the one east of it. */
export const orientationSchema = z.enum(['north_south', 'east_west']);
export type Orientation = z.infer<typeof orientationSchema>;

export const facilitySchema = z.object({
  kind: z.enum(['ad', 'portal', 'game_hall', 'workspace', 'mall']),
  contents: z.number().int().min(0).max(5),
  expiresIn: z.array(z.number().positive()).max(5),
  /** Which way a mall runs; north_south for everything else. */
  orientation: orientationSchema.default('north_south'),
  /** What it was paid at the payday that last paid it; absent when none has. */
  income: incomeSchema.optional(),
}).refine((facility) => facility.contents === facility.expiresIn.length, 'content count differs from expiry list');

export const parcelSchema = z.object({
  id: z.string(),
  col: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
  ownerId: z.string(),
  shares: z.record(z.string(), z.number().int().positive()),
  facility: facilitySchema.optional(),
});

export const jobSchema = z.object({
  id: z.number().int().positive(),
  ownerId: z.string(),
  kind: z.string(),
  parcelId: z.string().optional(),
  remainingSeconds: z.number().nonnegative(),
  /** Which way the mall being built runs. */
  orientation: orientationSchema.default('north_south'),
});

export const contentSchema = z.object({
  viewerId: z.string(),
  adContent: z.number().int().nonnegative(),
  gameContent: z.number().int().nonnegative(),
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
  })).max(128),
});

export type AgentTurnView = z.infer<typeof agentTurnSchema>;

/**
 * One thing a resident did, or that finished for them, mirroring the server's game/world_log.py.
 * Only the fields its verb needs are sent; the page puts it into words. Open-ended verbs and deals
 * would hide a newer server's entries, so both are fixed lists and a protocol bump adds to them.
 */
export const worldLogEntrySchema = z.object({
  seq: z.number().int().positive(),
  /** Game seconds since the start when it happened. */
  time: z.number().nonnegative(),
  verb: z.enum([
    'said', 'walked', 'teleported', 'left_game', 'bought_parcel', 'bought_node', 'started_building',
    'started_making', 'built', 'made', 'placed_content', 'offered', 'accepted', 'declined', 'withdrew',
    'delivered', 'cancelled_contract', 'placed_order', 'cancelled_order', 'linked_portals',
  ]),
  /** Who did it, or whose job finished. */
  actorId: z.string(),
  /** The other resident involved: who was spoken to, offered or answered, or whose parcel. */
  otherId: z.string().optional(),
  /** What was said, or an information offer's summary. */
  text: z.string().optional(),
  parcelId: z.string().optional(),
  otherParcelId: z.string().optional(),
  /** A facility or permit kind, such as `game_hall`. */
  facility: z.string().optional(),
  /** An item, content (`ad` or `game`) or node kind. */
  item: z.string().optional(),
  /** Items, shares, parcels, node seconds or listeners, as the kind says. */
  quantity: z.number().int().nonnegative().optional(),
  coins: z.number().int().nonnegative().optional(),
  deliveries: z.number().int().positive().optional(),
  position: positionSchema.optional(),
  /** Which kind of request an offer or its answer was about. */
  deal: z.enum(['purchase', 'sale', 'information', 'shares', 'contract', 'joint_purchase', 'commission', 'link']).optional(),
  side: z.enum(['buy', 'sell']).optional(),
});

export type WorldLogEntryView = z.infer<typeof worldLogEntrySchema>;

export const worldViewSchema = z
  .object({
    map: mapSchema,
    parcels: z.array(parcelSchema),
    jobs: z.array(jobSchema),
    content: contentSchema.optional(),
    residents: z.array(residentSchema),
    game: gameSchema,
    exchange: exchangeSchema,
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
    /** Everything residents did lately, oldest first, the same for every page: whispers and offers between anyone included. */
    worldLog: z.array(worldLogEntrySchema),
  })
  .superRefine((world, context) => {
    const gridSize = gridCount(world.map);
    if (world.map.parcelPrices.length !== gridSize || world.map.parcelPrices.some((row) => row.length !== gridSize)) {
      context.addIssue({ code: 'custom', path: ['map', 'parcelPrices'], message: 'wrong parcel grid size' });
    }
    const inside = ({ x, y }: Position) => x >= 0 && y >= 0 && x <= world.map.size && y <= world.map.size;
    const seen = new Set<ResidentId>();
    world.residents.forEach((resident, index) => {
      if (!inside(resident.position)) {
        context.addIssue({ code: 'custom', path: ['residents', index, 'position'], message: 'outside the map' });
      }
      if (seen.has(resident.id)) {
        context.addIssue({ code: 'custom', path: ['residents', index, 'id'], message: 'duplicate id' });
      }
      seen.add(resident.id);
      if (resident.walking && !inside(resident.walking.target)) {
        context.addIssue({ code: 'custom', path: ['residents', index, 'walking'], message: 'target outside the map' });
      }
    });
    const parcelIds = new Set<string>();
    world.parcels.forEach((parcel, index) => {
      if (parcel.col >= gridSize || parcel.row >= gridSize || parcel.id !== `L${parcel.col}-${parcel.row}` || parcelIds.has(parcel.id)) {
        context.addIssue({ code: 'custom', path: ['parcels', index], message: 'invalid parcel position or id' });
      }
      if (!seen.has(parcel.ownerId) || Object.values(parcel.shares).reduce((sum, share) => sum + share, 0) !== 100 || Object.keys(parcel.shares).some((id) => !seen.has(id))) {
        context.addIssue({ code: 'custom', path: ['parcels', index, 'shares'], message: 'invalid owner or shares' });
      }
      parcelIds.add(parcel.id);
    });
    if (world.agentTimeline && !seen.has(world.agentTimeline.residentId)) {
      context.addIssue({ code: 'custom', path: ['agentTimeline', 'residentId'], message: 'unknown resident' });
    }
    if (world.content && !seen.has(world.content.viewerId)) {
      context.addIssue({ code: 'custom', path: ['content', 'viewerId'], message: 'unknown resident' });
    }
    world.speech.forEach((line, index) => {
      const people = [line.speakerId, ...line.listeners, ...(line.to === undefined ? [] : [line.to])];
      if (people.some((id) => !seen.has(id))) {
        context.addIssue({ code: 'custom', path: ['speech', index], message: 'unknown resident' });
      }
      if (line.to === line.speakerId || line.listeners.includes(line.speakerId)) {
        context.addIssue({ code: 'custom', path: ['speech', index], message: 'speaker hears themselves' });
      }
    });
    world.worldLog.forEach((entry, index) => {
      if (!seen.has(entry.actorId) || (entry.otherId !== undefined && !seen.has(entry.otherId))) {
        context.addIssue({ code: 'custom', path: ['worldLog', index], message: 'unknown resident' });
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
export type AgentResidentView = NonNullable<ResidentView['agent']>;
export type MapView = z.infer<typeof mapSchema>;
export type ParcelView = z.infer<typeof parcelSchema>;
export type FacilityView = z.infer<typeof facilitySchema>;
export type IncomeView = z.infer<typeof incomeSchema>;
export type JobView = z.infer<typeof jobSchema>;
export type BookView = z.infer<typeof bookSchema>;
export type FillView = z.infer<typeof fillSchema>;
export type OrderView = z.infer<typeof orderSchema>;
export type ExchangeView = z.infer<typeof exchangeSchema>;
export type GameView = z.infer<typeof gameSchema>;
export type SpeechView = z.infer<typeof speechSchema>;
export type OfferView = z.infer<typeof offerSchema>;
export type ContractProposalView = z.infer<typeof contractProposalSchema>;
export type ContractView = z.infer<typeof contractSchema>;
export type WorldView = z.infer<typeof worldViewSchema>;
