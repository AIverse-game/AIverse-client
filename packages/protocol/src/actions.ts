import type { Position, ResidentId } from './view';

// Operation primitives: the only ways to change the world, mirroring aiverse_server/actions.py.
// Players send them by hand today; AI-driven residents will use the same set later. The
// server checks every request, so the client never decides whether one is allowed.

/** Put a resident at `target`. Instant and in a straight line until movement rules exist. */
export type MoveToAction = { type: 'move_to'; residentId: ResidentId; target: Position };

/**
 * Leave the game for good: pending offers are called off, items are lost and coins still
 * count for the ranking. The game goes on for everyone else.
 */
export type LeaveGameAction = { type: 'leave_game'; residentId: ResidentId };

export type Action = MoveToAction | LeaveGameAction;
