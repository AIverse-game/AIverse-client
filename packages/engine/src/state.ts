import { ITEM_IDS, type ActionType, type Inventory, type PlayerId, type ZoneId } from '@aiverse/protocol';
import { assertConnected } from './map';
import { seedRandom } from './rng';
import { DEFAULT_RULES, type Rules } from './rules';

export interface PlayerProfile {
  id: PlayerId;
  name: string;
  color: string;
}

export interface PlayerState extends PlayerProfile {
  zone: ZoneId;
  coins: number;
  stamina: number;
  inventory: Inventory;
  /** Action that took effect in the last resolved round; null if none did. */
  lastAction: ActionType | null;
}

/** Complete authoritative state. Treat as immutable: resolution returns a new object. */
export interface MatchState {
  rules: Rules;
  /** Rounds already resolved. */
  round: number;
  rng: number;
  /** Seat order; stable for the whole match. */
  players: PlayerState[];
}

export interface MatchSetup {
  seed: number;
  players: PlayerProfile[];
  rules?: Rules;
}

export function createMatch({ seed, players, rules = DEFAULT_RULES }: MatchSetup): MatchState {
  if (players.length === 0) throw new Error('a match needs at least one player');
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    throw new Error('player ids must be unique');
  }
  assertConnected(rules);
  return {
    rules,
    round: 0,
    rng: seedRandom(seed),
    players: players.map((profile) => ({
      id: profile.id,
      name: profile.name,
      color: profile.color,
      zone: rules.startZone,
      coins: rules.startingCoins,
      stamina: rules.startingStamina,
      inventory: { ...rules.startingInventory },
      lastAction: null,
    })),
  };
}

export function isFinished(state: MatchState): boolean {
  return state.round >= state.rules.maxRounds;
}

export function inventoryCount(inventory: Inventory): number {
  return ITEM_IDS.reduce((sum, item) => sum + inventory[item], 0);
}
