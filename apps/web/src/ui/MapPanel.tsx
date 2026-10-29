import { formatCoordinate } from '../render/layout';
import { useGameState, useStore } from '../state/react';
import { ChipIcon } from './ChipIcon';
import { formatPrice } from './format';
import { useSecondTick } from './useSecondTick';

/** Map facts, pools and residents as text, to cross-check the drawing; picks who to operate. */
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
                {resident.mining && <span className="tag tag-mining">采矿中</span>}
                {resident.walking && <span className="tag tag-walking">行走中</span>}
                <span className="chips">
                  {Object.entries(resident.chips).map(([model, count]) => (
                    <span key={model} className="chip">
                      <ChipIcon model={model} alone />
                      {count > 1 && `×${count}`}
                    </span>
                  ))}
                </span>
                <span className="tokens">{resident.tokens} token</span>
                <span className="coords">
                  ({formatCoordinate(resident.position.x)}, {formatCoordinate(resident.position.y)})
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <h2 className="subheading">token 矿池</h2>
      {world.pools.length === 0 ? (
        <p className="muted small">地图上没有矿池。</p>
      ) : (
        <ul className="pools">
          {world.pools.map((pool) => (
            <li key={pool.id} className={pool.reserve === 0 ? 'empty' : undefined}>
              <span className="name">{pool.id}</span>
              <span className="coords">
                ({formatCoordinate(pool.position.x)}, {formatCoordinate(pool.position.y)})，半径 {formatCoordinate(pool.radius)}
              </span>
              <span className="tokens">剩余 {pool.reserve}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">矿池开局时随机放置，整局固定不动。</p>
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
        <span className="price">{formatPrice(price)} 金币 / token</span>
      </p>
      <p className="muted small">
        镇外的买家用金币收购 token：卖得越多价格越低，没人卖时逐渐回升到 {formatPrice(market.basePrice)}。所有人共用一个价格。
      </p>
      {market.chips.length > 0 && (
        <>
          <ul className="pools">
            {market.chips.map((model) => (
              <li key={model.model}>
                <span className="name">
                  <ChipIcon model={model.model} />
                  {model.model}
                </span>
                <span className="coords">每次采 {model.tokensPerJob} token</span>
                <span className="tokens">{model.price.toLocaleString('zh-CN')} 金币</span>
              </li>
            ))}
          </ul>
          <p className="muted small">收购点还按定价出售芯片。没有芯片不能采矿，有几块时用最好的一块。</p>
        </>
      )}
    </>
  );
}
