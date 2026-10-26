import type { Action, FailureReason, GameEvent, ItemId, PlayerId } from '@aiverse/protocol';
import { nextHop } from './map';
import { nextRandom } from './rng';
import type { Rules } from './rules';
import { inventoryCount, isFinished, type MatchState, type PlayerState } from './state';

export interface RoundResult {
  state: MatchState;
  events: GameEvent[];
}

/**
 * Resolves one round. `actions` must already be protocol-valid; players without an
 * entry wait. Pure: the same state and actions always produce the same result.
 */
export function resolveRound(state: MatchState, actions: ReadonlyMap<PlayerId, Action>): RoundResult {
  if (isFinished(state)) throw new Error('match already finished');
  for (const id of actions.keys()) {
    if (!state.players.some((p) => p.id === id)) throw new Error(`unknown player: ${id}`);
  }

  const round = state.round + 1;
  const players = state.players.map((p) => ({ ...p, inventory: { ...p.inventory } }));
  // Seeded rotating order. Actions are independent today; contested resources
  // (market matching) will rely on this order instead of request arrival time.
  const [roll, rng] = nextRandom(state.rng);
  const offset = Math.floor(roll * players.length);
  const events: GameEvent[] = [];
  for (let i = 0; i < players.length; i++) {
    const player = players[(offset + i) % players.length]!;
    events.push(applyAction(state.rules, player, actions.get(player.id) ?? { type: 'wait' }, round));
  }

  const next: MatchState = { ...state, round, rng, players };
  if (isFinished(next)) events.push({ type: 'matchEnded', round });
  return { state: next, events };
}

/** Mutates the (already copied) player; failed actions change nothing but lastAction. */
function applyAction(rules: Rules, player: PlayerState, action: Action, round: number): GameEvent {
  const playerId = player.id;
  const fail = (reason: FailureReason): GameEvent => {
    player.lastAction = null;
    return { type: 'actionFailed', round, playerId, action: action.type, reason };
  };

  switch (action.type) {
    case 'move': {
      const from = player.zone;
      const to = nextHop(rules, from, action.to);
      if (to === null) return fail('already_there');
      player.zone = to;
      player.lastAction = 'move';
      return { type: 'moved', round, playerId, from, to, destination: action.to };
    }
    case 'gather': {
      const spec = rules.gather[player.zone];
      if (!spec) return fail('wrong_zone');
      if (player.stamina < spec.stamina) return fail('not_enough_stamina');
      if (inventoryCount(player.inventory) + spec.quantity > rules.inventoryCapacity) {
        return fail('inventory_full');
      }
      player.stamina -= spec.stamina;
      player.inventory[spec.item] += spec.quantity;
      player.lastAction = 'gather';
      return { type: 'gathered', round, playerId, item: spec.item, quantity: spec.quantity };
    }
    case 'craft': {
      const { zone, inputs, output } = rules.craft;
      if (player.zone !== zone) return fail('wrong_zone');
      if (player.stamina < output.stamina) return fail('not_enough_stamina');
      const required = Object.entries(inputs) as [ItemId, number][];
      if (required.some(([item, count]) => player.inventory[item] < count)) {
        return fail('missing_materials');
      }
      const consumed = required.reduce((sum, [, count]) => sum + count, 0);
      if (inventoryCount(player.inventory) - consumed + output.quantity > rules.inventoryCapacity) {
        return fail('inventory_full');
      }
      for (const [item, count] of required) player.inventory[item] -= count;
      player.inventory[output.item] += output.quantity;
      player.stamina -= output.stamina;
      player.lastAction = 'craft';
      return { type: 'crafted', round, playerId, item: output.item, quantity: output.quantity };
    }
    case 'rest': {
      if (player.zone !== rules.rest.zone) return fail('wrong_zone');
      if (action.useBread) {
        if (player.inventory.bread < 1) return fail('missing_materials');
        player.inventory.bread -= 1;
        player.stamina = rules.maxStamina;
      } else {
        player.stamina = Math.min(rules.maxStamina, player.stamina + rules.rest.simpleGain);
      }
      player.lastAction = 'rest';
      return { type: 'rested', round, playerId, usedBread: action.useBread };
    }
    case 'wait':
      player.lastAction = 'wait';
      return { type: 'waited', round, playerId };
    default: {
      const unreachable: never = action;
      throw new Error(`unhandled action: ${JSON.stringify(unreachable)}`);
    }
  }
}
