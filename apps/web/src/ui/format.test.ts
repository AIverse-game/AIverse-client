import { describe, expect, it } from 'vitest';
import { formatDuration } from './format';

describe('formatDuration', () => {
  it.each([
    [1200, '20:00'],
    [61, '1:01'],
    [59.2, '1:00'],
    [0.4, '0:01'],
    [0, '0:00'],
  ])('shows %s seconds as %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});
