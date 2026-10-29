import type { MarketView } from '@aiverse/protocol';
import { describe, expect, it } from 'vitest';
import { marketPressure, marketPrice, marketQuote } from './market';

const calm: MarketView = {
  position: { x: 50, y: 50 },
  radius: 5,
  basePrice: 20,
  depth: 100,
  halfLifeSeconds: 60,
  pressure: 0,
  chips: [],
};

describe('market price', () => {
  it('pays the base price in a calm market and sums the price over a sale', () => {
    expect(marketPrice(calm, 0)).toBe(20);
    // The same figures the server's tests use.
    expect(marketQuote(calm, 0, 30)).toBe(524);
    expect(marketQuote(calm, 0, 100)).toBe(1386);
  });

  it('halves the price at a pressure of the depth and recovers as the pressure fades', () => {
    const busy = { ...calm, pressure: 100 };
    expect(marketPrice(busy, 0)).toBeCloseTo(10);
    expect(marketPressure(busy, 60)).toBeCloseTo(50);
    expect(marketPrice(busy, 60)).toBeCloseTo(20 / 1.5);
    expect(marketPrice(busy, 6000)).toBeCloseTo(20);
    expect(marketQuote(busy, 60, 30)).toBeGreaterThan(marketQuote(busy, 0, 30));
  });

  it('treats a clock that runs behind the snapshot as no time passed', () => {
    expect(marketPressure({ ...calm, pressure: 40 }, -5)).toBe(40);
  });

  it.each([0, -1, 1.5, Number.NaN])('quotes nothing for %s tokens', (quantity) => {
    expect(marketQuote(calm, 0, quantity)).toBe(0);
  });
});
