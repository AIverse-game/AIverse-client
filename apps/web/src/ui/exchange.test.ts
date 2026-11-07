import type { FillView } from '@aiverse/protocol';
import { expect, it } from 'vitest';
import { fillPrices, itemName, latestFills } from './exchange';

const fill = (seq: number, item: string, price: number): FillView => ({ seq, time: seq * 10, item, quantity: 1, price });
const FILLS = [fill(1, 'poster', 30), fill(2, 'garden', 16), fill(3, 'poster', 32), fill(4, 'poster', 28)];

it('names an item as itself until the page knows a better name', () => {
  expect(itemName('poster')).toBe('poster');
});

it('charts only the fills of the chosen item, oldest first', () => {
  expect(fillPrices(FILLS, 'poster')).toEqual([
    { time: 10, price: 30 },
    { time: 30, price: 32 },
    { time: 40, price: 28 },
  ]);
});

it('lists the latest fills of the chosen item, newest first', () => {
  expect(latestFills(FILLS, 'poster', 2).map((shown) => shown.seq)).toEqual([4, 3]);
});
