import type { Position, ResidentId } from './view';

// Operation primitives: the only ways to change the world, mirroring aiverse_server/actions.py.
// Players send them by hand today; AI-driven residents will use the same set later. The
// server checks every request, so the client never decides whether one is allowed.

/** Put a resident at `target`. Instant and in a straight line until movement rules exist. */
export type MoveToAction = { type: 'move_to'; residentId: ResidentId; target: Position };

export type Action = MoveToAction;
