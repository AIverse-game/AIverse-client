import type { SpringId, Position, MineId, ResidentId } from './view';

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
 * Spend time at a spring the resident stands within reach of, with the best program
 * they carry; without one the server refuses. The compute arrives when the job ends; until then the
 * resident stays with the program and can do nothing but leave.
 */
export type HarvestAction = { type: 'harvest'; residentId: ResidentId; springId: SpringId };

/**
 * Sell `quantity` carried compute, a positive integer, to the market the resident stands at, for
 * coins at the market price. Selling the last compute owned takes the resident out of the game.
 */
export type SellComputeAction = { type: 'sell_compute'; residentId: ResidentId; quantity: number };

/** Buy one program of `tier` at the market the resident stands at, for its fixed price in coins. */
export type BuyProgramAction = { type: 'buy_program'; residentId: ResidentId; tier: string };

/**
 * Spend time gathering data at a mine the resident stands within reach of; no program needed.
 * The data arrive when the job ends; until then the resident can only talk or leave.
 */
export type GatherDataAction = { type: 'gather_data'; residentId: ResidentId; mineId: MineId };

/**
 * Write one program of `tier` at the studio the resident stands at, spending the recipe's
 * carried data, compute and lower program at once. The program arrives when the job ends; until
 * then the resident can only talk or leave.
 */
export type WriteProgramAction = { type: 'write_program'; residentId: ResidentId; tier: string };

/**
 * Say `text`, at most 100 characters after trimming, aloud to every resident within earshot, or,
 * given `to`, to that one resident wherever they are. Costs carried compute, 2 aloud and 1 to one
 * resident; spending the last takes the speaker out of the game. Works while walking or harvesting.
 */
export type SayAction = { type: 'say'; residentId: ResidentId; text: string; to?: ResidentId };

export type BuildCollectorAction = { type: 'build_collector'; residentId: ResidentId; springId: SpringId };
export type InstallProgramAction = { type: 'install_program'; residentId: ResidentId; collectorId: number; program: string; deposit: number };
export type FundCollectorAction = { type: 'fund_collector'; residentId: ResidentId; collectorId: number; slotId: number; amount: number };
export type RemoveProgramAction = { type: 'remove_program'; residentId: ResidentId; collectorId: number; slotId: number };

export type Action = MoveToAction | LeaveGameAction | HarvestAction | SellComputeAction | BuyProgramAction | SayAction
  | GatherDataAction | WriteProgramAction
  | BuildCollectorAction | InstallProgramAction | FundCollectorAction | RemoveProgramAction;
