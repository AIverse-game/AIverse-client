import type { ResidentView } from '@aiverse/protocol';
import { useState, type FormEvent } from 'react';
import { formatCoordinate } from '../render/layout';
import { useGameState, useStore } from '../state/storeContext';
import type { ActionStatus } from '../state/store';
import { ChipIcon } from './ChipIcon';
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
  // Mining and walking keep the resident busy: everything but leaving waits until they end.
  const free = resident !== null && store.isFree(resident.id);
  const pool = resident ? store.poolInReach(resident.id) : null;
  const chip = resident ? store.bestChip(resident.id) : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!resident) return;
    store.act({ type: 'move_to', residentId: resident.id, target: { x: Number(x), y: Number(y) } });
  };

  const mine = () => {
    if (!resident || !pool) return;
    store.act({ type: 'mine', residentId: resident.id, poolId: pool.id });
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
          ，持有 {resident.tokens} token
        </p>
      ) : (
        <p className="muted small">先在居民列表或地图上点选一名居民。</p>
      )}
      {ended ? (
        <p className="muted small">游戏已结束，不能再操作。</p>
      ) : (
        resident?.left && <p className="muted small">{resident.name} 已出局，不能再操作。</p>
      )}
      {resident?.mining && (
        <p className="small" role="status">
          正在用 <ChipIcon model={resident.mining.chip} />
          {resident.mining.chip} 在矿池 {resident.mining.poolId} 采矿，完成后获得 {resident.mining.amount}{' '}
          token；采矿期间守着芯片，只能说话或退出游戏。
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
        选中居民后，点击地图上的地面也会让其走到该点。居民沿直线匀速走过去，到达前不能做别的；出发时按直线距离扣
        token（向上取整），不够则走不了；token 用完，到达后出局。
      </p>
      <button type="button" className="mine" disabled={!free || !pool || !chip || pool.reserve === 0} onClick={mine}>
        {chip && (
          <>
            用 <ChipIcon model={chip.model} />
            {chip.model}{' '}
          </>
        )}
        {pool ? `在矿池 ${pool.id} 采矿（剩余 ${pool.reserve}）` : '采矿'}
      </button>
      {resident && !resident.left && !ended && (!chip || !pool) && (
        <p className="muted small">
          {!chip && '没有芯片不能采矿，先到收购点买一块。'}
          {!pool && '走到矿池的圆圈范围内才能采矿。'}
        </p>
      )}
      {resident && world.market && <SellForm resident={resident} free={free} />}
      {resident && world.market && <BuyChipForm resident={resident} free={free} />}
      <button type="button" className="leave" disabled={!canAct} onClick={leave}>
        退出游戏
      </button>
      {lastAction && <ActionStatusLine status={lastAction} />}
    </section>
  );
}

/** Selling tokens at the market, with what the sale would fetch at the price right now. */
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
    // `tokens` counts those set aside in offers too: only selling exactly that many empties the
    // resident, and the server refuses more than they carry. The view has no carried count yet,
    // so with tokens set aside this asks needlessly and the server then refuses.
    if (
      amount === resident.tokens &&
      !window.confirm(`卖出全部 ${resident.tokens} token 后 ${resident.name} 会出局：不能再行动，金币保留并参与排名。继续？`)
    )
      return;
    store.act({ type: 'sell_tokens', residentId: resident.id, quantity: amount });
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
            max={resident.tokens}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          token
        </label>
        <button type="submit" disabled={!free || !atMarket || !valid}>
          卖给收购点
        </button>
      </form>
      {!canAct ? null : atMarket ? (
        <p className="muted small">
          现价 {price === null ? '—' : formatPrice(price)} 金币 / token
          {estimate !== null && `，卖出 ${amount} 个约得 ${estimate.toLocaleString('zh-CN')} 金币（以服务端为准）`}
          。卖得越多单价越低，等一会儿价格会回升。
        </p>
      ) : (
        <p className="muted small">走到地图中央收购点的圆圈范围内才能卖 token、买芯片。</p>
      )}
    </>
  );
}

/** Buying chips at the market, one button per model at its fixed price. */
function BuyChipForm({ resident, free }: { resident: ResidentView; free: boolean }) {
  const store = useStore();
  const { world } = useGameState();
  const models = world?.market?.chips ?? [];
  if (models.length === 0) return null;
  const atMarket = store.atMarket(resident.id);

  return (
    <div className="buy-chips">
      {models.map((model) => (
        <button
          key={model.model}
          type="button"
          disabled={!free || !atMarket || resident.spendableCoins < model.price}
          onClick={() => store.act({ type: 'buy_chip', residentId: resident.id, model: model.model })}
        >
          买 <ChipIcon model={model.model} />
          {model.model}：{model.price.toLocaleString('zh-CN')} 金币，每次采 {model.tokensPerJob} token
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
