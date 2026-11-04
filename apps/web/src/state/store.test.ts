import { PROTOCOL_VERSION, type ClientMessage, type RecipeView, type ServerMessage, type WorldView } from '@aiverse/protocol';
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
  springs: [{ id: 'p1', position: { x: 12, y: 20 }, radius: 4, reserve: 300 }],
  residents: [
    { id: 'a', name: '甲', color: '#112233', position: { x: 10, y: 20 }, coins: 10000, itemValue: 0, score: 10000, spendableCoins: 10000, towerBalance: 0, carriedCrystals: {}, left: false, rank: 1, energy: 200, crystals: {}, shards: 0, crystalsRefined: 0 },
  ],
  game: { ended: false, remainingSeconds: 90 },
  speech: [],
  offers: [],
  contractProposals: [],
  contracts: [],
  towers: [],
  towerRules: { price: 9000, capacity: 4, cycleSeconds: 20, yieldMultiplier: 2, rentPer100: 50, upkeepPer100: 20 },
  quarries: [],
  exchange: { books: [], fills: [], orders: [], maxOrders: 8 },
};

/** `world` with a quarry where resident a stands and a workshop elsewhere; a has refined `refined` crystals. */
const craftWorld = (refined = 0): WorldView => ({
  ...world,
  residents: [{ ...world.residents[0]!, crystalsRefined: refined }],
  quarries: [
    { id: 'q1', position: { x: 13, y: 20 }, radius: 4, reserve: 300 },
    { id: 'q2', position: { x: 11, y: 20 }, radius: 4, reserve: 300 },
  ],
  workshop: { position: { x: 60, y: 60 }, radius: 5, recipes: [{ tier: 'C1', shards: 5, energy: 15, seconds: 15 }], speedupPerCrystal: 0.1, fastestShare: 0.5 },
});

