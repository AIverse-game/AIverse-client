import type { ServerMessage } from '@aiverse/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalServer, LOCAL_ROUND_MS, LOCAL_VIEWER_ID } from './server';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('local server', () => {
  it('plays a full demo match over JSON messages without faults', async () => {
    const errors: unknown[] = [];
    const host = createLocalServer({
      seed: 123,
      scheduler: {
        now: () => Date.now(),
        setTimeout: (callback, ms) => setTimeout(callback, ms),
        clearTimeout: (handle) => clearTimeout(handle as number),
      },
      onError: (error) => errors.push(error),
    });
    const inbox: ServerMessage[] = [];
    const session = host.connect(
      {
        send: (message) => {
          const wire = JSON.stringify(message);
          expect(JSON.parse(wire)).toEqual(message);
          inbox.push(JSON.parse(wire) as ServerMessage);
        },
      },
      { viewerId: LOCAL_VIEWER_ID },
    );

    session.receive(JSON.parse(JSON.stringify({ type: 'hello', protocolVersion: 1 })));
    expect(inbox[0]).toMatchObject({ type: 'welcome', viewerId: LOCAL_VIEWER_ID, roundDurationMs: LOCAL_ROUND_MS });
    session.receive({ type: 'start' });
    await vi.advanceTimersByTimeAsync(LOCAL_ROUND_MS * 61);

    const states = inbox.flatMap((m) => (m.type === 'state' ? [m] : []));
    const rounds = states.map((m) => m.world.round);
    expect(rounds.slice(-3)).toEqual([58, 59, 60]);
    expect(states.at(-1)?.phase).toBe('finished');
    expect(errors).toEqual([]);
    // Rule agents should mostly act, not stall: most of the viewer's rounds succeed.
    const effective = new Set(['moved', 'gathered', 'crafted', 'rested']);
    const acted = states.filter((m) =>
      m.events.some((e) => effective.has(e.type) && 'playerId' in e && e.playerId === LOCAL_VIEWER_ID),
    );
    expect(acted.length).toBeGreaterThan(30);
  });
});
