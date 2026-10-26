import type { ActionType } from './decision';
import type { Inventory, ItemId, PlayerId, ZoneId } from './ids';

// Read-only data the authority sends out. Views are already filtered for their viewer,
// so clients render them as-is and never derive game results themselves.

export interface ZoneView {
  id: ZoneId;
  neighbors: ZoneId[];
}

export interface PublicPlayer {
  id: PlayerId;
  name: string;
  color: string;
  zone: ZoneId;
  coins: number;
  lastAction: ActionType | null;
}

export interface PrivatePlayer extends PublicPlayer {
  stamina: number;
  inventory: Inventory;
}

export interface WorldView {
  /** Rounds already resolved; 0 before the first round. */
  round: number;
  maxRounds: number;
  maxStamina: number;
  inventoryCapacity: number;
  zones: ZoneView[];
  /** All players in seat order, with public fields only. */
  players: PublicPlayer[];
  /** The viewer's own character; null for spectators. */
  self: PrivatePlayer | null;
}

export type FailureReason =
  | 'already_there'
  | 'wrong_zone'
  | 'not_enough_stamina'
  | 'missing_materials'
  | 'inventory_full';

export type GameEvent =
  | { type: 'moved'; round: number; playerId: PlayerId; from: ZoneId; to: ZoneId; destination: ZoneId }
  | { type: 'gathered'; round: number; playerId: PlayerId; item: ItemId; quantity: number }
  | { type: 'crafted'; round: number; playerId: PlayerId; item: ItemId; quantity: number }
  | { type: 'rested'; round: number; playerId: PlayerId; usedBread: boolean }
  | { type: 'waited'; round: number; playerId: PlayerId }
  | { type: 'actionFailed'; round: number; playerId: PlayerId; action: ActionType; reason: FailureReason }
  | { type: 'matchEnded'; round: number };

export type GamePhase = 'lobby' | 'running' | 'finished' | 'aborted';

/** How the authority handled the viewer's last decision request. */
export type DecisionOutcome = 'ok' | 'timeout' | 'invalid_decision' | 'decider_error';

export interface AgentStatus {
  lastOutcome: DecisionOutcome | null;
  /** Validation error fed back after an invalid decision. */
  lastError: string | null;
  /** The model's short explanation for its last accepted decision. */
  note: string | null;
}

/** What a decider (rule agent now, model adapter later) sees before choosing an action. */
export interface Observation {
  /** The round this decision is for, starting at 1. */
  decidingRound: number;
  world: WorldView & { self: PrivatePlayer };
  /** Events from the previous round that are visible to this player. */
  recentEvents: GameEvent[];
  agent: AgentStatus;
  memory: string | null;
}
