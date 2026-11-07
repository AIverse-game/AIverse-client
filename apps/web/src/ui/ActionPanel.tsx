import type { ResidentView } from '@aiverse/protocol';
import { useState, type FormEvent } from 'react';
import { formatCoordinate } from '../render/layout';
import { useGameState, useStore } from '../state/storeContext';
import type { ActionStatus } from '../state/store';
import { ProgramIcon } from './ProgramIcon';
import { formatPrice } from './format';
import { useSecondTick } from './useSecondTick';

/**
 * Manual control for when no AI drives the residents. It sends the same operation
 * primitives an AI will use; the server decides whether each one is allowed.
 */
export function ActionPanel() {
  const store = useStore();
  const { world, selected, lastAction } = useGameState();
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  if (!world) return null;
  const resident = world.residents.find((candidate) => candidate.id === selected) ?? null;
  const size = world.map.size;
  const ended = world.game.ended;
  const canAct = resident !== null && store.canAct(resident.id);
  // Jobs and walks keep the resident busy: everything but talking and leaving waits until they end.
  const free = resident !== null && store.isFree(resident.id);
  const spring = resident ? store.springInReach(resident.id) : null;
  const mine = resident ? store.mineInReach(resident.id) : null;
  const program = resident ? store.bestProgram(resident.id) : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!resident) return;
    store.act({ type: 'move_to', residentId: resident.id, target: { x: Number(x), y: Number(y) } });
  };

  const harvest = () => {
    if (!resident || !spring) return;
    store.act({ type: 'harvest', residentId: resident.id, springId: spring.id });
  };

  const gather = () => {
    if (!resident || !mine) return;
    store.act({ type: 'gather_data', residentId: resident.id, mineId: mine.id });
  };

  const leave = () => {
    if (!resident) return;
    if (!window.confirm(`让 ${resident.name} 退出游戏？退出后不能再行动，物品清空，金币保留并参与排名。`)) return;
    store.act({ type: 'leave_game', residentId: resident.id });
  };

  return (
    <section className="panel">
      <h2>操作</h2>
      {resident ? (
        <p className="small selected">
          <span className="swatch" style={{ background: resident.color }} />
          {resident.name}，
          {/* While walking, the snapshot's position is already behind; the status below says where to. */}
          {resident.walking
            ? '正在行走'
            : `现在位于 (${formatCoordinate(resident.position.x)}, ${formatCoordinate(resident.position.y)})`}
          ，持有 {resident.compute} 算力
        </p>
      ) : (
        <p className="muted small">先在居民列表或地图上点选一名居民。</p>
      )}
      {ended ? (
        <p className="muted small">游戏已结束，不能再操作。</p>
      ) : (
        resident?.left && <p className="muted small">{resident.name} 已出局，不能再操作。</p>
      )}
      {resident?.harvesting && (
        <p className="small" role="status">
          正在用 <ProgramIcon tier={resident.harvesting.program} />
          {resident.harvesting.program} 在算力泉 {resident.harvesting.springId} 采集，完成后获得 {resident.harvesting.amount}{' '}
          算力；采集期间守着程序，只能说话或退出游戏。
        </p>
      )}
      {resident?.gathering && (
        <p className="small" role="status">
          正在数据矿 {resident.gathering.mineId} 采集数据，完成后获得 {resident.gathering.amount} 个数据；期间只能说话或退出游戏。
        </p>
      )}
      {resident?.writing && (
        <p className="small" role="status">
          正在工作室编写 <ProgramIcon tier={resident.writing.tier} />
          {resident.writing.tier}，原料已经扣除；期间只能说话或退出游戏。
        </p>
      )}
      {resident?.walking && (
        <p className="small" role="status">
          正在走向 ({formatCoordinate(resident.walking.target.x)}, {formatCoordinate(resident.walking.target.y)})，到达前只能说话或退出游戏。
        </p>
      )}
      <form className="move-form" onSubmit={submit}>
        <label>
          x
          <input
            type="number"
            inputMode="decimal"
            required
            min={0}
            max={size}
            step="any"
            value={x}
            onChange={(event) => setX(event.target.value)}
          />
        </label>
        <label>
          y
          <input
            type="number"
            inputMode="decimal"
            required
            min={0}
            max={size}
            step="any"
            value={y}
            onChange={(event) => setY(event.target.value)}
          />
        </label>
        <button type="submit" disabled={!free}>
          走到此坐标
        </button>
      </form>
      <p className="muted small">
        选中居民后，点击地图上的地面也会让其走到该点。居民沿直线匀速走过去，到达前不能做别的；
        出发时按直线距离扣算力（向上取整），不够则走不了；算力用完，到达后出局。
      </p>
      <button type="button" className="harvest" disabled={!free || !spring || !program || spring.reserve === 0} onClick={harvest}>
        {program && (
          <>
            用 <ProgramIcon tier={program.tier} />
            {program.tier}{' '}
          </>
        )}
        {spring ? `在算力泉 ${spring.id} 采集（剩余 ${spring.reserve}）` : '采集'}
      </button>
      {resident && !resident.left && !ended && (!program || !spring) && (
        <p className="muted small">
          {!program && '没有程序不能采集，先到收购点买一个。'}
          {!spring && '走到算力泉的圆圈范围内才能采集。'}
        </p>
      )}
      {world.mines.length > 0 && (
        <button type="button" className="harvest" disabled={!free || !mine || mine.reserve === 0} onClick={gather}>
          {mine ? `在数据矿 ${mine.id} 采集数据（剩余 ${mine.reserve}）` : '采集数据'}
        </button>
      )}
      {resident && canAct && !mine && world.mines.length > 0 && (
        <p className="muted small">走到数据矿的圆圈范围内才能采集数据，不需要程序。数据只用来写程序，收购点自己不收也不卖，可以在交易所和其他居民买卖。</p>
      )}
      {resident && world.studio && <WriteForm resident={resident} free={free} />}
      {resident && world.market && <SellForm resident={resident} free={free} />}
      {resident && world.market && <BuyProgramForm resident={resident} free={free} />}
      <button type="button" className="leave" disabled={!canAct} onClick={leave}>
        退出游戏
      </button>
      {lastAction && <ActionStatusLine status={lastAction} />}
    </section>
  );
}

