import { describe, expect, it } from 'vitest';
import { coinTurn, COUNT_MS, countUp } from './coinCountUp';

describe('countUp', () => {
  it('shows the old amount when the change starts and the new one once it is done', () => {
    expect(countUp(10_000, 10_260, 0)).toBe(10_000);
    expect(countUp(10_000, 10_260, COUNT_MS)).toBe(10_260);
    expect(countUp(10_000, 10_260, COUNT_MS * 3)).toBe(10_260);
  });

  it('runs quickly at first and slows towards the end, in whole coins', () => {
    // Eased out by 1 - (1 - k)^3: halfway through it has covered 7/8 of the way.
    const halfway = countUp(0, 800, COUNT_MS / 2);

    expect(halfway).toBe(700);
  });

  it.each([
    ['up', 100, 160],
    ['down', 160, 100],
  ])('moves only towards the new amount while running %s', (_, from, to) => {
    const times = Array.from({ length: 21 }, (__, i) => (i / 20) * COUNT_MS);

    const shown = times.map((t) => countUp(from, to, t));

    const steps = shown.slice(1).map((n, i) => (n - shown[i]!) * Math.sign(to - from));
    expect(steps.filter((step) => step < 0)).toEqual([]);
  });

  it.each([
    ['up', 100, 160],
    ['down', 160, 100],
  ])('never goes past either end while running %s', (_, from, to) => {
    const times = Array.from({ length: 21 }, (__, i) => (i / 20) * COUNT_MS);

    const shown = times.map((t) => countUp(from, to, t));

    expect(shown.filter((n) => n < Math.min(from, to) || n > Math.max(from, to))).toEqual([]);
  });

  it('treats a clock that reads before the start as the start', () => {
    expect(countUp(5, 9, -40)).toBe(5);
  });
});

describe('coinTurn', () => {
  it('makes exactly one full turn and then stays put', () => {
    expect(coinTurn(0)).toBe(0);
    expect(coinTurn(COUNT_MS)).toBeCloseTo(2 * Math.PI);
    expect(coinTurn(COUNT_MS * 2)).toBeCloseTo(2 * Math.PI);
  });
});
