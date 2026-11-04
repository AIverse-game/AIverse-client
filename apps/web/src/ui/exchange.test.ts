import type { FillView } from '@aiverse/protocol';
import { expect, it } from 'vitest';
import { fillPrices, itemName, latestFills } from './exchange';

const fill = (seq: number, item: string, price: number): FillView => ({ seq, time: seq * 10, item, quantity: 1, price });
const FILLS = [fill(1, 'shard', 30), fill(2, 'energy', 16), fill(3, 'shard', 32), fill(4, 'shard', 28)];

it.each([
  ['energy', '能量'],
  ['shard', '晶砂'],
  ['C2', 'C2'],
])('names %s as %s', (item, name) => {
  expect(itemName(item)).toBe(name);
});

it('charts only the fills of the chosen item, oldest first', () => {
  expect(fillPrices(FILLS, 'shard')).toEqual([
    { time: 10, price: 30 },
    { time: 30, price: 32 },
    { time: 40, price: 28 },
  ]);
});

it('lists the latest fills of the chosen item, newest first', () => {
  expect(latestFills(FILLS, 'shard', 2).map((shown) => shown.seq)).toEqual([4, 3]);
});
