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

const WELCOME: ServerMessage = { type: 'welcome', protocolVersion: PROTOCOL_VERSION, llmOverrides: [] };

const world: WorldView = {
  map: { size: 100, parcelSize: 10, blockCells: 1, venueCells: 1, lobby: false, parcelPrices: Array.from({ length: 10 }, () => Array(10).fill(1000)) },
  parcels: [],
  jobs: [],
  residents: [
    { id: 'a', name: '甲', color: '#112233', position: { x: 10, y: 20 }, coins: 10000, spendableCoins: 10000, left: false, rank: 1 },
  ],
  game: { ended: false, remainingSeconds: 90, elapsedSeconds: 30 },
  speech: [],
  offers: [],
  contractProposals: [],
  contracts: [],
  worldLog: [],
  exchange: { books: [], fills: [], orders: [], maxOrders: 8 },
};

describe('GameStore', () => {
  it('greets the server, becomes ready on welcome and keeps the latest world', () => {
    const { connection, sent, deliver } = fakeConnection();
    const store = new GameStore(connection);
    expect(sent).toEqual([{ type: 'hello', protocolVersion: PROTOCOL_VERSION }]);
    deliver(WELCOME);
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
    ['the server speaks another version', { type: 'welcome', protocolVersion: 2, llmOverrides: [] as string[] }],
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

    deliver(WELCOME);
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
    deliver({ type: 'state', world: { ...world, game: { ended: true, remainingSeconds: 0, elapsedSeconds: 120 } } });
    expect(store.remainingSeconds()).toBe(0);
  });

  it('counts the game time up on the local clock from each snapshot and stops it when the game ends', () => {
    const { connection, deliver } = fakeConnection();
    let now = 5000;
    const store = new GameStore(connection, () => now);
    expect(store.gameSeconds()).toBeNull();

    deliver({ type: 'state', world });
    now += 12_000;
    const running = store.gameSeconds();
    deliver({ type: 'state', world: { ...world, game: { ended: true, remainingSeconds: 0, elapsedSeconds: 120 } } });
    now += 60_000;

    expect(running).toBe(42);
    expect(store.gameSeconds()).toBe(120);
  });

  it('counts other timers, such as a contract lapsing, down from the latest snapshot', () => {
    const { connection, deliver } = fakeConnection();
    let now = 5000;
    const store = new GameStore(connection, () => now);
    deliver({ type: 'state', world });
    now += 10_000;
    expect(store.countdown(45)).toBe(35);
    expect(store.countdown(5)).toBe(0);
    deliver({ type: 'state', world });
    expect(store.countdown(45)).toBe(45);
  });

  it('allows acting only while connected, the game is on and the resident is still in it', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver({ type: 'state', world });
    expect(store.canAct('a')).toBe(false);
    deliver(WELCOME);
    expect(store.canAct('a')).toBe(true);
    expect(store.canAct('nobody')).toBe(false);
    const [resident] = world.residents;
    deliver({ type: 'state', world: { ...world, residents: [{ ...resident!, left: true }] } });
    expect(store.canAct('a')).toBe(false);
    deliver({ type: 'state', world: { ...world, game: { ended: true, remainingSeconds: 0, elapsedSeconds: 120 } } });
    expect(store.canAct('a')).toBe(false);
  });

  it('allows only leaving while the resident is walking', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver(WELCOME);
    const [resident] = world.residents;
    const walking = { target: { x: 5, y: 5 }, remainingSeconds: 2 };
    deliver({ type: 'state', world: { ...world, residents: [{ ...resident!, walking }] } });
    expect(store.canAct('a')).toBe(true);
    expect(store.isFree('a')).toBe(false);
  });

  it('drops the selection when the selected resident leaves the world', () => {
    const { connection, deliver, sent } = fakeConnection();
    const store = new GameStore(connection);
    deliver({ type: 'state', world });
    store.select('a');
    deliver({ type: 'state', world });
    expect(store.getState().selected).toBe('a');
    deliver({ type: 'state', world: { ...world, residents: [] } });
    expect(store.getState().selected).toBeNull();
    expect(sent.at(-1)).toEqual({ type: 'view_as', residentId: null });
  });

  it('tells the server whom the page views as, so only their whispers arrive', () => {
    const { connection, deliver, sent } = fakeConnection();
    const store = new GameStore(connection);
    deliver(WELCOME);
    deliver({ type: 'state', world });
    store.select('a');
    store.select('a');
    store.select(null);
    expect(sent.slice(1)).toEqual([
      { type: 'view_as', residentId: 'a' },
      { type: 'view_as', residentId: null },
    ]);
  });

  it.each([
    ['the connection fails', (t: ReturnType<typeof fakeConnection>) => t.fail('gone')],
    ['the server answers with an error', (t: ReturnType<typeof fakeConnection>) =>
      t.deliver({ type: 'error', code: 'bad_message', message: 'action: invalid' })],
  ])('stops showing a pending action when %s', (_, interrupt) => {
    const test = fakeConnection();
    const store = new GameStore(test.connection);
    test.deliver(WELCOME);
    store.act({ type: 'move_to', residentId: 'a', target: { x: 1, y: 1 } });
    interrupt(test);
    expect(store.getState().lastAction).toBeNull();
  });

  it('hands a resident to a model with the settings filled in, blanks left out', () => {
    const { connection, sent, deliver } = fakeConnection();
    const store = new GameStore(connection);
    store.startAgent('a', { baseUrl: 'https://x/v1', apiKey: 'k' });
    expect(sent).toHaveLength(1);
    deliver({ ...WELCOME, llmOverrides: ['model'] });
    expect(store.getState().llmOverrides).toEqual(['model']);
    store.startAgent('a', { baseUrl: ' https://x/v1 ', apiKey: 'k', model: '  ' });
    expect(sent.at(-1)).toEqual({ type: 'start_agent', residentId: 'a', llm: { baseUrl: 'https://x/v1', apiKey: 'k' } });
    expect(store.getState().agentRequests).toEqual({ a: { status: 'pending' } });
    deliver({ type: 'agent_result', residentId: 'a', ok: false, code: 'missing_llm_setting', message: 'missing model' });
    expect(store.getState().agentRequests).toEqual({ a: { status: 'rejected', reason: 'missing_llm_setting: missing model' } });
    store.stopAgent('a');
    expect(sent.at(-1)).toEqual({ type: 'stop_agent', residentId: 'a' });
    deliver({ type: 'agent_result', residentId: 'a', ok: true });
    expect(store.getState().agentRequests).toEqual({ a: { status: 'accepted' } });
  });

  it('shows each agent result on the resident it names', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver(WELCOME);
    store.startAgent('a', { model: 'm' });
    store.stopAgent('b');
    deliver({ type: 'agent_result', residentId: 'b', ok: true });
    expect(store.getState().agentRequests).toEqual({ a: { status: 'pending' }, b: { status: 'accepted' } });
  });

  it('gives up on pending agent requests that an error may have answered', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver(WELCOME);
    store.stopAgent('a');
    deliver({ type: 'agent_result', residentId: 'a', ok: true });
    store.stopAgent('b');
    deliver({ type: 'error', code: 'bad_message', message: 'x' });
    expect(store.getState().agentRequests).toEqual({ a: { status: 'accepted' } });
    // A result still on its way names its resident.
    deliver({ type: 'agent_result', residentId: 'b', ok: true });
    expect(store.getState().agentRequests.b).toEqual({ status: 'accepted' });
  });
});

