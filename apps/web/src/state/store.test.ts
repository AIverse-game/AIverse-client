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
  map: { size: 100 },
  pools: [{ id: 'p1', position: { x: 12, y: 20 }, radius: 4, reserve: 300 }],
  residents: [
    { id: 'a', name: '甲', color: '#112233', position: { x: 10, y: 20 }, coins: 10000, spendableCoins: 10000, rigBalance: 0, carriedChips: {}, left: false, rank: 1, tokens: 200, chips: {} },
  ],
  game: { ended: false, remainingSeconds: 90 },
  speech: [],
  offers: [],
  contractProposals: [],
  contracts: [],
  rigs: [],
  rigRules: { price: 8000, capacity: 4, cycleSeconds: 20, yieldMultiplier: 2, rentPer100: 50, energyPer100: 20 },
};

describe('GameStore', () => {
  it('sends rig actions and keeps installed chips out of manual mining', () => {
    const { connection, sent, deliver } = fakeConnection();
    const store = new GameStore(connection);
    const message = { ...world, market: {
      position: { x: 50, y: 50 }, radius: 5, basePrice: 20, depth: 400, halfLifeSeconds: 60, restingPressure: -200, pressure: 0,
      chips: [{ model: 'MK1', price: 300, tokensPerJob: 30 }], priceHistory: [],
    }, residents: [{ ...world.residents[0]!, chips: {}, carriedChips: {}, rigBalance: 500, spendableCoins: 9500 }] };

    deliver(WELCOME);
    deliver({ type: 'state', world: message });
    store.act({ type: 'install_chip', residentId: 'a', rigId: 1, chip: 'MK1', deposit: 500 });
    deliver({ type: 'action_result', ok: false, code: 'not_enough_items', message: 'no carried chip' });

    expect(store.bestChip('a')).toBeNull();
    expect(store.isFree('a')).toBe(true);
    expect(sent.at(-1)).toMatchObject({ type: 'action', action: { type: 'install_chip', deposit: 500 } });
    expect(store.getState().lastAction?.status).toBe('rejected');
    expect(store.getState().world?.residents[0]?.rigBalance).toBe(500);
  });
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
    deliver({ type: 'state', world: { ...world, game: { ended: true, remainingSeconds: 0 } } });
    expect(store.remainingSeconds()).toBe(0);
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

  it('follows the market price on the local clock and knows who stands at the market', () => {
    const { connection, deliver } = fakeConnection();
    let now = 5000;
    const store = new GameStore(connection, () => now);
    expect(store.marketPrice()).toBeNull();
    const market = { position: { x: 12, y: 23 }, radius: 4, basePrice: 20, depth: 400, halfLifeSeconds: 60, restingPressure: -200, pressure: 100, chips: [], priceHistory: [] };
    deliver({ type: 'state', world: { ...world, market } });
    // 20 * 400 / (400 + 100).
    expect(store.marketPrice()).toBeCloseTo(16);
    expect(store.atMarket('a')).toBe(true);
    expect(store.atMarket('nobody')).toBe(false);
    now += 60_000;
    // Halfway from 100 to the resting -200: 20 * 400 / 350.
    expect(store.marketPrice()).toBeCloseTo(160 / 7);
    expect(store.marketQuote(30)).toBeGreaterThan(0);
    // Once the game is over the price stops moving.
    deliver({ type: 'state', world: { ...world, market, game: { ended: true, remainingSeconds: 0 } } });
    now += 600_000;
    expect(store.marketPrice()).toBeCloseTo(16);
    deliver({ type: 'state', world: { ...world, market: { ...market, position: { x: 12, y: 25 } } } });
    expect(store.atMarket('a')).toBe(false);
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
    deliver({ type: 'state', world: { ...world, game: { ended: true, remainingSeconds: 0 } } });
    expect(store.canAct('a')).toBe(false);
  });

  it('allows only leaving while the resident is mining', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver(WELCOME);
    deliver({ type: 'state', world });
    expect(store.isFree('a')).toBe(true);
    const [resident] = world.residents;
    const mining = { poolId: 'p1', amount: 30, chip: 'MK1', remainingSeconds: 10 };
    deliver({ type: 'state', world: { ...world, residents: [{ ...resident!, chips: { MK1: 1 }, mining }] } });
    expect(store.canAct('a')).toBe(true);
    expect(store.isFree('a')).toBe(false);
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

  it('names the best chip a resident owns, by what the market lists', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    expect(store.bestChip('a')).toBeNull();
    const chips = [
      { model: 'MK1', price: 300, tokensPerJob: 30 },
      { model: 'MK2', price: 1200, tokensPerJob: 60 },
      { model: 'MK3', price: 3000, tokensPerJob: 100 },
    ];
    const market = { position: { x: 50, y: 50 }, radius: 5, basePrice: 20, depth: 400, halfLifeSeconds: 60, restingPressure: -200, pressure: 0, chips, priceHistory: [] };
    const [resident] = world.residents;
    const owning = (owned: Record<string, number>) => ({ ...world, market, residents: [{ ...resident!, chips: owned, carriedChips: owned }] });
    deliver({ type: 'state', world: owning({}) });
    expect(store.bestChip('a')).toBeNull();
    deliver({ type: 'state', world: owning({ MK1: 3, MK2: 1 }) });
    expect(store.bestChip('a')?.model).toBe('MK2');
    deliver({ type: 'state', world: owning({ MK3: 1, MK1: 1 }) });
    expect(store.bestChip('a')?.model).toBe('MK3');
    expect(store.bestChip('nobody')).toBeNull();
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
