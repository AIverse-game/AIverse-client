import { describe, expect, it } from 'vitest';
import { MEMORY_MAX_LENGTH, NOTE_MAX_LENGTH, parseDecision } from './decision';
import { parseClientMessage } from './messages';

describe('parseDecision', () => {
  it('accepts a well-formed decision and drops unknown fields', () => {
    const result = parseDecision({ action: { type: 'move', to: 'farm' }, note: '去种地', extra: 1 });
    expect(result).toEqual({ ok: true, value: { action: { type: 'move', to: 'farm' }, note: '去种地' } });
  });

  it.each([
    ['non-object input', 'gather'],
    ['missing action', { note: 'hi' }],
    ['unknown action type', { action: { type: 'steal' } }],
    ['unknown zone', { action: { type: 'move', to: 'moon' } }],
    ['wrong field type', { action: { type: 'rest', useBread: 'yes' } }],
    ['overlong note', { action: { type: 'wait' }, note: 'x'.repeat(NOTE_MAX_LENGTH + 1) }],
    ['overlong memory', { action: { type: 'wait' }, memory: 'x'.repeat(MEMORY_MAX_LENGTH + 1) }],
  ])('rejects %s with a bounded error message', (_, input) => {
    const result = parseDecision(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
      expect(result.error.length).toBeLessThanOrEqual(200);
    }
  });
});

describe('parseClientMessage', () => {
  it('accepts known messages and rejects others', () => {
    expect(parseClientMessage({ type: 'hello', protocolVersion: 1 }).ok).toBe(true);
    expect(parseClientMessage({ type: 'start' }).ok).toBe(true);
    expect(parseClientMessage({ type: 'hello', protocolVersion: '1' }).ok).toBe(false);
    expect(parseClientMessage({ type: 'resolveRound' }).ok).toBe(false);
    expect(parseClientMessage(null).ok).toBe(false);
  });
});
