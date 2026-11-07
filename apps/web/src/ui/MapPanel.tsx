import { formatCoordinate } from '../render/layout';
import { marketTopPrice } from '../state/market';
import { useGameState, useStore } from '../state/storeContext';
import { ProgramIcon } from './ProgramIcon';
import { formatPrice } from './format';
import { ComputeIcon } from './ComputeIcon';
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
                {resident.harvesting && <span className="tag tag-harvesting">采集中</span>}
                {resident.gathering && <span className="tag tag-crafting">采集数据中</span>}
                {resident.writing && (
                  <span className="tag tag-crafting">{resident.writing.tier === 'material' ? '制作中' : '编写中'}</span>
                )}
                {resident.walking && <span className="tag tag-walking">行走中</span>}
                <span className="programs">
                  {Object.entries(resident.programs).map(([tier, count]) => (
                    <span key={tier} className="program">
                      <ProgramIcon tier={tier} alone />
                      {count > 1 && `×${count}`}
                    </span>
                  ))}
                </span>
                <span className="compute">
                  <ComputeIcon />
                  {resident.compute} 算力
                </span>
                {(resident.data > 0 || resident.programsWritten > 0) && (
                  <span className="coords">
                    {resident.data} 数据{resident.programsWritten > 0 && `，已写 ${resident.programsWritten} 个`}
                  </span>
                )}
                <span className="coords">
                  ({formatCoordinate(resident.position.x)}, {formatCoordinate(resident.position.y)})
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <h2 className="subheading">算力泉</h2>
      {world.springs.length === 0 ? (
        <p className="muted small">地图上没有算力泉。</p>
      ) : (
        <ul className="springs">
          {world.springs.map((spring) => (
            <li key={spring.id} className={spring.reserve === 0 ? 'empty' : undefined}>
              <span className="name">{spring.id}</span>
              <span className="coords">
                ({formatCoordinate(spring.position.x)}, {formatCoordinate(spring.position.y)})，半径 {formatCoordinate(spring.radius)}
              </span>
              <span className="compute">
                <ComputeIcon />
                剩余 {spring.reserve}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">算力泉开局时随机放置，整局固定不动。</p>
      <MineInfo />
      <MarketInfo />
    </section>
  );
}

/** The mines and the studio with its recipes: where data come from and where programs are made. */
function MineInfo() {
  const { world } = useGameState();
  if (!world || (world.mines.length === 0 && !world.studio)) return null;
  const { studio } = world;

  return (
    <>
      <h2 className="subheading">数据矿与工作室</h2>
      <ul className="springs">
        {world.mines.map((mine) => (
          <li key={mine.id} className={mine.reserve === 0 ? 'empty' : undefined}>
            <span className="name">{mine.id}</span>
            <span className="coords">
              ({formatCoordinate(mine.position.x)}, {formatCoordinate(mine.position.y)})，半径 {formatCoordinate(mine.radius)}
            </span>
            <span className="compute">剩余 {mine.reserve} 数据</span>
          </li>
        ))}
        {studio && (
          <li>
            <span className="name">工作室</span>
            <span className="coords">
              ({formatCoordinate(studio.position.x)}, {formatCoordinate(studio.position.y)})，半径 {formatCoordinate(studio.radius)}
            </span>
          </li>
        )}
      </ul>
      {studio && (
        <ul className="springs">
          {studio.recipes.map((recipe) => (
            <li key={recipe.tier}>
              <span className="name">
                <ProgramIcon tier={recipe.tier} />
                {recipe.tier}
              </span>
              <span className="coords">
                {recipe.data} 数据 + {recipe.compute} 算力{recipe.consumes && ` + 1 个 ${recipe.consumes}`}
              </span>
              <span className="compute">{recipe.seconds} 秒</span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">
        在数据矿里不用程序就能采集数据；在工作室按配方写程序，每写成一个，以后编写少用
        {studio ? ` ${Math.round(studio.speedupPerProgram * 100)}%` : ''} 的时间
        {studio ? `，最少只要 ${Math.round(studio.fastestShare * 100)}%` : ''}。
      </p>
    </>
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
        <span className="price">{formatPrice(price)} 金币 / 算力</span>
      </p>
      <p className="muted small">
        镇外的买家用金币收购算力：卖得越多价格越低，没人卖时逐渐上涨，最高到 {formatPrice(marketTopPrice(market))}。所有人共用一个价格。
      </p>
      {market.programs.length > 0 && (
        <>
          <ul className="springs">
            {market.programs.map((tier) => (
              <li key={tier.tier}>
                <span className="name">
                  <ProgramIcon tier={tier.tier} />
                  {tier.tier}
                </span>
                <span className="coords">每次采集 {tier.computePerJob} 算力</span>
                <span className="compute">{tier.price.toLocaleString('zh-CN')} 金币</span>
              </li>
            ))}
          </ul>
          <p className="muted small">收购点还按定价出售程序。没有程序不能采集，有几个时用最好的一个。</p>
        </>
      )}
    </>
  );
}
