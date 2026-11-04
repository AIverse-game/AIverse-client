import type { FillView, PricePointView } from '@aiverse/protocol';

// What the exchange panel shows about one item, from the fills the server sent.

const ITEM_NAMES: Readonly<Record<string, string>> = { energy: '能量', shard: '晶砂' };

/** The item as the page names it; crystal tiers keep their own names. */
export function itemName(item: string): string {
  return ITEM_NAMES[item] ?? item;
}

/** The unit price of every fill of `item` among `fills` (oldest first), for a line chart. */
export function fillPrices(fills: readonly FillView[], item: string): PricePointView[] {
  return fills.filter((fill) => fill.item === item).map((fill) => ({ time: fill.time, price: fill.price }));
}

/** The latest `count` fills of `item`, newest first. */
export function latestFills(fills: readonly FillView[], item: string, count: number): FillView[] {
  return fills.filter((fill) => fill.item === item).slice(-count).reverse();
}
