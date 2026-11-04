import type { PricePointView } from '@aiverse/protocol';

// Where the energy price history goes on a line chart: pure geometry, drawn by `PriceChartPanel`.

export interface ChartSize {
  width: number;
  height: number;
}

/** Room left around the plot for the axis labels. */
export interface ChartMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChartTick {
  /** Where along its axis, in chart units. */
  at: number;
  label: string;
  /** The value it stands for, in seconds on the time axis and coins on the price axis. */
  value: number;
}

export interface PriceChart {
  /** SVG path data for the price line; a sale is a vertical step. */
  path: string;
  /** The last point, where the line ends. */
  last: { x: number; y: number };
  timeTicks: ChartTick[];
  priceTicks: ChartTick[];
  /** Where `referencePrice` falls on the price axis; null when it lies outside it. */
  referenceY: number | null;
  minPrice: number;
  maxPrice: number;
}

/** Share of the price range kept free above and below the line. */
const PRICE_PADDING = 0.08;

/** Smallest price range shown, so a flat line sits in the middle and not on an edge. */
const MIN_PRICE_RANGE = 1;

const PRICE_TICKS = 3;

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Lays out `history` (oldest first) in a chart of `size` with the plot inset by `margins`: time
 * runs from the first point to the last along the bottom, price from just below the lowest to
 * just above the highest up the side. `referencePrice` is the base price the line is read
 * against. Null while there are fewer than two points, or all at one instant: no line yet.
 */
export function layoutPriceChart(
  history: readonly PricePointView[],
  size: ChartSize,
  margins: ChartMargins,
  referencePrice: number,
  formatTime: (seconds: number) => string,
  formatPrice: (price: number) => string,
): PriceChart | null {
  const first = history[0];
  const last = history[history.length - 1];
  if (!first || !last || last.time <= first.time) return null;

  const prices = history.map((point) => point.price);
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const range = Math.max(highest - lowest, MIN_PRICE_RANGE);
  const middle = (highest + lowest) / 2;
  const padded = range * (1 + 2 * PRICE_PADDING);
  const minPrice = middle - padded / 2;
  const maxPrice = middle + padded / 2;

  const left = margins.left;
  const top = margins.top;
  const plotWidth = size.width - margins.left - margins.right;
  const plotHeight = size.height - margins.top - margins.bottom;
  const x = (time: number) => left + ((time - first.time) / (last.time - first.time)) * plotWidth;
  const y = (price: number) => top + (1 - (price - minPrice) / (maxPrice - minPrice)) * plotHeight;

  const path = history
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(x(point.time))} ${round(y(point.price))}`)
    .join(' ');

  const priceTicks = Array.from({ length: PRICE_TICKS }, (_, index) => {
    const value = minPrice + ((maxPrice - minPrice) * index) / (PRICE_TICKS - 1);
    return { at: round(y(value)), label: formatPrice(value), value };
  });
  const timeTicks = [first.time, (first.time + last.time) / 2, last.time].map((time) => ({
    at: round(x(time)),
    label: formatTime(time),
    value: time,
  }));
  const inRange = referencePrice >= minPrice && referencePrice <= maxPrice;

  return {
    path,
    last: { x: round(x(last.time)), y: round(y(last.price)) },
    timeTicks,
    priceTicks,
    referenceY: inRange ? round(y(referencePrice)) : null,
    minPrice,
    maxPrice,
  };
}
