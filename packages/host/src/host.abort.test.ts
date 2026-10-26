import type { ServerMessage } from '@aiverse/protocol';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GameHost } from './host';

vi.mock('@aiverse/engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@aiverse/engine')>()),
  resolveRound: () => {
    throw new Error('engine fault');
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('aborts the match, notifies viewers and reports the fault', async () => {
  const errors: unknown[] = [];
  const host = new GameHost({
    seed: 1,
    seats: [{ profile: { id: 'a', name: 'a', color: '#fff' }, decider: { decide: () => ({ action: { type: 'wait' } }) } }],
    scheduler: {
      now: () => Date.now(),
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    },
    roundDurationMs: 1000,
    decisionTimeoutMs: 500,
    onError: (error) => errors.push(error),
  });
  const inbox: ServerMessage[] = [];
  host.connect({ send: (m) => inbox.push(m) }, { viewerId: 'a' }).receive({ type: 'hello', protocolVersion: 1 });
  host.start();
  await vi.advanceTimersByTimeAsync(5000);

  expect(host.currentPhase).toBe('aborted');
  expect(inbox.at(-1)).toMatchObject({ type: 'state', phase: 'aborted' });
  expect(errors).toEqual([new Error('engine fault')]);
  expect(vi.getTimerCount()).toBe(0);
});
