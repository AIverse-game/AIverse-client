import type { MarketView } from '@aiverse/protocol';
import { describe, expect, it } from 'vitest';
import { marketPressure, marketPrice, marketQuote, marketTopPrice } from './market';

const calm: MarketView = {
  position: { x: 50, y: 50 },
  radius: 5,
  basePrice: 20,
  depth: 400,
  halfLifeSeconds: 60,
  restingPressure: -200,
  pressure: 0,
  programs: [],
  priceHistory: [],
};

describe('market price', () => {
  it('pays the base price in a calm market and sums the price over a sale', () => {
    expect(marketPrice(calm, 0)).toBe(20);
    // The same figures the server's tests use.
    expect(marketQuote(calm, 0, 30)).toBe(578);
    expect(marketQuote(calm, 0, 100)).toBe(1785);
  });

  it('halves the price at a pressure of the depth and recovers as the pressure fades', () => {
    const busy = { ...calm, pressure: 400 };
    expect(marketPrice(busy, 0)).toBeCloseTo(10);
    // Halfway from 400 to the resting -200.
    expect(marketPressure(busy, 60)).toBeCloseTo(100);
    expect(marketPrice(busy, 60)).toBeCloseTo(16);
    expect(marketQuote(busy, 60, 30)).toBeGreaterThan(marketQuote(busy, 0, 30));
  });

  it('pays more than the base price the longer nobody sells, up to its top', () => {
    // Halfway from 0 to the resting -200: 20 * 400 / 300.
    expect(marketPrice(calm, 60)).toBeCloseTo(80 / 3);
    expect(marketPrice(calm, 6000)).toBeCloseTo(40);
    expect(marketTopPrice(calm)).toBe(40);
  });

  it('prices a snapshot taken after a quiet while, below zero pressure', () => {
    // The server's later state after selling 30 into a calm market, then a half-life and 1 more.
    const quiet = { ...calm, pressure: -84 };
    expect(marketPrice(quiet, 0)).toBeCloseTo(8000 / 316);
  });

  it('treats a clock that runs behind the snapshot as no time passed', () => {
    expect(marketPressure({ ...calm, pressure: 40 }, -5)).toBe(40);
  });

  it.each([0, -1, 1.5, Number.NaN])('quotes nothing for %s compute', (quantity) => {
    expect(marketQuote(calm, 0, quantity)).toBe(0);
  });
});
