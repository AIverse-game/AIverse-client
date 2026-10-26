import {
  ZONE_IDS,
  type GameEvent,
  type PlayerId,
  type PrivatePlayer,
  type PublicPlayer,
  type WorldView,
} from '@aiverse/protocol';
import { neighborsOf } from './map';
import type { MatchState, PlayerState } from './state';

// The only way state leaves the engine. Fields are copied, so callers cannot
// mutate authoritative state through a view.

function toPublic(player: PlayerState): PublicPlayer {
  const { id, name, color, zone, coins, lastAction } = player;
  return { id, name, color, zone, coins, lastAction };
}

function toPrivate(player: PlayerState): PrivatePlayer {
  return { ...toPublic(player), stamina: player.stamina, inventory: { ...player.inventory } };
}

export function viewFor(state: MatchState, viewerId: PlayerId | null): WorldView {
  const { rules } = state;
  const self = viewerId === null ? undefined : state.players.find((p) => p.id === viewerId);
  if (viewerId !== null && !self) throw new Error(`unknown viewer: ${viewerId}`);
  return {
    round: state.round,
    maxRounds: rules.maxRounds,
    maxStamina: rules.maxStamina,
    inventoryCapacity: rules.inventoryCapacity,
    zones: ZONE_IDS.map((id) => ({ id, neighbors: neighborsOf(rules, id) })),
    players: state.players.map(toPublic),
    self: self ? toPrivate(self) : null,
  };
}

/** Failure reasons reveal private resources, so only the acting player sees them. */
export function isVisibleTo(event: GameEvent, viewerId: PlayerId | null): boolean {
  return event.type !== 'actionFailed' || event.playerId === viewerId;
}
