import { describe, expect, it } from 'vitest';
import { parseServerMessage } from './messages';

const resident = (id: string, x: number, y: number) => ({
  id,
  name: id,
  color: '#e4572e',
  position: { x, y },
  coins: 10000,
  spendableCoins: 10000,
  towerBalance: 0,
  carriedCrystals: {},
  left: false,
  rank: 1,
  energy: 200,
  crystals: {},
});

const game = { ended: false, remainingSeconds: 1200 };

const tower = { id: 1, ownerId: 'a', springId: 'p1', slots: [{
  id: 1, residentId: 'b', crystal: 'C1', balance: 404, harvested: 30, rentPaid: 90,
  status: 'running', remainingSeconds: 20, energyPerCycle: 30, rentPerCycle: 90, upkeepPerCycle: 6,
}] };

const spring = (id: string, x: number, y: number) => ({ id, position: { x, y }, radius: 4, reserve: 300 });

const state = (size: unknown, residents: unknown[], clock: unknown = game, springs: unknown[] = []) => ({
  type: 'state',
  world: { map: { size }, springs, residents, game: clock, speech: [], offers: [], contractProposals: [], contracts: [], towers: [], towerRules: { price: 9000, capacity: 4, cycleSeconds: 20, yieldMultiplier: 2, rentPer100: 50, upkeepPer100: 20 } },
});

const withTower = (equipment: unknown, clock: unknown = game) => {
  const message = state(100, [resident('a', 1, 1), resident('b', 2, 2)], clock, [spring('p1', 10, 10)]);
  return { ...message, world: { ...message.world, towers: [equipment] } };
};

it('accepts prepaid automatic harvesting slots', () => {
  const parsed = parseServerMessage(withTower(tower));

  expect(parsed.ok).toBe(true);
});

it.each([
  ['unknown owner', { ...tower, ownerId: 'missing' }],
  ['unknown spring', { ...tower, springId: 'missing' }],
  ['unknown renter', { ...tower, slots: [{ ...tower.slots[0], residentId: 'missing' }] }],
  ['negative balance', { ...tower, slots: [{ ...tower.slots[0], balance: -1 }] }],
  ['unknown crystal', { ...tower, slots: [{ ...tower.slots[0], crystal: 'C4' }] }],
  ['duplicate slot', { ...tower, slots: [...tower.slots, ...tower.slots] }],
  ['over capacity', { ...tower, slots: Array.from({ length: 5 }, (_, id) => ({ ...tower.slots[0], id: id + 1 })) }],
])('refuses a tower with %s', (_, equipment) => {
  expect(parseServerMessage(withTower(equipment)).ok).toBe(false);
});

it('refuses occupied slots after the game ends', () => {
  expect(parseServerMessage(withTower(tower, { ended: true, remainingSeconds: 0 })).ok).toBe(false);
});

const withSpeech = (speech: unknown[]) => {
  const message = state(100, [resident('a', 1, 1), resident('b', 2, 2)]);
  return { ...message, world: { ...message.world, speech } };
};

const withDeals = (deals: Record<string, unknown[]>) => {
  const message = state(100, [resident('a', 1, 1), resident('b', 2, 2)]);
  return { ...message, world: { ...message.world, ...deals } };
};

const offer = { eventId: 1, side: 'sell', fromId: 'b', toId: 'a', item: 'energy', quantity: 5, price: 80 };

const proposal = {
  eventId: 2,
  fromId: 'a',
  toId: 'b',
  supplierId: 'b',
  buyerId: 'a',
  item: 'energy',
  quantity: 10,
  price: 100,
  deliveries: 3,
  durationSeconds: 60,
  deposit: 0,
};

const contract = {
  id: 1,
  supplierId: 'b',
  buyerId: 'a',
  item: 'energy',
  quantity: 10,
  price: 100,
  deliveriesLeft: 2,
  escrow: 200,
  deposit: 20,
  depositHeld: 40,
  remainingSeconds: 42.5,
};

const line = { seq: 1, time: 3.5, speakerId: 'a', text: '有人吗？', listeners: ['b'] };

const crystals = [
  { tier: 'C1', price: 300, energyPerJob: 30 },
  { tier: 'C2', price: 1200, energyPerJob: 60 },
];

const market = { position: { x: 50, y: 50 }, radius: 5, basePrice: 20, depth: 400, halfLifeSeconds: 60, restingPressure: -200, pressure: 0, crystals, priceHistory: [] };

