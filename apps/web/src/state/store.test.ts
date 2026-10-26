import type { ClientMessage, GameEvent, ServerMessage, WorldView } from '@aiverse/protocol';
import { describe, expect, it } from 'vitest';
import type { GameConnection } from '../net/connection';
import { GameStore, LOG_LIMIT } from './store';

function fakeConnection() {
  const sent: ClientMessage[] = [];
  let deliver: (message: ServerMessage) => void = () => {};
  let failWith: (reason: string) => void = () => {};
  const connection: GameConnection = {
    send: (message) => sent.push(message),
    onMessage(listener) {
      deliver = listener;
      return () => {};
    },
    onFailure(listener) {
      failWith = listener;
      return () => {};
    },
    close: () => {},
  };
  return {
    connection,
    sent,
    deliver: (message: ServerMessage) => deliver(message),
    fail: (reason: string) => failWith(reason),
  };
}

const world = (round: number): WorldView => ({
  round, maxRounds: 60, maxStamina: 6, inventoryCapacity: 20, zones: [], players: [], self: null,
});

const waited = (round: number, playerId = 'a'): GameEvent => ({ type: 'waited', round, playerId });

const state = (round: number, events: GameEvent[]): ServerMessage => ({
  type: 'state', phase: 'running', world: world(round), events, agent: null,
});

describe('GameStore', () => {
  it('greets the server and becomes ready on welcome', () => {
    const { connection, sent, deliver } = fakeConnection();
    const store = new GameStore(connection);
    expect(sent).toEqual([{ type: 'hello', protocolVersion: 1 }]);
    deliver({ type: 'welcome', protocolVersion: 1, viewerId: 'a', roundDurationMs: 1500 });
    expect(store.getState()).toMatchObject({ connection: 'ready', viewerId: 'a', roundDurationMs: 1500 });
  });

  it('logs each round once, newest first, within the cap', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver(state(1, [waited(1, 'a'), waited(1, 'b')]));
    deliver(state(1, [waited(1, 'a'), waited(1, 'b')]));
    expect(store.getState().log.map((entry) => entry.event)).toEqual([waited(1, 'b'), waited(1, 'a')]);

    for (let round = 2; round <= LOG_LIMIT + 5; round++) deliver(state(round, [waited(round)]));
    const { log } = store.getState();
    expect(log).toHaveLength(LOG_LIMIT);
    expect(log[0]?.event).toEqual(waited(LOG_LIMIT + 5));
    expect(new Set(log.map((entry) => entry.id)).size).toBe(LOG_LIMIT);
  });

  it('marks the connection failed when the authority cannot run', () => {
    const { connection, fail } = fakeConnection();
    const store = new GameStore(connection);
    fail('server unreachable');
    expect(store.getState()).toMatchObject({ connection: 'failed', error: 'server unreachable' });
  });

  it('notifies subscribers and surfaces server errors', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    let calls = 0;
    store.subscribe(() => calls++);
    deliver({ type: 'error', code: 'already_started', message: 'match is not in lobby' });
    expect(calls).toBe(1);
    expect(store.getState().error).toBe('already_started: match is not in lobby');
  });
});
