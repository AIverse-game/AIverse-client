import { marketTopPrice } from '../state/market';
import { useGameState } from '../state/storeContext';
import { formatDuration, formatPrice } from './format';
import { layoutPriceChart } from './priceChart';

const SIZE = { width: 320, height: 170 };
const MARGINS = { top: 10, right: 12, bottom: 24, left: 38 };

/**
 * The token price over the game as a line chart: it climbs while nobody sells and steps down at
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
  const plotRight = SIZE.width - MARGINS.right;
  const plotBottom = SIZE.height - MARGINS.bottom;

  return (
    <section className="panel price-chart">
      <h2>收购价走势</h2>
      {chart === null || latest === undefined ? (
        <p className="muted small">游戏刚开始，价格记录还不够画线。</p>
      ) : (
        <>
          <p className="price-chart-summary">
            <strong>{formatPrice(latest.price)}</strong> 金币 / token
            <span className="muted">
              {' '}
              · 最高 {formatPrice(Math.max(...prices))} · 最低 {formatPrice(Math.min(...prices))}
            </span>
          </p>
          <svg
            className="price-chart-plot"
            viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
            role="img"
            aria-label={`收购价走势，共 ${history.length} 个记录点，最新 ${formatPrice(latest.price)} 金币每 token`}
          >
            {chart.priceTicks.map((tick) => (
              <g key={`price-${tick.value}`}>
                <line className="grid" x1={MARGINS.left} x2={plotRight} y1={tick.at} y2={tick.at} />
                <text className="tick" x={MARGINS.left - 5} y={tick.at} textAnchor="end" dominantBaseline="middle">
                  {tick.label}
                </text>
              </g>
            ))}
            {chart.referenceY !== null && (
              <line className="reference" x1={MARGINS.left} x2={plotRight} y1={chart.referenceY} y2={chart.referenceY} />
            )}
            {chart.timeTicks.map((tick, index) => (
              <text
                key={`time-${tick.value}`}
                className="tick"
                x={tick.at}
                y={plotBottom + 15}
                textAnchor={index === 0 ? 'start' : index === chart.timeTicks.length - 1 ? 'end' : 'middle'}
              >
                {tick.label}
              </text>
            ))}
            <path className="line" d={chart.path} />
            <circle className="latest" cx={chart.last.x} cy={chart.last.y} r={3} />
          </svg>
          <p className="muted small">
            虚线是基准价 {formatPrice(market.basePrice)}，无人卖出时价格向 {formatPrice(marketTopPrice(market))}{' '}
            回升，每次卖出会让它台阶式下跌。每隔几秒记录一次，卖出时额外记录。
          </p>
        </>
      )}
    </section>
  );
}