it('sends the trimmed strategy alongside model settings', () => {
  const { connection, sent, deliver } = fakeConnection();
  const store = new GameStore(connection);
  deliver(WELCOME);

  store.startAgent('a', { model: 'm' }, '  稳健经营  ');

  expect(sent.at(-1)).toEqual({ type: 'start_agent', residentId: 'a', llm: { model: 'm' }, strategy: '稳健经营' });
});

describe('GameStore visitors', () => {
  const walker = { id: 1, position: { x: 0, y: 0 }, legs: [{ start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }] };

  it('has no visitors before the server sends any', () => {
    const { connection } = fakeConnection();

    const store = new GameStore(connection);

    expect(store.getVisitors()).toBeNull();
  });

  it('keeps the latest visitors with their arrival time without telling listeners', () => {
    const { connection, deliver } = fakeConnection();
    let time = 4000;
    const store = new GameStore(connection, () => time);
    let told = 0;
    store.subscribe(() => told++);

    deliver({ type: 'visitors', speed: 2.5, visitors: [walker] });
    const first = store.getVisitors();
    time = 6000;
    deliver({ type: 'visitors', speed: 2.5, visitors: [] });

    expect(first).toEqual({ speed: 2.5, visitors: [walker], receivedAt: 4000 });
    expect(store.getVisitors()).toEqual({ speed: 2.5, visitors: [], receivedAt: 6000 });
    expect(told).toBe(0);
  });
});