/** Selling compute at the market, with what the sale would fetch at the price right now. */
function SellForm({ resident, free }: { resident: ResidentView; free: boolean }) {
  const store = useStore();
  const [quantity, setQuantity] = useState('');
  const atMarket = store.atMarket(resident.id);
  const canAct = store.canAct(resident.id);
  // Kept ticking while busy too: the price line stays up then, only the button waits.
  useSecondTick(atMarket && canAct);
  const amount = Number(quantity);
  const valid = Number.isInteger(amount) && amount >= 1;
  const estimate = valid ? store.marketQuote(amount) : null;
  const price = store.marketPrice();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    // `compute` counts those set aside in offers too: only selling exactly that many empties the
    // resident, and the server refuses more than they carry. The view has no carried count yet,
    // so with compute set aside this asks needlessly and the server then refuses.
    if (
      amount === resident.compute &&
      !window.confirm(`卖出全部 ${resident.compute} 算力后 ${resident.name} 会出局：不能再行动，金币保留并参与排名。继续？`)
    )
      return;
    store.act({ type: 'sell_compute', residentId: resident.id, quantity: amount });
  };

  return (
    <>
      <form className="sell-form" onSubmit={submit}>
        <label>
          卖出
          <input
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={resident.compute}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          算力
        </label>
        <button type="submit" disabled={!free || !atMarket || !valid}>
          卖给收购点
        </button>
      </form>
      {!canAct ? null : atMarket ? (
        <p className="muted small">
          现价 {price === null ? '—' : formatPrice(price)} 金币 / 算力
          {estimate !== null && `，卖出 ${amount} 个约得 ${estimate.toLocaleString('zh-CN')} 金币（以服务端为准）`}
          。卖得越多单价越低，等一会儿价格会回升。
        </p>
      ) : (
        <p className="muted small">走到地图中央收购点的圆圈范围内才能卖算力、买程序。</p>
      )}
    </>
  );
}

/** Writing at the studio, one button per recipe with what it uses up and how long it takes. */
function WriteForm({ resident, free }: { resident: ResidentView; free: boolean }) {
  const store = useStore();
  const { world } = useGameState();
  const recipes = world?.studio?.recipes ?? [];
  const atStudio = store.atStudio(resident.id);
  const canAct = store.canAct(resident.id);

  const write = (tier: string, compute: number) => {
    // Owned compute counts what offers and sell orders set aside, so this may ask needlessly.
    if (
      compute === resident.compute &&
      !window.confirm(`编写会用掉 ${resident.name} 全部的算力，之后会出局。继续？`)
    )
      return;
    store.act({ type: 'write_program', residentId: resident.id, tier });
  };

  return (
    <>
      <div className="buy-programs">
        {recipes.map((recipe) => {
          const seconds = store.writeSeconds(resident.id, recipe);
          return (
            <button
              key={recipe.tier}
              type="button"
              disabled={!free || !atStudio || store.lacksMaterials(resident.id, recipe)}
              onClick={() => write(recipe.tier, recipe.compute)}
            >
              写 <ProgramIcon tier={recipe.tier} />
              {recipe.tier}：{recipe.data} 数据 + {recipe.compute} 算力
              {recipe.consumes && ` + 1 个 ${recipe.consumes}`}
              {seconds !== null && `，约 ${Math.round(seconds)} 秒`}
            </button>
          );
        })}
      </div>
      {canAct && !atStudio && <p className="muted small">走到工作室的圆圈范围内才能写程序，原料要带在身上。</p>}
    </>
  );
}

/** Buying programs at the market, one button per tier at its fixed price. */
function BuyProgramForm({ resident, free }: { resident: ResidentView; free: boolean }) {
  const store = useStore();
  const { world } = useGameState();
  const tiers = world?.market?.programs ?? [];
  if (tiers.length === 0) return null;
  const atMarket = store.atMarket(resident.id);

  return (
    <div className="buy-programs">
      {tiers.map((tier) => (
        <button
          key={tier.tier}
          type="button"
          disabled={!free || !atMarket || resident.spendableCoins < tier.price}
          onClick={() => store.act({ type: 'buy_program', residentId: resident.id, tier: tier.tier })}
        >
          买 <ProgramIcon tier={tier.tier} />
          {tier.tier}：{tier.price.toLocaleString('zh-CN')} 金币，每次采集 {tier.computePerJob} 算力
        </button>
      ))}
    </div>
  );
}

export function ActionStatusLine({ status }: { status: ActionStatus }) {
  switch (status.status) {
    case 'pending':
      return <p className="muted small" role="status">执行中…</p>;
    case 'accepted':
      return <p className="muted small" role="status">已执行</p>;
    case 'rejected':
      return <p className="error small" role="alert">未执行：{status.reason}</p>;
  }
}
