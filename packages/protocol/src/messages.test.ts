import { describe, expect, it } from 'vitest';
import { parseServerMessage } from './messages';

const resident = (id: string, x: number, y: number) => ({
  id,
  name: id,
  color: '#e4572e',
  position: { x, y },
  coins: 10000,
  left: false,
  rank: 1,
});

const game = { ended: false, remainingSeconds: 1200 };

const state = (size: unknown, residents: unknown[], clock: unknown = game) => ({
  type: 'state',
  world: { map: { size }, residents, game: clock },
});

describe('parseServerMessage', () => {
  it('accepts a map whose residents sit anywhere inside it, edges included', () => {
    const message = state(100, [resident('a', 0, 0), resident('b', 100, 100), resident('c', 12.5, 99.9)]);
    expect(parseServerMessage(message)).toEqual({ ok: true, value: message });
  });

  it('accepts welcome and error messages, including unknown error codes', () => {
    expect(parseServerMessage({ type: 'welcome', protocolVersion: 4 }).ok).toBe(true);
    expect(parseServerMessage({ type: 'error', code: 'something_new', message: 'x' }).ok).toBe(true);
  });

  it('accepts action results with and without a rejection reason', () => {
    expect(parseServerMessage({ type: 'action_result', ok: true }).ok).toBe(true);
    const rejected = { type: 'action_result', ok: false, code: 'out_of_bounds', message: 'x' };
    expect(parseServerMessage(rejected)).toEqual({ ok: true, value: rejected });
  });

  it.each([
    ['non-object input', 'state'],
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
  ])('rejects %s with a bounded error message', (_, input) => {
    const result = parseServerMessage(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
      expect(result.error.length).toBeLessThanOrEqual(200);
    }
  });
});
