import type { Position, ResidentId } from './view';

// Operation primitives: the only ways to change the world, mirroring aiverse_server/game/actions.py.
// Players send them by hand today; AI-driven residents use a larger set. The server checks every
// request, so the client never decides whether one is allowed.

/** Set a resident walking to `target` in a straight line at a steady pace; walking costs time only. */
export type MoveToAction = { type: 'move_to'; residentId: ResidentId; target: Position };

/**
 * Leave the game for good: pending offers are called off, items are lost and coins still
 * count for the ranking. The game goes on for everyone else.
 */
export type LeaveGameAction = { type: 'leave_game'; residentId: ResidentId };

/**
 * Say `text`, at most 300 characters after trimming, aloud to every resident within earshot, or,
 * given `to`, to that one resident wherever they are. Free, and works while walking.
 */
export type SayAction = { type: 'say'; residentId: ResidentId; text: string; to?: ResidentId };

export type BuyParcelAction = { type: 'buy_parcel'; residentId: ResidentId };
export type BuildFacilityAction = { type: 'build_facility'; residentId: ResidentId; parcelId: string; kind: 'ad' | 'portal' | 'game_hall' | 'workspace' | 'mall' | 'garden'; source: 'self' | 'on_demand'; /** Which way a mall runs; north_south when left out. */ orientation?: 'north_south' | 'east_west' };
export type MakeContentAction = { type: 'make_content'; residentId: ResidentId; content: 'ad' | 'game'; source: 'self' | 'on_demand' };
export type PlaceContentAction = { type: 'place_content'; residentId: ResidentId; parcelId: string };

export type Action = MoveToAction | LeaveGameAction | SayAction | BuyParcelAction | BuildFacilityAction | MakeContentAction | PlaceContentAction;
