import type { BookView, ExchangeView, OrderView } from '@aiverse/protocol';
import { useState } from 'react';
import { useGameState, useStore } from '../state/storeContext';
import { fillPrices, itemName, latestFills } from './exchange';
import { formatDuration } from './format';
import { layoutPriceChart } from './priceChart';
import { PriceChartPlot } from './PriceChartPlot';
import { useSecondTick } from './useSecondTick';

const SIZE = { width: 320, height: 140 };
const MARGINS = { top: 10, right: 12, bottom: 24, left: 38 };
const FILLS_SHOWN = 5;

const formatCoins = (coins: number) => String(Math.round(coins));

/**
 * The anonymous exchange, read-only: one item's book, its fill prices and latest
 * fills, and the selected resident's resting orders. Orders are placed by agents for now.
 */
export function ExchangePanel() {
  const { world } = useGameState();
  const [chosen, setChosen] = useState<string | null>(null);
  const exchange = world?.exchange;
  if (!exchange) return null;
  if (exchange.books.length === 0) {
    return (
      <section className="panel exchange">
        <h2>交易所</h2>
        <p className="muted small">目前没有可以交易的商品，等居民做出可交易的内容后这里才有挂单簿。</p>
      </section>
    );
  }
  const book = exchange.books.find((candidate) => candidate.item === chosen) ?? exchange.books[0]!;

  return (
    <section className="panel exchange">
      <h2>交易所</h2>
      <div className="exchange-items" role="group" aria-label="商品">
        {exchange.books.map((candidate) => (
          <button
            key={candidate.item}
            type="button"
            aria-pressed={candidate.item === book.item}
            onClick={() => setChosen(candidate.item)}
          >
            {itemName(candidate.item)}
          </button>
        ))}
      </div>
      <BookTable book={book} />
      <FillPrices exchange={exchange} item={book.item} />
      <MyOrders exchange={exchange} />
      <p className="muted small">
        匿名交易所，在任何地方都能下单：价格最好的先成交，同价先挂先成交，按挂单方的价格成交。挂单簿只显示价位和数量，不显示是谁。页面暂时只能查看，下单和撤单由 AI 居民进行。
      </p>
    </section>
  );
}

/** Sell prices above, best (lowest) nearest the middle, buy prices below, best (highest) first. */
function BookTable({ book }: { book: BookView }) {
  if (book.bids.length === 0 && book.asks.length === 0) {
    return <p className="muted small">{itemName(book.item)}的挂单簿是空的。</p>;
  }
  const asks = [...book.asks].reverse();
  return (
    <table className="order-book">
      <thead>
        <tr>
          <th scope="col">方向</th>
          <th scope="col">单价</th>
          <th scope="col">数量</th>
        </tr>
      </thead>
      <tbody>
        {asks.map((level) => (
          <tr key={`ask-${level.price}`} className="ask">
            <td>卖</td>
            <td>{level.price.toLocaleString('zh-CN')}</td>
            <td>{level.quantity.toLocaleString('zh-CN')}</td>
          </tr>
        ))}
        {book.bids.map((level) => (
          <tr key={`bid-${level.price}`} className="bid">
            <td>买</td>
            <td>{level.price.toLocaleString('zh-CN')}</td>
            <td>{level.quantity.toLocaleString('zh-CN')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FillPrices({ exchange, item }: { exchange: ExchangeView; item: string }) {
  const { selected } = useGameState();
  // A state sent for an earlier selection marks that resident's fills, not the selected one's.
  const current = exchange.viewerId === (selected ?? undefined);
  const history = fillPrices(exchange.fills, item);
  const latest = latestFills(exchange.fills, item, FILLS_SHOWN);
  if (latest.length === 0) return <p className="muted small">最近没有{itemName(item)}成交。</p>;
  const chart = layoutPriceChart(history, SIZE, MARGINS, formatDuration, formatCoins);
  return (
    <>
      <p className="price-chart-summary">
        最近成交 <strong>{latest[0]!.price.toLocaleString('zh-CN')}</strong> 金币 / 个
      </p>
      {chart && (
        <PriceChartPlot
          chart={chart}
          size={SIZE}
          margins={MARGINS}
          label={`${itemName(item)}成交价，共 ${history.length} 笔，最新 ${latest[0]!.price} 金币每个`}
        />
      )}
      <ul className="fills">
        {latest.map((fill) => (
          <li key={fill.seq}>
            <span className="muted">{formatDuration(fill.time)}</span>
            <span>
              {fill.quantity.toLocaleString('zh-CN')} 个 × {fill.price.toLocaleString('zh-CN')} 金币
            </span>
            {current && fill.own && <span className="tag">{fill.own === 'bought' ? '所选居民买入' : '所选居民卖出'}</span>}
          </li>
        ))}
      </ul>
      <p className="muted small">时间是开局以来的游戏时间；页面只收到全部商品最近 100 笔成交。</p>
    </>
  );
}

function MyOrders({ exchange }: { exchange: ExchangeView }) {
  const store = useStore();
  const { world, selected } = useGameState();
  useSecondTick(exchange.orders.length > 0 && !world?.game.ended);
  const resident = world?.residents.find((candidate) => candidate.id === selected);
  if (!resident) return <p className="muted small">选中一名居民可以看到其挂单。</p>;
  // Until the server answers the new selection, the orders are the previous resident's.
  if (exchange.viewerId !== resident.id) return <p className="muted small">正在载入{resident.name}的挂单…</p>;
  return (
    <>
      <h2 className="subheading">
        {resident.name}的挂单（{exchange.orders.length}/{exchange.maxOrders}）
      </h2>
      {exchange.orders.length === 0 ? (
        <p className="muted small">没有挂单。</p>
      ) : (
        <ul className="fills">
          {exchange.orders.map((order) => (
            <li key={order.id}>
              <span>#{order.id}</span>
              <span>{orderText(order)}</span>
              <span className="muted">{formatDuration(store.countdown(order.remainingSeconds))} 后到期</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function orderText(order: OrderView): string {
  const verb = order.side === 'buy' ? '买' : '卖';
  return `${verb} ${order.quantity.toLocaleString('zh-CN')} ${itemName(order.item)} × ${order.price.toLocaleString('zh-CN')} 金币`;
}
