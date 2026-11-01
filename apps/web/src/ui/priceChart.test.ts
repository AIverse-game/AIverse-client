import { describe, expect, it } from 'vitest';
import { layoutPriceChart } from './priceChart';

const size = { width: 200, height: 100 };
const margins = { top: 10, right: 10, bottom: 10, left: 10 };
const time = (seconds: number) => `${seconds}s`;
const price = (value: number) => value.toFixed(1);
const layout = (history: { time: number; price: number }[], reference = 20) =>
  layoutPriceChart(history, size, margins, reference, time, price);

describe('layoutPriceChart', () => {
  it('draws nothing until the history spans some time', () => {
    expect(layout([])).toBeNull();
    expect(layout([{ time: 0, price: 20 }])).toBeNull();
    expect(layout([{ time: 3, price: 20 }, { time: 3, price: 18 }])).toBeNull();
  });

  it('runs time left to right across the plot and puts higher prices higher up', () => {
    const chart = layout([{ time: 0, price: 20 }, { time: 10, price: 30 }])!;

    // Plot is x 10..190, y 10..90; the line starts at the left edge low and ends at the right high.
    expect(chart.path.startsWith('M10 ')).toBe(true);
    expect(chart.last.x).toBe(190);
    const [startY, endY] = chart.path.match(/ (\d+(?:\.\d+)?)/g)!.map((part) => Number(part));
    expect(endY).toBeLessThan(startY!);
    expect(chart.last.y).toBe(endY);
    expect(chart.timeTicks.map((tick) => tick.label)).toEqual(['0s', '5s', '10s']);
    expect(chart.timeTicks.map((tick) => tick.at)).toEqual([10, 100, 190]);
  });

  it('draws a sale as a vertical step', () => {
    const chart = layout([
      { time: 0, price: 20 },
      { time: 5, price: 24 },
      { time: 5, price: 12 },
      { time: 10, price: 14 },
    ])!;

    const points = chart.path.split(' L').map((part) => part.replace('M', '').split(' '));
    expect(points).toHaveLength(4);
    expect(points[1]![0]).toBe(points[2]![0]);
    expect(Number(points[2]![1])).toBeGreaterThan(Number(points[1]![1]));
  });

  it('pads the price axis around the line and labels it bottom to top', () => {
    const chart = layout([{ time: 0, price: 20 }, { time: 10, price: 30 }])!;

    expect(chart.minPrice).toBeLessThan(20);
    expect(chart.maxPrice).toBeGreaterThan(30);
    expect(chart.priceTicks.map((tick) => tick.value)).toEqual([
      chart.minPrice,
      (chart.minPrice + chart.maxPrice) / 2,
      chart.maxPrice,
    ]);
    expect(chart.priceTicks[0]!.at).toBe(90);
    expect(chart.priceTicks[2]!.at).toBe(10);
  });

  it('centres a flat line in a minimum range', () => {
    const chart = layout([{ time: 0, price: 20 }, { time: 10, price: 20 }])!;

    expect(chart.maxPrice - chart.minPrice).toBeGreaterThan(1);
    expect(chart.last.y).toBe(50);
  });

  it('marks the reference price only when the axis reaches it', () => {
    const history = [{ time: 0, price: 20 }, { time: 10, price: 30 }];

    expect(layout(history, 25)!.referenceY).not.toBeNull();
    expect(layout(history, 5)!.referenceY).toBeNull();
    expect(layout(history, 100)!.referenceY).toBeNull();
  });
});
