import type { FillView } from '@aiverse/protocol';
import type { PricePointView } from './priceChart';

// What the exchange panel shows about one item, from the fills the server sent.

const ITEM_NAMES: ReadonlyMap<string, string> = new Map([
  ['ad_content', '广告内容'],
  ['game_content', '游戏内容'],
]);

/** The item as the page names it; an item with no name here keeps its own. */
export function itemName(item: string): string {
  return ITEM_NAMES.get(item) ?? item;
}

/** The unit price of every fill of `item` among `fills` (oldest first), for a line chart. */
export function fillPrices(fills: readonly FillView[], item: string): PricePointView[] {
  return fills.filter((fill) => fill.item === item).map((fill) => ({ time: fill.time, price: fill.price }));
}

/** The latest `count` fills of `item`, newest first. */
export function latestFills(fills: readonly FillView[], item: string, count: number): FillView[] {
  return fills.filter((fill) => fill.item === item).slice(-count).reverse();
}
