import { describe, expect, it } from 'vitest';
import { parseServerMessage } from './messages';
import { blockRectOf, blockRects, gridCount, inLobby, islandRect, lobbyRect, parcelAt, parcelRect, sameBlock, venueFits, venueRect, venueTaking } from './mapGrid';

const resident = (id: string, x: number, y: number) => ({
  id,
  name: id,
  color: '#e4572e',
  position: { x, y },
  coins: 10000,
  spendableCoins: 10000,
  left: false,
  rank: 1,
});

const game = { ended: false, remainingSeconds: 1200 };

const state = (size: unknown, residents: unknown[], clock: unknown = game) => ({
  type: 'state',
  world: { map: { size, parcelSize: 10, blockCells: 1, venueCells: 1, lobby: false, parcelPrices: Array.from({ length: Math.max(1, Math.floor(Number(size) / 10)) }, () => Array(Math.max(1, Math.floor(Number(size) / 10))).fill(1000)) }, parcels: [], jobs: [], residents, game: clock, speech: [], offers: [], contractProposals: [], contracts: [], exchange: { books: [], fills: [], orders: [], maxOrders: 8 } },
});

describe('visitors message', () => {
  const visitors = (value: unknown) => ({ type: 'visitors', speed: 2.5, visitors: value });

  it('accepts standing and walking visitors and treats missing legs as standing', () => {
    const message = visitors([
      { id: 1, position: { x: 5, y: 5 } },
      { id: 2, position: { x: 0, y: 0 }, legs: [{ start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }, { start: { x: 60, y: 0 }, end: { x: 70, y: 0 } }] },
    ]);

    const parsed = parseServerMessage(message);

    expect(parsed.ok).toBe(true);
    if (parsed.ok && parsed.value.type === 'visitors') {
      expect(parsed.value.visitors[0]!.legs).toEqual([]);
      expect(parsed.value.visitors[1]!.legs).toHaveLength(2);
    }
  });

  it.each([
    ['a speed of nothing', { ...visitors([]), speed: 0 }],
    ['a visitor without a position', visitors([{ id: 1 }])],
    ['a leg without an end', visitors([{ id: 1, position: { x: 0, y: 0 }, legs: [{ start: { x: 0, y: 0 } }] }])],
  ])('refuses %s', (_, message) => {
    expect(parseServerMessage(message).ok).toBe(false);
  });
});

const exchange = {
  books: [{ item: 'poster', bids: [{ price: 25, quantity: 2 }], asks: [{ price: 30, quantity: 5 }] }],
  fills: [{ seq: 1, time: 12, item: 'poster', quantity: 3, price: 30, own: 'sold' }],
  viewerId: 'a',
  orders: [{ id: 1, side: 'sell', item: 'poster', quantity: 5, price: 30, remainingSeconds: 288 }],
  maxOrders: 8,
};

const withExchange = (value: unknown) => {
  const message = state(100, [resident('a', 20, 20)]);
  return { ...message, world: { ...message.world, exchange: value } };
};

it('accepts an exchange with books, fills and the viewer\'s orders', () => {
  expect(parseServerMessage(withExchange(exchange)).ok).toBe(true);
});

it.each([
  ['an order with an unknown side', { ...exchange, orders: [{ ...exchange.orders[0], side: 'hold' }] }],
  ['a fill at no price', { ...exchange, fills: [{ ...exchange.fills[0], price: 0 }] }],
])('refuses %s', (_, value) => {
  expect(parseServerMessage(withExchange(value)).ok).toBe(false);
});

const withSpeech = (speech: unknown[]) => {
  const message = state(100, [resident('a', 1, 1), resident('b', 2, 2)]);
  return { ...message, world: { ...message.world, speech } };
};

const withDeals = (deals: Record<string, unknown[]>) => {
  const message = state(100, [resident('a', 1, 1), resident('b', 2, 2)]);
  return { ...message, world: { ...message.world, ...deals } };
};

it('accepts a built game hall with shares and rejects an invalid parcel owner', () => {
  const message = state(150, [resident('a', 75, 75)]);
  const parcel = { id: 'L7-7', col: 7, row: 7, ownerId: 'a', shares: { a: 100 }, facility: { kind: 'game_hall', contents: 2, expiresIn: [30, 250] } };
  const world = { ...message.world, parcels: [parcel], jobs: [{ id: 1, ownerId: 'a', kind: 'make_game', remainingSeconds: 30 }] };
  expect(parseServerMessage({ ...message, world }).ok).toBe(true);
  expect(parseServerMessage({ ...message, world: { ...world, parcels: [{ ...parcel, ownerId: 'missing' }] } }).ok).toBe(false);
  expect(parseServerMessage({ ...message, world: { ...world, parcels: [{ ...parcel, shares: { a: 99 } }] } }).ok).toBe(false);
  expect(parseServerMessage({ ...message, world: { ...world, parcels: [{ ...parcel, facility: { ...parcel.facility, expiresIn: [30] } }] } }).ok).toBe(false);
});

const offer = { eventId: 1, side: 'sell', fromId: 'b', toId: 'a', item: 'poster', quantity: 5, price: 80 };

const proposal = {
  eventId: 2,
  fromId: 'a',
  toId: 'b',
  supplierId: 'b',
  buyerId: 'a',
  item: 'poster',
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
  item: 'poster',
  quantity: 10,
  price: 100,
  deliveriesLeft: 2,
  escrow: 200,
  deposit: 20,
  depositHeld: 40,
  remainingSeconds: 42.5,
};

