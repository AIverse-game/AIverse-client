import { formatCoordinate } from '../render/layout';
import { marketTopPrice } from '../state/market';
import { useGameState, useStore } from '../state/storeContext';
import { CrystalIcon } from './CrystalIcon';
import { formatPrice } from './format';
import { EnergyIcon } from './EnergyIcon';
import { useSecondTick } from './useSecondTick';

/** Map facts, springs and residents as text, to cross-check the drawing; picks who to operate. */
export function MapPanel() {
  const store = useStore();
  const { world, selected } = useGameState();
  if (!world) return null;
  const size = formatCoordinate(world.map.size);

  return (
    <section className="panel">
      <h2>地图</h2>
      <p className="small">
        {size} × {size}，原点 (0, 0) 是西北角，画在地图最上方的顶角；x 向右下、y 向左下增大。
      </p>
      <p className="muted small">地图已放大 3 倍，可在地图区域内滚动查看。</p>
      <h2 className="subheading">居民</h2>
      {world.residents.length === 0 ? (
        <p className="muted small">地图上暂无居民。</p>
      ) : (
        <ul className="residents">
          {world.residents.map((resident) => (
            <li key={resident.id}>
              <button
                type="button"
                aria-pressed={resident.id === selected}
                onClick={() => store.select(resident.id === selected ? null : resident.id)}
              >
                <span className="swatch" style={{ background: resident.color }} />
                <span className="name">{resident.name}</span>
                {resident.left && <span className="tag">已出局</span>}
                {resident.agent && <span className="tag tag-agent">AI</span>}
                {resident.harvesting && <span className="tag tag-harvesting">汲取中</span>}
                {resident.walking && <span className="tag tag-walking">行走中</span>}
                <span className="crystals">
                  {Object.entries(resident.crystals).map(([tier, count]) => (
                    <span key={tier} className="crystal">
                      <CrystalIcon tier={tier} alone />
                      {count > 1 && `×${count}`}
                    </span>
                  ))}
                </span>
                <span className="energy">
                  <EnergyIcon />
                  {resident.energy} 能量
                </span>
                <span className="coords">
                  ({formatCoordinate(resident.position.x)}, {formatCoordinate(resident.position.y)})
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <h2 className="subheading">能量泉</h2>
      {world.springs.length === 0 ? (
        <p className="muted small">地图上没有能量泉。</p>
      ) : (
        <ul className="springs">
          {world.springs.map((spring) => (
            <li key={spring.id} className={spring.reserve === 0 ? 'empty' : undefined}>
              <span className="name">{spring.id}</span>
              <span className="coords">
                ({formatCoordinate(spring.position.x)}, {formatCoordinate(spring.position.y)})，半径 {formatCoordinate(spring.radius)}
              </span>
              <span className="energy">
                <EnergyIcon />
                剩余 {spring.reserve}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">能量泉开局时随机放置，整局固定不动。</p>
      <MarketInfo />
    </section>
  );
}

/** Where the market is and its price right now, which recovers between snapshots. */
function MarketInfo() {
  const store = useStore();
  const { world } = useGameState();
  useSecondTick(world?.market !== undefined && !world.game.ended);
  const market = world?.market;
  if (!market) return null;
  const price = store.marketPrice() ?? market.basePrice;

  return (
    <>
      <h2 className="subheading">收购点</h2>
      <p className="small market-info">
        <span className="coords">
          ({formatCoordinate(market.position.x)}, {formatCoordinate(market.position.y)})，半径 {formatCoordinate(market.radius)}
        </span>
        <span className="price">{formatPrice(price)} 金币 / 能量</span>
      </p>
      <p className="muted small">
        镇外的买家用金币收购能量：卖得越多价格越低，没人卖时逐渐上涨，最高到 {formatPrice(marketTopPrice(market))}。所有人共用一个价格。
      </p>
      {market.crystals.length > 0 && (
        <>
          <ul className="springs">
            {market.crystals.map((tier) => (
              <li key={tier.tier}>
                <span className="name">
                  <CrystalIcon tier={tier.tier} />
                  {tier.tier}
                </span>
                <span className="coords">每次汲取 {tier.energyPerJob} 能量</span>
                <span className="energy">{tier.price.toLocaleString('zh-CN')} 金币</span>
              </li>
            ))}
          </ul>
          <p className="muted small">收购点还按定价出售晶核。没有晶核不能汲取，有几块时用最好的一块。</p>
        </>
      )}
    </>
  );
}
