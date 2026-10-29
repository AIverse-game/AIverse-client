import type { PoolId, Position, ResidentId } from './view';

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
 * Spend time at a token pool the resident stands within reach of, with the best chip
 * they carry; without one the server refuses. The tokens arrive when the job ends; until then the
 * resident stays with the chip and can do nothing but leave.
 */
export type MineAction = { type: 'mine'; residentId: ResidentId; poolId: PoolId };

/**
 * Sell `quantity` carried tokens, a positive integer, to the market the resident stands at, for
 * coins at the market price. Selling the last token owned takes the resident out of the game.
 */
export type SellTokensAction = { type: 'sell_tokens'; residentId: ResidentId; quantity: number };

/** Buy one chip of `model` at the market the resident stands at, for its fixed price in coins. */
export type BuyChipAction = { type: 'buy_chip'; residentId: ResidentId; model: string };

/**
 * Say `text`, at most 100 characters after trimming, aloud to every resident within earshot, or,
 * given `to`, to that one resident wherever they are. Costs carried tokens, 2 aloud and 1 to one
 * resident; spending the last takes the speaker out of the game. Works while walking or mining.
 */
export type SayAction = { type: 'say'; residentId: ResidentId; text: string; to?: ResidentId };

export type Action = MoveToAction | LeaveGameAction | MineAction | SellTokensAction | BuyChipAction | SayAction;