const withMarket = (value: unknown) => {
  const message = state(100, []);
  return { ...message, world: { ...message.world, market: value } };
};

describe('parseServerMessage', () => {
  it('accepts a map whose residents sit anywhere inside it, edges included', () => {
    const message = state(100, [resident('a', 0, 0), resident('b', 100, 100), resident('c', 12.5, 99.9)]);
    expect(parseServerMessage(message)).toEqual({ ok: true, value: message });
  });

  it('accepts springs and a resident harvesting one of them with a crystal', () => {
    const harvester = {
      ...resident('a', 1, 1),
      crystals: { C1: 2, C2: 1 },
      harvesting: { springId: 'p1', amount: 60, crystal: 'C2', remainingSeconds: 9.5 },
    };
    const message = state(100, [harvester], game, [spring('p1', 10, 10), spring('p2', 100, 0)]);
    expect(parseServerMessage(message)).toEqual({ ok: true, value: message });
  });

  it('accepts a resident walking to a spot inside the map, edges included', () => {
    const walker = { ...resident('a', 1, 1), walking: { target: { x: 100, y: 0 }, remainingSeconds: 39.6 } };
    const message = state(100, [walker]);
    expect(parseServerMessage(message)).toEqual({ ok: true, value: message });
  });

  it('accepts a market inside the map, and a map without one', () => {
    const message = withMarket({ ...market, position: { x: 100, y: 0 }, pressure: 12.5 });
    expect(parseServerMessage(message)).toEqual({ ok: true, value: message });
    expect(parseServerMessage(state(100, [])).ok).toBe(true);
  });

  it('accepts a price history with a step at one instant', () => {
    const priceHistory = [
      { time: 0, price: 20 },
      { time: 5, price: 21.2 },
      { time: 8, price: 22 },
      { time: 8, price: 18.4 },
    ];
    const message = withMarket({ ...market, priceHistory });
    expect(parseServerMessage(message)).toEqual({ ok: true, value: message });
  });

  it('accepts a market below zero pressure after nobody sold for a while', () => {
    const message = withMarket({ ...market, pressure: -84 });
    expect(parseServerMessage(message)).toEqual({ ok: true, value: message });
  });

  it('accepts speech aloud and to one resident', () => {
    const message = withSpeech([line, { ...line, seq: 2, to: 'b' }, { ...line, seq: 3, listeners: [] }]);
    expect(parseServerMessage(message)).toEqual({ ok: true, value: message });
  });

  it('accepts residents driven by a model or a scripted brain', () => {
    const message = state(100, [
      { ...resident('a', 1, 1), agent: { model: 'vendor/model' } },
      { ...resident('b', 2, 2), agent: {} },
    ]);
    expect(parseServerMessage(message)).toEqual({ ok: true, value: message });
  });

  it('accepts the viewed resident\'s offers, contract proposals and contracts', () => {
    const message = withDeals({ offers: [offer], contractProposals: [proposal], contracts: [contract] });
    expect(parseServerMessage(message)).toEqual({ ok: true, value: message });
  });

  it('accepts welcome and error messages, including unknown error codes', () => {
    expect(parseServerMessage({ type: 'welcome', protocolVersion: 6 })).toEqual({
      ok: true,
      value: { type: 'welcome', protocolVersion: 6, llmOverrides: [] },
    });
    const overriding = { type: 'welcome', protocolVersion: 11, llmOverrides: ['apiKey', 'somethingNew'] };
    expect(parseServerMessage(overriding)).toEqual({ ok: true, value: overriding });
    expect(parseServerMessage({ type: 'error', code: 'something_new', message: 'x' }).ok).toBe(true);
  });

  it('accepts action results with and without a rejection reason', () => {
    expect(parseServerMessage({ type: 'action_result', ok: true }).ok).toBe(true);
    const rejected = { type: 'action_result', ok: false, code: 'out_of_bounds', message: 'x' };
    expect(parseServerMessage(rejected)).toEqual({ ok: true, value: rejected });
  });

  it('accepts agent results with and without a rejection reason', () => {
    expect(parseServerMessage({ type: 'agent_result', residentId: 'a', ok: true }).ok).toBe(true);
    const rejected = { type: 'agent_result', residentId: 'a', ok: false, code: 'missing_llm_setting', message: 'missing api_key' };
    expect(parseServerMessage(rejected)).toEqual({ ok: true, value: rejected });
  });

  it.each([
    ['non-object input', 'state'],
    ['agent result without ok', { type: 'agent_result', residentId: 'a' }],
    ['agent result without its resident', { type: 'agent_result', ok: true }],
    ['overrides that are not a list', { type: 'welcome', protocolVersion: 11, llmOverrides: 'apiKey' }],
    ['agent model that is not text', state(100, [{ ...resident('a', 1, 1), agent: { model: 7 } }])],
    ['action result without ok', { type: 'action_result' }],
    ['unknown message type', { type: 'resolveRound' }],
    ['missing map', { type: 'state', world: { residents: [] } }],
    ['non-positive size', state(0, [])],
    ['size as a string', state('100', [])],
    ['resident left of the map', state(100, [resident('a', -0.1, 5)])],
    ['resident below the map', state(100, [resident('a', 5, 100.1)])],
    ['coordinate as a string', state(100, [{ ...resident('a', 1, 1), position: { x: '1', y: 1 } }])],
    ['malformed color', state(100, [{ ...resident('a', 1, 1), color: 'red' }])],
    ['duplicate resident ids', state(100, [resident('a', 1, 1), resident('a', 2, 2)])],
    ['negative coins', state(100, [{ ...resident('a', 1, 1), coins: -1 }])],
    ['fractional coins', state(100, [{ ...resident('a', 1, 1), coins: 1.5 }])],
    ['missing left flag', state(100, [{ ...resident('a', 1, 1), left: undefined }])],
    ['rank below 1', state(100, [{ ...resident('a', 1, 1), rank: 0 }])],
    ['missing game', { type: 'state', world: { map: { size: 100 }, residents: [] } }],
    ['negative remaining time', state(100, [], { ended: false, remainingSeconds: -1 })],
    ['missing energy', state(100, [{ ...resident('a', 1, 1), energy: undefined }])],
    ['fractional energy', state(100, [{ ...resident('a', 1, 1), energy: 0.5 }])],
    ['missing springs', { type: 'state', world: { map: { size: 100 }, residents: [], game } }],
    ['spring outside the map', state(100, [], game, [spring('p1', 101, 5)])],
    ['duplicate spring ids', state(100, [], game, [spring('p1', 1, 1), spring('p1', 2, 2)])],
    ['negative reserve', state(100, [], game, [{ ...spring('p1', 1, 1), reserve: -1 }])],
    [
      'harvesting an unknown spring',
      state(100, [{ ...resident('a', 1, 1), harvesting: { springId: 'p9', amount: 1, crystal: 'C1', remainingSeconds: 1 } }]),
    ],
    [
      'harvesting without saying which crystal',
      state(100, [{ ...resident('a', 1, 1), harvesting: { springId: 'p1', amount: 1, remainingSeconds: 1 } }], game, [
        spring('p1', 1, 1),
      ]),
    ],
    ['missing crystals', state(100, [{ ...resident('a', 1, 1), crystals: undefined }])],
    ['a crystal count of zero', state(100, [{ ...resident('a', 1, 1), crystals: { C1: 0 } }])],
    ['market without crystals on sale', withMarket({ ...market, crystals: undefined })],
    ['a crystal without a price', withMarket({ ...market, crystals: [{ tier: 'C1', energyPerJob: 30 }] })],
    [
      'walking off the map',
      state(100, [{ ...resident('a', 1, 1), walking: { target: { x: 100.1, y: 0 }, remainingSeconds: 1 } }]),
    ],
    [
      'walking with negative time left',
      state(100, [{ ...resident('a', 1, 1), walking: { target: { x: 5, y: 5 }, remainingSeconds: -1 } }]),
    ],
    ['market outside the map', withMarket({ ...market, position: { x: 50, y: 100.1 } })],
    ['market pressure not a number', withMarket({ ...market, pressure: Number.NaN })],
    ['market without a resting pressure', withMarket({ ...market, restingPressure: undefined })],
    ['market without a price', withMarket({ ...market, basePrice: undefined })],
    ['market without a price history', withMarket({ ...market, priceHistory: undefined })],
    ['a price point without a price', withMarket({ ...market, priceHistory: [{ time: 1 }] })],
    ['a price point before the start', withMarket({ ...market, priceHistory: [{ time: -1, price: 20 }] })],
    ['a free price point', withMarket({ ...market, priceHistory: [{ time: 1, price: 0 }] })],
    ['market with no reach', withMarket({ ...market, radius: 0 })],
    ['missing speech', { type: 'state', world: { map: { size: 100 }, springs: [], residents: [], game } }],
    ['speech by an unknown resident', withSpeech([{ ...line, speakerId: 'z' }])],
    ['speech heard by an unknown resident', withSpeech([{ ...line, listeners: ['z'] }])],
    ['speech to an unknown resident', withSpeech([{ ...line, to: 'z' }])],
    ['speech to the speaker', withSpeech([{ ...line, to: 'a', listeners: [] }])],
    ['empty speech', withSpeech([{ ...line, text: '' }])],
    ['missing offers', { type: 'state', world: { map: { size: 100 }, springs: [], residents: [], game, speech: [] } }],
    ['an offer from an unknown resident', withDeals({ offers: [{ ...offer, fromId: 'z' }] })],
    ['an offer to oneself', withDeals({ offers: [{ ...offer, toId: 'b' }] })],
    ['an offer of no items', withDeals({ offers: [{ ...offer, quantity: 0 }] })],
    ['an offer on an unknown side', withDeals({ offers: [{ ...offer, side: 'swap' }] })],
    ['a proposal between others than its parties', withDeals({ contractProposals: [{ ...proposal, supplierId: 'a', buyerId: 'a' }] })],
    [
      'a proposal whose parties are not its sender and recipient',
      {
        ...withDeals({ contractProposals: [{ ...proposal, supplierId: 'a', buyerId: 'c' }] }),
        world: {
          ...withDeals({}).world,
          residents: [resident('a', 1, 1), resident('b', 2, 2), resident('c', 3, 3)],
          contractProposals: [{ ...proposal, supplierId: 'a', buyerId: 'c' }],
        },
      },
    ],
    ['a proposal without a duration', withDeals({ contractProposals: [{ ...proposal, durationSeconds: undefined }] })],
    ['a contract with an unknown buyer', withDeals({ contracts: [{ ...contract, buyerId: 'z' }] })],
    ['a contract holding the wrong escrow', withDeals({ contracts: [{ ...contract, escrow: 300 }] })],
    ['a contract holding the wrong deposit', withDeals({ contracts: [{ ...contract, depositHeld: 20 }] })],
    ['a proposal with a negative deposit', withDeals({ contractProposals: [{ ...proposal, deposit: -1 }] })],
    ['a contract with negative time left', withDeals({ contracts: [{ ...contract, remainingSeconds: -1 }] })],
  ])('rejects %s with a bounded error message', (_, input) => {
    const result = parseServerMessage(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
      expect(result.error.length).toBeLessThanOrEqual(200);
    }
  });
});

