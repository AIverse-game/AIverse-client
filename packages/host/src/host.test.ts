import { DEFAULT_RULES } from '@aiverse/engine';
import type { Observation, ServerMessage } from '@aiverse/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameHost, type Decider, type HostOptions, type Scheduler } from './host';

const ROUND_MS = 1000;
const TIMEOUT_MS = 500;

const scheduler: Scheduler = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

const fixed = (decision: unknown): Decider => ({ decide: () => decision });

function makeHost(deciders: Record<string, Decider>, overrides: Partial<HostOptions> = {}) {
  return new GameHost({
    seed: 7,
    seats: Object.entries(deciders).map(([id, decider]) => ({ profile: { id, name: id, color: '#fff' }, decider })),
    scheduler,
    roundDurationMs: ROUND_MS,
    decisionTimeoutMs: TIMEOUT_MS,
    ...overrides,
  });
}

function connect(host: GameHost, viewerId: string | null) {
  const inbox: ServerMessage[] = [];
  const session = host.connect({ send: (m) => inbox.push(m) }, { viewerId });
  session.receive({ type: 'hello', protocolVersion: 1 });
  const states = () => inbox.filter((m) => m.type === 'state');
  return { inbox, session, states, last: () => states().at(-1)! };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GameHost rounds', () => {
  it('applies valid decisions once per round on a fixed cadence', async () => {
    const host = makeHost({ a: fixed({ action: { type: 'move', to: 'market' }, note: '出门' }) });
    const client = connect(host, 'a');
    host.start();

    await vi.advanceTimersByTimeAsync(0);
    expect(client.last().world.round).toBe(1);
    expect(client.last().world.self?.zone).toBe('market');
    expect(client.last().agent).toEqual({ lastOutcome: 'ok', lastError: null, note: '出门' });

    await vi.advanceTimersByTimeAsync(ROUND_MS - 1);
    expect(client.last().world.round).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(client.last().world.round).toBe(2);
    host.stop();
  });

  it('turns timeouts, thrown errors and invalid output into waits', async () => {
    const host = makeHost({
      slow: { decide: () => new Promise(() => {}) },
      broken: { decide: () => { throw new Error('boom'); } },
      sloppy: fixed({ action: { type: 'fly' } }),
    });
    const views = { slow: connect(host, 'slow'), broken: connect(host, 'broken'), sloppy: connect(host, 'sloppy') };
    host.start();
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);

    expect(views.slow.last().agent?.lastOutcome).toBe('timeout');
    expect(views.broken.last().agent?.lastOutcome).toBe('decider_error');
    const sloppy = views.sloppy.last().agent!;
    expect(sloppy.lastOutcome).toBe('invalid_decision');
    expect(sloppy.lastError).toMatch(/action/);
    const waited = views.slow.last().events.filter((e) => e.type === 'waited');
    expect(waited).toHaveLength(3);
    host.stop();
  });

  it('discards answers that arrive after the deadline', async () => {
    const host = makeHost({
      a: {
        decide: () => new Promise((resolve) => {
          setTimeout(() => resolve({ action: { type: 'move', to: 'market' } }), TIMEOUT_MS + 10);
        }),
      },
    });
    const client = connect(host, 'a');
    host.start();
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 20);
    expect(client.last().world.round).toBe(1);
    expect(client.last().world.self?.zone).toBe('home');
    expect(client.last().agent?.lastOutcome).toBe('timeout');
    host.stop();
  });

  it('feeds memory and last status back to the decider', async () => {
    const seen: Observation[] = [];
    const host = makeHost({
      a: { decide: (o: Observation) => { seen.push(o); return { action: { type: 'wait' }, memory: `r${o.decidingRound}` }; } },
    });
    host.start();
    await vi.advanceTimersByTimeAsync(ROUND_MS);
    expect(seen.map((o) => [o.decidingRound, o.memory])).toEqual([[1, null], [2, 'r1']]);
    expect(seen[1]!.agent.lastOutcome).toBe('ok');
    expect(seen[1]!.recentEvents).toContainEqual({ type: 'waited', round: 1, playerId: 'a' });
    host.stop();
  });

  it('finishes after the last round and stops scheduling', async () => {
    const host = makeHost({ a: fixed({ action: { type: 'wait' } }) }, { rules: { ...DEFAULT_RULES, maxRounds: 3 } });
    const client = connect(host, null);
    host.start();
    await vi.advanceTimersByTimeAsync(ROUND_MS * 5);
    expect(client.last()).toMatchObject({ phase: 'finished', world: { round: 3 } });
    expect(client.last().events.at(-1)).toEqual({ type: 'matchEnded', round: 3 });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('GameHost sessions', () => {
  it('gives each viewer only their own private state', async () => {
    const host = makeHost({ a: fixed({ action: { type: 'gather' } }), b: fixed({ action: { type: 'wait' } }) });
    const a = connect(host, 'a');
    const spectator = connect(host, null);
    host.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(a.last().world.self?.id).toBe('a');
    expect(a.last().events.some((e) => e.type === 'actionFailed')).toBe(true);
    expect(spectator.last().world.self).toBeNull();
    expect(spectator.last().agent).toBeNull();
    expect(spectator.last().events.some((e) => e.type === 'actionFailed')).toBe(false);
    host.stop();
  });

  it('rejects malformed, early, mismatched and repeated requests', () => {
    const host = makeHost({ a: fixed({ action: { type: 'wait' } }) });
    const inbox: ServerMessage[] = [];
    const session = host.connect({ send: (m) => inbox.push(m) }, { viewerId: 'a' });

    session.receive({ type: 'start' });
    session.receive('not json');
    session.receive({ type: 'hello', protocolVersion: 999 });
    session.receive({ type: 'hello', protocolVersion: 1 });
    expect(host.start()).toBe(true);
    session.receive({ type: 'start' });

    const errors = inbox.flatMap((m) => (m.type === 'error' ? [m.code] : []));
    expect(errors).toEqual(['not_ready', 'bad_message', 'protocol_mismatch', 'already_started']);
    expect(() => host.connect({ send: () => {} }, { viewerId: 'ghost' })).toThrow();
    host.stop();
  });

  it('drops a session whose link fails without stalling the match or other viewers', async () => {
    const host = makeHost({ a: fixed({ action: { type: 'wait' } }) });
    let sends = 0;
    let closed = 0;
    const flaky = host.connect(
      {
        send: () => { if (++sends > 2) throw new Error('socket closed'); },
        close: () => { closed++; throw new Error('close failed too'); },
      },
      { viewerId: 'a' },
    );
    flaky.receive({ type: 'hello', protocolVersion: 1 });
    const healthy = connect(host, null);
    host.start();
    await vi.advanceTimersByTimeAsync(ROUND_MS * 2);
    expect(healthy.states().map((m) => m.world.round)).toEqual([0, 0, 1, 2, 3]);
    expect(host.currentPhase).toBe('running');
    expect(sends).toBe(3);
    expect(closed).toBe(1);
    host.stop();
  });

  it('resolves nothing once stopped while decisions are in flight', async () => {
    const host = makeHost({
      a: { decide: () => new Promise((resolve) => setTimeout(() => resolve({ action: { type: 'wait' } }), 100)) },
    });
    const client = connect(host, 'a');
    host.start();
    await vi.advanceTimersByTimeAsync(50);
    host.stop();
    await vi.advanceTimersByTimeAsync(ROUND_MS * 3);
    expect(client.last().world.round).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops sending to closed sessions', async () => {
    const host = makeHost({ a: fixed({ action: { type: 'wait' } }) });
    const client = connect(host, 'a');
    client.session.close();
    const before = client.inbox.length;
    host.start();
    await vi.advanceTimersByTimeAsync(ROUND_MS);
    expect(client.inbox).toHaveLength(before);
    host.stop();
  });
});
