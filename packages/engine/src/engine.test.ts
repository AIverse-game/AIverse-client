import type { Action, GameEvent, PlayerId } from '@aiverse/protocol';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, type Rules } from './rules';
import { resolveRound } from './resolve';
import { createMatch, type MatchState, type PlayerState } from './state';
import { isVisibleTo, viewFor } from './view';

const PROFILES = [
  { id: 'a', name: 'A', color: '#f00' },
  { id: 'b', name: 'B', color: '#0f0' },
];

function match(rules: Rules = DEFAULT_RULES): MatchState {
  return createMatch({ seed: 42, players: PROFILES, rules });
}

function withPlayer(state: MatchState, id: PlayerId, patch: Partial<PlayerState>): MatchState {
  return { ...state, players: state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

function step(state: MatchState, action: Action, id: PlayerId = 'a') {
  const result = resolveRound(state, new Map([[id, action]]));
  const event = result.events.find((e) => 'playerId' in e && e.playerId === id);
  return { state: result.state, event, player: result.state.players.find((p) => p.id === id)! };
}

describe('createMatch', () => {
  it('applies starting values to every player', () => {
    const state = match();
    expect(state.round).toBe(0);
    for (const p of state.players) {
      expect(p).toMatchObject({ zone: 'home', coins: 100, stamina: 6, inventory: { grain: 0, wood: 0, bread: 2 } });
    }
  });

  it('rejects empty, duplicate or disconnected setups', () => {
    expect(() => createMatch({ seed: 1, players: [] })).toThrow();
    expect(() => createMatch({ seed: 1, players: [PROFILES[0]!, PROFILES[0]!] })).toThrow();
    const islands: Rules = { ...DEFAULT_RULES, links: [['market', 'home']] };
    expect(() => createMatch({ seed: 1, players: PROFILES, rules: islands })).toThrow(/unreachable/);
  });
});

describe('move', () => {
  it('advances one hop per round toward a non-adjacent destination', () => {
    const first = step(match(), { type: 'move', to: 'farm' });
    expect(first.event).toMatchObject({ type: 'moved', from: 'home', to: 'market', destination: 'farm' });
    const second = step(first.state, { type: 'move', to: 'farm' });
    expect(second.player.zone).toBe('farm');
    expect(second.player.stamina).toBe(6);
  });

  it('fails without effect when already at the destination', () => {
    const { event, player } = step(match(), { type: 'move', to: 'home' });
    expect(event).toMatchObject({ type: 'actionFailed', reason: 'already_there' });
    expect(player.zone).toBe('home');
    expect(player.lastAction).toBeNull();
  });
});

describe('gather', () => {
  it('yields the zone product and costs stamina', () => {
    const { event, player } = step(withPlayer(match(), 'a', { zone: 'farm' }), { type: 'gather' });
    expect(event).toMatchObject({ type: 'gathered', item: 'grain', quantity: 3 });
    expect(player.inventory.grain).toBe(3);
    expect(player.stamina).toBe(4);
  });

  it.each([
    ['outside a gathering zone', { zone: 'market' }, 'wrong_zone'],
    ['when tired', { zone: 'forest', stamina: 1 }, 'not_enough_stamina'],
    ['when the bag cannot fit the full yield', { zone: 'forest', inventory: { grain: 0, wood: 17, bread: 2 } }, 'inventory_full'],
  ] as const)('fails %s and changes nothing', (_, patch, reason) => {
    const before = withPlayer(match(), 'a', patch);
    const { event, player } = step(before, { type: 'gather' });
    expect(event).toMatchObject({ type: 'actionFailed', reason });
    const original = before.players[0]!;
    expect(player.inventory).toEqual(original.inventory);
    expect(player.stamina).toBe(original.stamina);
  });
});

describe('craft', () => {
  const ready = { zone: 'workshop', inventory: { grain: 2, wood: 1, bread: 0 } } as const;

  it('turns 2 grain and 1 wood into 2 bread', () => {
    const { event, player } = step(withPlayer(match(), 'a', ready), { type: 'craft' });
    expect(event).toMatchObject({ type: 'crafted', item: 'bread', quantity: 2 });
    expect(player.inventory).toEqual({ grain: 0, wood: 0, bread: 2 });
    expect(player.stamina).toBe(4);
  });

  it('fails without partial consumption when materials are missing', () => {
    const before = withPlayer(match(), 'a', { ...ready, inventory: { grain: 2, wood: 0, bread: 0 } });
    const { event, player } = step(before, { type: 'craft' });
    expect(event).toMatchObject({ type: 'actionFailed', reason: 'missing_materials' });
    expect(player.inventory).toEqual({ grain: 2, wood: 0, bread: 0 });
  });
});

describe('rest', () => {
  it('restores fully with bread, or partially without', () => {
    const tired = withPlayer(match(), 'a', { stamina: 1 });
    const full = step(tired, { type: 'rest', useBread: true }).player;
    expect(full).toMatchObject({ stamina: 6, inventory: { bread: 1 } });
    const simple = step(tired, { type: 'rest', useBread: false }).player;
    expect(simple).toMatchObject({ stamina: 3, inventory: { bread: 2 } });
    const capped = step(withPlayer(match(), 'a', { stamina: 5 }), { type: 'rest', useBread: false }).player;
    expect(capped.stamina).toBe(6);
  });

  it('requires being home and having bread for a full rest', () => {
    expect(step(withPlayer(match(), 'a', { zone: 'market' }), { type: 'rest', useBread: false }).event)
      .toMatchObject({ reason: 'wrong_zone' });
    const noBread = withPlayer(match(), 'a', { stamina: 1, inventory: { grain: 0, wood: 0, bread: 0 } });
    const { event, player } = step(noBread, { type: 'rest', useBread: true });
    expect(event).toMatchObject({ reason: 'missing_materials' });
    expect(player.stamina).toBe(1);
  });
});

describe('resolveRound', () => {
  it('lets players without an action wait, and leaves the input state untouched', () => {
    const state = match();
    const snapshot = JSON.stringify(state);
    const result = resolveRound(state, new Map([['a', { type: 'move', to: 'market' }]]));
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(result.events).toContainEqual({ type: 'waited', round: 1, playerId: 'b' });
  });

  it('is deterministic for the same seed and actions', () => {
    const script: Action[] = [{ type: 'move', to: 'farm' }, { type: 'move', to: 'farm' }, { type: 'gather' }];
    const run = () => {
      let state = match();
      const events: GameEvent[] = [];
      for (const action of script) {
        const result = resolveRound(state, new Map([['a', action], ['b', { type: 'wait' }]]));
        state = result.state;
        events.push(...result.events);
      }
      return { state, events };
    };
    expect(run()).toEqual(run());
  });

  it('ends the match after the last round and refuses to continue', () => {
    let state = match({ ...DEFAULT_RULES, maxRounds: 2 });
    state = resolveRound(state, new Map()).state;
    const last = resolveRound(state, new Map());
    expect(last.events.at(-1)).toEqual({ type: 'matchEnded', round: 2 });
    expect(() => resolveRound(last.state, new Map())).toThrow(/finished/);
  });

  it('rejects actions for unknown players', () => {
    expect(() => resolveRound(match(), new Map([['ghost', { type: 'wait' }]]))).toThrow(/unknown player/);
  });
});

describe('viewFor', () => {
  it('shows private fields only to their owner', () => {
    const state = match();
    const spectator = viewFor(state, null);
    expect(spectator.self).toBeNull();
    expect(spectator.players[0]).not.toHaveProperty('inventory');
    expect(spectator.players[0]).not.toHaveProperty('stamina');
    expect(viewFor(state, 'b').self).toMatchObject({ id: 'b', stamina: 6, inventory: { bread: 2 } });
    expect(() => viewFor(state, 'ghost')).toThrow();
  });

  it('hides failure reasons from other players', () => {
    const failed: GameEvent = { type: 'actionFailed', round: 1, playerId: 'a', action: 'gather', reason: 'wrong_zone' };
    expect(isVisibleTo(failed, 'a')).toBe(true);
    expect(isVisibleTo(failed, 'b')).toBe(false);
    expect(isVisibleTo(failed, null)).toBe(false);
  });
});
