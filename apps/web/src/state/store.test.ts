import { PROTOCOL_VERSION, type ClientMessage, type ServerMessage, type WorldView } from '@aiverse/protocol';
import { describe, expect, it } from 'vitest';
import type { GameConnection } from '../net/connection';
import { GameStore } from './store';

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

const world: WorldView = {
  map: { size: 100 },
  pools: [{ id: 'p1', position: { x: 12, y: 20 }, radius: 4, reserve: 300 }],
  residents: [
    { id: 'a', name: '甲', color: '#112233', position: { x: 10, y: 20 }, coins: 10000, left: false, rank: 1, tokens: 200 },
  ],
  game: { ended: false, remainingSeconds: 90 },
};

describe('GameStore', () => {
  it('greets the server, becomes ready on welcome and keeps the latest world', () => {
    const { connection, sent, deliver } = fakeConnection();
    const store = new GameStore(connection);
    expect(sent).toEqual([{ type: 'hello', protocolVersion: PROTOCOL_VERSION }]);
    deliver({ type: 'welcome', protocolVersion: PROTOCOL_VERSION });
    deliver({ type: 'state', world });
    expect(store.getState()).toMatchObject({ connection: 'ready', world, error: null, selected: null, lastAction: null });
  });

  it('marks the connection failed when the authority cannot be reached', () => {
    const { connection, fail } = fakeConnection();
    const store = new GameStore(connection);
    fail('server unreachable');
    expect(store.getState()).toMatchObject({ connection: 'failed', error: 'server unreachable' });
  });

  it.each([
    ['the server rejects our version', { type: 'error', code: 'protocol_mismatch', message: 'server speaks protocol 3' }],
    ['the server speaks another version', { type: 'welcome', protocolVersion: 2 }],
  ] as const)('fails and closes the connection when %s', (_, message) => {
    const { connection, deliver } = fakeConnection();
    let closed = false;
    connection.close = () => (closed = true);
    const store = new GameStore(connection);
    deliver(message);
    expect(store.getState().connection).toBe('failed');
    expect(store.getState().error).toMatch(/^protocol_mismatch: /);
    expect(closed).toBe(true);
  });

  it('notifies subscribers and surfaces server errors', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    let calls = 0;
    store.subscribe(() => calls++);
    deliver({ type: 'error', code: 'bad_message', message: 'type: invalid' });
    expect(calls).toBe(1);
    expect(store.getState()).toMatchObject({ connection: 'connecting', error: 'bad_message: type: invalid' });
  });

  it('sends primitives only once connected and tracks their outcome', () => {
    const { connection, sent, deliver } = fakeConnection();
    const store = new GameStore(connection);
    const move = { type: 'move_to', residentId: 'a', target: { x: 30, y: 40 } } as const;
    store.act(move);
    expect(sent).toHaveLength(1);
    expect(store.getState().lastAction).toBeNull();

    deliver({ type: 'welcome', protocolVersion: PROTOCOL_VERSION });
    store.act(move);
    expect(sent.at(-1)).toEqual({ type: 'action', action: move });
    expect(store.getState().lastAction).toEqual({ status: 'pending' });
    deliver({ type: 'action_result', ok: true });
    expect(store.getState().lastAction).toEqual({ status: 'accepted' });
    deliver({ type: 'action_result', ok: false, code: 'out_of_bounds', message: 'outside' });
    expect(store.getState().lastAction).toEqual({ status: 'rejected', reason: 'out_of_bounds: outside' });
  });

  it('counts the remaining time down on the local clock from each snapshot', () => {
    const { connection, deliver } = fakeConnection();
    let now = 5000;
    const store = new GameStore(connection, () => now);
    expect(store.remainingSeconds()).toBeNull();
    deliver({ type: 'state', world });
    expect(store.remainingSeconds()).toBe(90);
    now += 30_000;
    expect(store.remainingSeconds()).toBe(60);
    now += 120_000;
    expect(store.remainingSeconds()).toBe(0);
    deliver({ type: 'state', world: { ...world, game: { ended: true, remainingSeconds: 0 } } });
    expect(store.remainingSeconds()).toBe(0);
  });

  it('follows the market price on the local clock and knows who stands at the market', () => {
    const { connection, deliver } = fakeConnection();
    let now = 5000;
    const store = new GameStore(connection, () => now);
    expect(store.marketPrice()).toBeNull();
    const market = { position: { x: 12, y: 23 }, radius: 4, basePrice: 20, depth: 100, halfLifeSeconds: 60, pressure: 100 };
    deliver({ type: 'state', world: { ...world, market } });
    expect(store.marketPrice()).toBeCloseTo(10);
    expect(store.atMarket('a')).toBe(true);
    expect(store.atMarket('nobody')).toBe(false);
    now += 60_000;
    expect(store.marketPrice()).toBeCloseTo(20 / 1.5);
    expect(store.marketQuote(30)).toBeGreaterThan(0);
    // Once the game is over the price stops moving.
    deliver({ type: 'state', world: { ...world, market, game: { ended: true, remainingSeconds: 0 } } });
    now += 600_000;
    expect(store.marketPrice()).toBeCloseTo(10);
    deliver({ type: 'state', world: { ...world, market: { ...market, position: { x: 12, y: 25 } } } });
    expect(store.atMarket('a')).toBe(false);
  });

  it('allows acting only while connected, the game is on and the resident is still in it', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver({ type: 'state', world });
    expect(store.canAct('a')).toBe(false);
    deliver({ type: 'welcome', protocolVersion: PROTOCOL_VERSION });
    expect(store.canAct('a')).toBe(true);
    expect(store.canAct('nobody')).toBe(false);
    const [resident] = world.residents;
    deliver({ type: 'state', world: { ...world, residents: [{ ...resident!, left: true }] } });
    expect(store.canAct('a')).toBe(false);
    deliver({ type: 'state', world: { ...world, game: { ended: true, remainingSeconds: 0 } } });
    expect(store.canAct('a')).toBe(false);
  });

  it('allows only leaving while the resident is mining', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver({ type: 'welcome', protocolVersion: PROTOCOL_VERSION });
    deliver({ type: 'state', world });
    expect(store.isFree('a')).toBe(true);
    const [resident] = world.residents;
    const mining = { poolId: 'p1', amount: 30, remainingSeconds: 10 };
    deliver({ type: 'state', world: { ...world, residents: [{ ...resident!, mining }] } });
    expect(store.canAct('a')).toBe(true);
    expect(store.isFree('a')).toBe(false);
  });

  it('allows only leaving while the resident is walking', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver({ type: 'welcome', protocolVersion: PROTOCOL_VERSION });
    const [resident] = world.residents;
    const walking = { target: { x: 5, y: 5 }, remainingSeconds: 2 };
    deliver({ type: 'state', world: { ...world, residents: [{ ...resident!, walking }] } });
    expect(store.canAct('a')).toBe(true);
    expect(store.isFree('a')).toBe(false);
  });

  it('finds the pool a resident stands within reach of', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    expect(store.poolInReach('a')).toBeNull();
    deliver({ type: 'state', world });
    expect(store.poolInReach('a')?.id).toBe('p1');
    const [resident] = world.residents;
    const away = { ...resident!, position: { x: 10, y: 30 } };
    deliver({ type: 'state', world: { ...world, residents: [away] } });
    expect(store.poolInReach('a')).toBeNull();
  });

  it('drops the selection when the selected resident leaves the world', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver({ type: 'state', world });
    store.select('a');
    deliver({ type: 'state', world });
    expect(store.getState().selected).toBe('a');
    deliver({ type: 'state', world: { ...world, residents: [] } });
    expect(store.getState().selected).toBeNull();
  });

  it.each([
    ['the connection fails', (t: ReturnType<typeof fakeConnection>) => t.fail('gone')],
    ['the server answers with an error', (t: ReturnType<typeof fakeConnection>) =>
      t.deliver({ type: 'error', code: 'bad_message', message: 'action: invalid' })],
  ])('stops showing a pending action when %s', (_, interrupt) => {
    const test = fakeConnection();
    const store = new GameStore(test.connection);
    test.deliver({ type: 'welcome', protocolVersion: PROTOCOL_VERSION });
    store.act({ type: 'move_to', residentId: 'a', target: { x: 1, y: 1 } });
    interrupt(test);
    expect(store.getState().lastAction).toBeNull();
  });
});
