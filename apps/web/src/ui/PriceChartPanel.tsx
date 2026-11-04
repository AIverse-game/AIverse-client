import { marketTopPrice } from '../state/market';
import { useGameState } from '../state/storeContext';
import { formatDuration, formatPrice } from './format';
import { layoutPriceChart } from './priceChart';
import { PriceChartPlot } from './PriceChartPlot';

const SIZE = { width: 320, height: 170 };
const MARGINS = { top: 10, right: 12, bottom: 24, left: 38 };

/**
 * The energy price over the game as a line chart: it climbs while nobody sells and steps down at
 * every sale. Drawn from the points the server notes, so it moves with each state, not every
 * second.
 */
export function PriceChartPanel() {
  const { world } = useGameState();
  const market = world?.market;
  if (!market) return null;

  const history = market.priceHistory;
  const chart = layoutPriceChart(history, SIZE, MARGINS, market.basePrice, formatDuration, formatPrice);
  const latest = history[history.length - 1];
  const prices = history.map((point) => point.price);

  return (
    <section className="panel price-chart">
      <h2>收购价走势</h2>
      {chart === null || latest === undefined ? (
        <p className="muted small">游戏刚开始，价格记录还不够画线。</p>
      ) : (
        <>
          <p className="price-chart-summary">
            <strong>{formatPrice(latest.price)}</strong> 金币 / 能量
            <span className="muted">
              {' '}
              · 最高 {formatPrice(Math.max(...prices))} · 最低 {formatPrice(Math.min(...prices))}
            </span>
          </p>
          <PriceChartPlot
            chart={chart}
            size={SIZE}
            margins={MARGINS}
            label={`收购价走势，共 ${history.length} 个记录点，最新 ${formatPrice(latest.price)} 金币每能量`}
          />
          <p className="muted small">
            虚线是基准价 {formatPrice(market.basePrice)}，无人卖出时价格向 {formatPrice(marketTopPrice(market))}{' '}
            回升，每次卖出会让它台阶式下跌。每隔几秒记录一次，卖出时额外记录。
          </p>
        </>
      )}
    </section>
  );
}