const turn = {
  seq: 1, time: 0, endedAt: 2, summary: '稳健经营',
  before: { coins: 10000, energy: 200 }, after: { coins: 9700, energy: 200 },
  calls: [{ name: 'buy_crystal', arguments: "{'model': 'C1'}", time: 1, ok: true, coinsChange: -300, energyChange: 0 }],
};

it('accepts a selected resident timeline with measured resource changes', () => {
  const message = state(100, [resident('a', 1, 1)]);

  const parsed = parseServerMessage({ ...message, world: { ...message.world, agentTimeline: { residentId: 'a', turns: [turn] } } });

  expect(parsed.ok).toBe(true);
  if (parsed.ok && parsed.value.type === 'state') expect(parsed.value.world.agentTimeline?.turns[0]).toEqual(turn);
});

it.each([
  { ...turn, after: { coins: -1, energy: 200 } },
  { ...turn, calls: [{ ...turn.calls[0], coinsChange: 0.5 }] },
  { ...turn, summary: 'a'.repeat(501) },
])('rejects an invalid timeline entry', (invalid) => {
  const message = state(100, [resident('a', 1, 1)]);

  const parsed = parseServerMessage({ ...message, world: { ...message.world, agentTimeline: { residentId: 'a', turns: [invalid] } } });

  expect(parsed.ok).toBe(false);
});

it('counts bounded timeline text in Unicode code points like the server', () => {
  const message = state(100, [resident('a', 1, 1)]);

  const parsed = parseServerMessage({ ...message, world: { ...message.world, agentTimeline: { residentId: 'a', turns: [{ ...turn, summary: '🌱'.repeat(500) }] } } });

  expect(parsed.ok).toBe(true);
});