describe('GameStore', () => {
  it('sends tower actions and keeps installed crystals out of manual harvesting', () => {
    const { connection, sent, deliver } = fakeConnection();
    const store = new GameStore(connection);
    const message = { ...world, market: {
      position: { x: 50, y: 50 }, radius: 5, basePrice: 20, depth: 400, halfLifeSeconds: 60, restingPressure: -200, pressure: 0,
      crystals: [{ tier: 'C1', price: 300, energyPerJob: 30 }], priceHistory: [],
    }, residents: [{ ...world.residents[0]!, crystals: {}, carriedCrystals: {}, towerBalance: 500, spendableCoins: 9500 }] };

    deliver(WELCOME);
    deliver({ type: 'state', world: message });
    store.act({ type: 'install_crystal', residentId: 'a', towerId: 1, crystal: 'C1', deposit: 500 });
    deliver({ type: 'action_result', ok: false, code: 'not_enough_items', message: 'no carried crystal' });

    expect(store.bestCrystal('a')).toBeNull();
    expect(store.isFree('a')).toBe(true);
    expect(sent.at(-1)).toMatchObject({ type: 'action', action: { type: 'install_crystal', deposit: 500 } });
    expect(store.getState().lastAction?.status).toBe('rejected');
    expect(store.getState().world?.residents[0]?.towerBalance).toBe(500);
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
    const market = { position: { x: 12, y: 23 }, radius: 4, basePrice: 20, depth: 400, halfLifeSeconds: 60, restingPressure: -200, pressure: 100, crystals: [], priceHistory: [] };
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

  it('allows only leaving while the resident is harvesting', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver(WELCOME);
    deliver({ type: 'state', world });
    expect(store.isFree('a')).toBe(true);
    const [resident] = world.residents;
    const harvesting = { springId: 'p1', amount: 30, crystal: 'C1', remainingSeconds: 10 };
    deliver({ type: 'state', world: { ...world, residents: [{ ...resident!, crystals: { C1: 1 }, harvesting }] } });
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

  it.each([
    ['digging', { digging: { quarryId: 'q1', amount: 6, remainingSeconds: 5 } }],
    ['refining', { refining: { tier: 'C1', remainingSeconds: 5 } }],
  ])('allows only talking and leaving while the resident is %s', (_, job) => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver(WELCOME);
    const busy = craftWorld();

    deliver({ type: 'state', world: { ...busy, residents: [{ ...busy.residents[0]!, ...job }] } });

    expect([store.canAct('a'), store.isFree('a')]).toEqual([true, false]);
  });

  it('finds the nearest quarry a resident stands within reach of', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver(WELCOME);

    deliver({ type: 'state', world: craftWorld() });

    expect(store.quarryInReach('a')?.id).toBe('q2');
  });

  it('tells whether a resident stands at the workshop', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver(WELCOME);
    const crafted = craftWorld();

    deliver({ type: 'state', world: { ...crafted, residents: [{ ...crafted.residents[0]!, position: { x: 63, y: 64 } }] } });

    expect(store.atWorkshop('a')).toBe(true);
  });

  // The same numbers as the server's test_workshop.py, refine_seconds for the C1 recipe.
  it.each([
    [0, 15],
    [1, 13.5],
    [3, 10.5],
    [5, 7.5],
    [9, 7.5],
  ])('estimates refining for a resident who refined %i crystals at %f seconds', (refined, seconds) => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver(WELCOME);
    const crafted = craftWorld(refined);

    deliver({ type: 'state', world: crafted });

    expect(store.refineSeconds('a', crafted.workshop!.recipes[0]!)).toBeCloseTo(seconds);
  });

  const C1: RecipeView = { tier: 'C1', shards: 5, energy: 15, seconds: 15 };
  const C2: RecipeView = { tier: 'C2', shards: 5, energy: 15, consumes: 'C1', seconds: 30 };

  it.each([
    ['enough of everything', C1, {}, false],
    ['too few shards', C1, { shards: 4 }, true],
    ['too little energy', C1, { energy: 14 }, true],
    ['no lower crystal carried', C2, {}, true],
    ['the lower crystal carried', C2, { carriedCrystals: { C1: 1 } }, false],
  ])('tells whether a resident lacks the materials with %s', (_, recipe, owned, lacks) => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    deliver(WELCOME);
    const crafted = craftWorld();

    deliver({ type: 'state', world: { ...crafted, residents: [{ ...crafted.residents[0]!, shards: 5, energy: 15, ...owned }] } });

    expect(store.lacksMaterials('a', recipe)).toBe(lacks);
  });

  it('finds the spring a resident stands within reach of', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    expect(store.springInReach('a')).toBeNull();
    deliver({ type: 'state', world });
    expect(store.springInReach('a')?.id).toBe('p1');
    const [resident] = world.residents;
    const away = { ...resident!, position: { x: 10, y: 30 } };
    deliver({ type: 'state', world: { ...world, residents: [away] } });
    expect(store.springInReach('a')).toBeNull();
  });

  it('names the best crystal a resident owns, by what the market lists', () => {
    const { connection, deliver } = fakeConnection();
    const store = new GameStore(connection);
    expect(store.bestCrystal('a')).toBeNull();
    const crystals = [
      { tier: 'C1', price: 300, energyPerJob: 30 },
      { tier: 'C2', price: 1200, energyPerJob: 60 },
      { tier: 'C3', price: 3000, energyPerJob: 100 },
    ];
    const market = { position: { x: 50, y: 50 }, radius: 5, basePrice: 20, depth: 400, halfLifeSeconds: 60, restingPressure: -200, pressure: 0, crystals, priceHistory: [] };
    const [resident] = world.residents;
    const owning = (owned: Record<string, number>) => ({ ...world, market, residents: [{ ...resident!, crystals: owned, carriedCrystals: owned }] });
    deliver({ type: 'state', world: owning({}) });
    expect(store.bestCrystal('a')).toBeNull();
    deliver({ type: 'state', world: owning({ C1: 3, C2: 1 }) });
    expect(store.bestCrystal('a')?.tier).toBe('C2');
    deliver({ type: 'state', world: owning({ C3: 1, C1: 1 }) });
    expect(store.bestCrystal('a')?.tier).toBe('C3');
    expect(store.bestCrystal('nobody')).toBeNull();
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
