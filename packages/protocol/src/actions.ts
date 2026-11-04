import type { SpringId, Position, QuarryId, ResidentId } from './view';

// Operation primitives: the only ways to change the world, mirroring aiverse_server/game/actions.py.
// Players send them by hand today; AI-driven residents will use the same set later. The
// server checks every request, so the client never decides whether one is allowed.

/** Put a resident at `target`. Instant and in a straight line until movement rules exist. */
export type MoveToAction = { type: 'move_to'; residentId: ResidentId; target: Position };

/**
 * Leave the game for good: pending offers are called off, items are lost and coins still
 * count for the ranking. The game goes on for everyone else.
 */
export type LeaveGameAction = { type: 'leave_game'; residentId: ResidentId };

/**
 * Spend time at a spring the resident stands within reach of, with the best crystal
 * they carry; without one the server refuses. The energy arrives when the job ends; until then the
 * resident stays with the crystal and can do nothing but leave.
 */
export type HarvestAction = { type: 'harvest'; residentId: ResidentId; springId: SpringId };

/**
 * Sell `quantity` carried energy, a positive integer, to the market the resident stands at, for
 * coins at the market price. Selling the last energy owned takes the resident out of the game.
 */
export type SellEnergyAction = { type: 'sell_energy'; residentId: ResidentId; quantity: number };

/** Buy one crystal of `tier` at the market the resident stands at, for its fixed price in coins. */
export type BuyCrystalAction = { type: 'buy_crystal'; residentId: ResidentId; tier: string };

/**
 * Spend time digging shards at a quarry the resident stands within reach of; no crystal needed.
 * The shards arrive when the job ends; until then the resident can only talk or leave.
 */
export type DigShardsAction = { type: 'dig_shards'; residentId: ResidentId; quarryId: QuarryId };

/**
 * Refine one crystal of `tier` at the workshop the resident stands at, spending the recipe's
 * carried shards, energy and lower crystal at once. The crystal arrives when the job ends; until
 * then the resident can only talk or leave.
 */
export type RefineCrystalAction = { type: 'refine_crystal'; residentId: ResidentId; tier: string };

/**
 * Say `text`, at most 100 characters after trimming, aloud to every resident within earshot, or,
 * given `to`, to that one resident wherever they are. Costs carried energy, 2 aloud and 1 to one
 * resident; spending the last takes the speaker out of the game. Works while walking or harvesting.
 */
export type SayAction = { type: 'say'; residentId: ResidentId; text: string; to?: ResidentId };

export type BuildTowerAction = { type: 'build_tower'; residentId: ResidentId; springId: SpringId };
export type InstallCrystalAction = { type: 'install_crystal'; residentId: ResidentId; towerId: number; crystal: string; deposit: number };
export type FundTowerAction = { type: 'fund_tower'; residentId: ResidentId; towerId: number; slotId: number; amount: number };
export type RemoveCrystalAction = { type: 'remove_crystal'; residentId: ResidentId; towerId: number; slotId: number };

export type Action = MoveToAction | LeaveGameAction | HarvestAction | SellEnergyAction | BuyCrystalAction | SayAction
  | DigShardsAction | RefineCrystalAction
  | BuildTowerAction | InstallCrystalAction | FundTowerAction | RemoveCrystalAction;
