import type { ResidentView } from '@aiverse/protocol';
import { useState, type FormEvent } from 'react';
import { formatCoordinate } from '../render/layout';
import { useGameState, useStore } from '../state/storeContext';
import type { ActionStatus } from '../state/store';
import { CrystalIcon } from './CrystalIcon';
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
  const quarry = resident ? store.quarryInReach(resident.id) : null;
  const crystal = resident ? store.bestCrystal(resident.id) : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!resident) return;
    store.act({ type: 'move_to', residentId: resident.id, target: { x: Number(x), y: Number(y) } });
  };

  const harvest = () => {
    if (!resident || !spring) return;
    store.act({ type: 'harvest', residentId: resident.id, springId: spring.id });
  };

  const dig = () => {
    if (!resident || !quarry) return;
    store.act({ type: 'dig_shards', residentId: resident.id, quarryId: quarry.id });
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
          ，持有 {resident.energy} 能量
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
          正在用 <CrystalIcon tier={resident.harvesting.crystal} />
          {resident.harvesting.crystal} 在能量泉 {resident.harvesting.springId} 汲取，完成后获得 {resident.harvesting.amount}{' '}
          能量；汲取期间守着晶核，只能说话或退出游戏。
        </p>
      )}
      {resident?.digging && (
        <p className="small" role="status">
          正在晶矿 {resident.digging.quarryId} 挖晶砂，完成后获得 {resident.digging.amount} 个晶砂；期间只能说话或退出游戏。
        </p>
      )}
      {resident?.refining && (
        <p className="small" role="status">
          正在工坊炼制 <CrystalIcon tier={resident.refining.tier} />
          {resident.refining.tier}，原料已经扣除；期间只能说话或退出游戏。
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
        出发时按直线距离扣能量（向上取整），不够则走不了；能量用完，到达后出局。
      </p>
      <button type="button" className="harvest" disabled={!free || !spring || !crystal || spring.reserve === 0} onClick={harvest}>
        {crystal && (
          <>
            用 <CrystalIcon tier={crystal.tier} />
            {crystal.tier}{' '}
          </>
        )}
        {spring ? `在能量泉 ${spring.id} 汲取（剩余 ${spring.reserve}）` : '汲取'}
      </button>
      {resident && !resident.left && !ended && (!crystal || !spring) && (
        <p className="muted small">
          {!crystal && '没有晶核不能汲取，先到收购点买一块。'}
          {!spring && '走到能量泉的圆圈范围内才能汲取。'}
        </p>
      )}
      {world.quarries.length > 0 && (
        <button type="button" className="harvest" disabled={!free || !quarry || quarry.reserve === 0} onClick={dig}>
          {quarry ? `在晶矿 ${quarry.id} 挖晶砂（剩余 ${quarry.reserve}）` : '挖晶砂'}
        </button>
      )}
      {resident && canAct && !quarry && world.quarries.length > 0 && (
        <p className="muted small">走到晶矿的圆圈范围内才能挖晶砂，不需要晶核。晶砂只用来炼晶核，收购点自己不收也不卖，可以在交易所和其他居民买卖。</p>
      )}
      {resident && world.workshop && <RefineForm resident={resident} free={free} />}
      {resident && world.market && <SellForm resident={resident} free={free} />}
      {resident && world.market && <BuyCrystalForm resident={resident} free={free} />}
      <button type="button" className="leave" disabled={!canAct} onClick={leave}>
        退出游戏
      </button>
      {lastAction && <ActionStatusLine status={lastAction} />}
    </section>
  );
}

/** Selling energy at the market, with what the sale would fetch at the price right now. */
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
    // `energy` counts those set aside in offers too: only selling exactly that many empties the
    // resident, and the server refuses more than they carry. The view has no carried count yet,
    // so with energy set aside this asks needlessly and the server then refuses.
    if (
      amount === resident.energy &&
      !window.confirm(`卖出全部 ${resident.energy} 能量后 ${resident.name} 会出局：不能再行动，金币保留并参与排名。继续？`)
    )
      return;
    store.act({ type: 'sell_energy', residentId: resident.id, quantity: amount });
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
            max={resident.energy}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          能量
        </label>
        <button type="submit" disabled={!free || !atMarket || !valid}>
          卖给收购点
        </button>
      </form>
      {!canAct ? null : atMarket ? (
        <p className="muted small">
          现价 {price === null ? '—' : formatPrice(price)} 金币 / 能量
          {estimate !== null && `，卖出 ${amount} 个约得 ${estimate.toLocaleString('zh-CN')} 金币（以服务端为准）`}
          。卖得越多单价越低，等一会儿价格会回升。
        </p>
      ) : (
        <p className="muted small">走到地图中央收购点的圆圈范围内才能卖能量、买晶核。</p>
      )}
    </>
  );
}

/** Refining at the workshop, one button per recipe with what it uses up and how long it takes. */
function RefineForm({ resident, free }: { resident: ResidentView; free: boolean }) {
  const store = useStore();
  const { world } = useGameState();
  const recipes = world?.workshop?.recipes ?? [];
  const atWorkshop = store.atWorkshop(resident.id);
  const canAct = store.canAct(resident.id);

  const refine = (tier: string, energy: number) => {
    // Owned energy counts what offers and sell orders set aside, so this may ask needlessly.
    if (
      energy === resident.energy &&
      !window.confirm(`炼制会用掉 ${resident.name} 全部的能量，之后会出局。继续？`)
    )
      return;
    store.act({ type: 'refine_crystal', residentId: resident.id, tier });
  };

  return (
    <>
      <div className="buy-crystals">
        {recipes.map((recipe) => {
          const seconds = store.refineSeconds(resident.id, recipe);
          return (
            <button
              key={recipe.tier}
              type="button"
              disabled={!free || !atWorkshop || store.lacksMaterials(resident.id, recipe)}
              onClick={() => refine(recipe.tier, recipe.energy)}
            >
              炼 <CrystalIcon tier={recipe.tier} />
              {recipe.tier}：{recipe.shards} 晶砂 + {recipe.energy} 能量
              {recipe.consumes && ` + 1 块 ${recipe.consumes}`}
              {seconds !== null && `，约 ${Math.round(seconds)} 秒`}
            </button>
          );
        })}
      </div>
      {canAct && !atWorkshop && <p className="muted small">走到工坊的圆圈范围内才能炼晶核，原料要带在身上。</p>}
    </>
  );
}

/** Buying crystals at the market, one button per tier at its fixed price. */
function BuyCrystalForm({ resident, free }: { resident: ResidentView; free: boolean }) {
  const store = useStore();
  const { world } = useGameState();
  const tiers = world?.market?.crystals ?? [];
  if (tiers.length === 0) return null;
  const atMarket = store.atMarket(resident.id);

  return (
    <div className="buy-crystals">
      {tiers.map((tier) => (
        <button
          key={tier.tier}
          type="button"
          disabled={!free || !atMarket || resident.spendableCoins < tier.price}
          onClick={() => store.act({ type: 'buy_crystal', residentId: resident.id, tier: tier.tier })}
        >
          买 <CrystalIcon tier={tier.tier} />
          {tier.tier}：{tier.price.toLocaleString('zh-CN')} 金币，每次汲取 {tier.energyPerJob} 能量
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