const line = { seq: 1, time: 3.5, speakerId: 'a', text: '有人吗？', listeners: ['b'] };

describe('parseServerMessage', () => {
  it('accepts a map whose residents sit anywhere inside it, edges included', () => {
    const message = state(100, [resident('a', 0, 0), resident('b', 100, 100), resident('c', 12.5, 99.9)]);
    expect(parseServerMessage(message)).toEqual({ ok: true, value: message });
  });

  it('accepts a resident walking to a spot inside the map, edges included', () => {
    const walker = { ...resident('a', 1, 1), walking: { target: { x: 100, y: 0 }, remainingSeconds: 39.6 } };
    const message = state(100, [walker]);
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
    [
      'walking off the map',
      state(100, [{ ...resident('a', 1, 1), walking: { target: { x: 100.1, y: 0 }, remainingSeconds: 1 } }]),
    ],
    [
      'walking with negative time left',
      state(100, [{ ...resident('a', 1, 1), walking: { target: { x: 5, y: 5 }, remainingSeconds: -1 } }]),
    ],
    ['missing speech', { type: 'state', world: { map: { size: 100 }, residents: [], game } }],
    ['speech by an unknown resident', withSpeech([{ ...line, speakerId: 'z' }])],
    ['speech heard by an unknown resident', withSpeech([{ ...line, listeners: ['z'] }])],
    ['speech to an unknown resident', withSpeech([{ ...line, to: 'z' }])],
    ['speech to the speaker', withSpeech([{ ...line, to: 'a', listeners: [] }])],
    ['empty speech', withSpeech([{ ...line, text: '' }])],
    ['missing offers', { type: 'state', world: { map: { size: 100 }, residents: [], game, speech: [] } }],
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
  before: { coins: 10000 }, after: { coins: 9700 },
  calls: [{ name: 'buy_parcel', arguments: '{}', time: 1, ok: true, coinsChange: -300 }],
};

it('accepts a selected resident timeline with measured resource changes', () => {
  const message = state(100, [resident('a', 1, 1)]);

  const parsed = parseServerMessage({ ...message, world: { ...message.world, agentTimeline: { residentId: 'a', turns: [turn] } } });

  expect(parsed.ok).toBe(true);
  if (parsed.ok && parsed.value.type === 'state') expect(parsed.value.world.agentTimeline?.turns[0]).toEqual(turn);
});

it.each([
  { ...turn, after: { coins: -1 } },
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

describe('mapGrid', () => {
  const map = { size: 150, parcelSize: 10, blockCells: 3, venueCells: 2 };

  it('lays blocks of three by three parcels side by side with no gap', () => {
    expect(gridCount(map)).toBe(15);
    expect(parcelRect(map, 0, 0)).toEqual({ x0: 0, z0: 0, x1: 10, z1: 10 });
    expect(blockRects(map)).toHaveLength(25);
    expect(blockRectOf(map, 4, 1)).toEqual({ x0: 30, z0: 0, x1: 60, z1: 30 });
  });

  it('finds the parcel at a position, clamped to the map', () => {
    expect(parcelAt(map, 25, 31)).toEqual({ col: 2, row: 3 });
    expect(parcelAt(map, 150, 150)).toEqual({ col: 14, row: 14 });
  });

  it('puts the lobby in the middle block and draws islands slightly inside their blocks', () => {
    expect(inLobby(map, 7, 7)).toBe(true);
    expect(inLobby(map, 5, 7)).toBe(false);
    expect(lobbyRect(map)).toEqual({ x0: 60, z0: 60, x1: 90, z1: 90 });
    expect(islandRect(lobbyRect(map))).toEqual({ x0: 62, z0: 62, x1: 88, z1: 88 });
  });

  it('tells whether two parcels are in the same block', () => {
    expect(sameBlock(map, { col: 0, row: 0 }, { col: 2, row: 2 })).toBe(true);
    expect(sameBlock(map, { col: 2, row: 2 }, { col: 3, row: 2 })).toBe(false);
  });

  it('lets a venue take up a square of parcels from its north-west corner, inside its block', () => {
    expect(venueRect(map, 4, 1)).toEqual({ x0: 40, z0: 10, x1: 60, z1: 30 });
    expect(venueFits(map, 3, 0)).toBe(true);
    expect(venueFits(map, 4, 1)).toBe(true);
    expect(venueFits(map, 5, 1)).toBe(false);
    expect(venueFits(map, 4, 2)).toBe(false);
  });

  it('finds the venue that takes up a parcel but not the venue parcel itself', () => {
    const venues = [{ col: 3, row: 0 }];

    expect(venueTaking(map, venues, 4, 1)).toEqual({ col: 3, row: 0 });
    expect(venueTaking(map, venues, 3, 1)).toEqual({ col: 3, row: 0 });
    expect(venueTaking(map, venues, 3, 0)).toBeUndefined();
    expect(venueTaking(map, venues, 5, 0)).toBeUndefined();
    expect(venueTaking(map, venues, 3, 2)).toBeUndefined();
  });

  it('keeps one parcel per ten units when there are no blocks', () => {
    const plain = { size: 105, parcelSize: 10, blockCells: 1, venueCells: 1 };

    expect(gridCount(plain)).toBe(10);
    expect(parcelRect(plain, 9, 9)).toEqual({ x0: 90, z0: 90, x1: 105, z1: 105 });
  });
});
