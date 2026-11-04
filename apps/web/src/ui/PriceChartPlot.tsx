import type { ChartMargins, ChartSize, PriceChart } from './priceChart';

/** Draws a laid-out price chart: grid and labels, the optional reference line, the line itself. */
export function PriceChartPlot({
  chart,
  size,
  margins,
  label,
}: {
  chart: PriceChart;
  size: ChartSize;
  margins: ChartMargins;
  label: string;
}) {
  const plotRight = size.width - margins.right;
  const plotBottom = size.height - margins.bottom;
  return (
    <svg className="price-chart-plot" viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label={label}>
      {chart.priceTicks.map((tick) => (
        <g key={`price-${tick.value}`}>
          <line className="grid" x1={margins.left} x2={plotRight} y1={tick.at} y2={tick.at} />
          <text className="tick" x={margins.left - 5} y={tick.at} textAnchor="end" dominantBaseline="middle">
            {tick.label}
          </text>
        </g>
      ))}
      {chart.referenceY !== null && (
        <line className="reference" x1={margins.left} x2={plotRight} y1={chart.referenceY} y2={chart.referenceY} />
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
  );
}
