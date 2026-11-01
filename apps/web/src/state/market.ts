import type { MarketView } from '@aiverse/protocol';

// The market price as the server defines it (see `marketSchema`), followed locally between
// snapshots like the countdown and the walks. Only for display: the server prices each sale.

/** Recent sales in tokens `elapsedSeconds` after the snapshot, drifted towards rest since then. */
export function marketPressure(market: MarketView, elapsedSeconds: number): number {
  const drift = 2 ** (-Math.max(elapsedSeconds, 0) / market.halfLifeSeconds);
  return market.restingPressure + (market.pressure - market.restingPressure) * drift;
}

/** Coins a token fetches once nobody has sold for a very long while. */
export function marketTopPrice(market: MarketView): number {
  return (market.basePrice * market.depth) / (market.depth + market.restingPressure);
}

/** Coins one more token fetches `elapsedSeconds` after the snapshot, before rounding. */
export function marketPrice(market: MarketView, elapsedSeconds: number): number {
  return (market.basePrice * market.depth) / (market.depth + marketPressure(market, elapsedSeconds));
}

/** Whole coins selling `quantity` tokens would fetch `elapsedSeconds` after the snapshot. */
export function marketQuote(market: MarketView, elapsedSeconds: number, quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 1) return 0;
  const depth = market.depth + marketPressure(market, elapsedSeconds);
  // The same slack as the server, so float noise just under a whole number keeps its coin.
  return Math.floor(market.basePrice * market.depth * Math.log1p(quantity / depth) + 1e-9);
}
