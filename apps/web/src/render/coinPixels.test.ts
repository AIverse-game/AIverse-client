import { describe, expect, it } from 'vitest';
import { amountSize } from './coinPixels';

describe('amountSize', () => {
  it('gives each letter 4 pixels and one more for the outline, 7 high', () => {
    // '+1,240' is six letters: 6 × 4 + 1.
    expect(amountSize('+1,240')).toEqual({ width: 25, height: 7 });
  });

  it('leaves out letters it has no glyph for', () => {
    expect(amountSize('12 金币')).toEqual(amountSize('12'));
  });
});
