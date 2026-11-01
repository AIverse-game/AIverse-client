import type { ResidentView, RigView } from '@aiverse/protocol';
import { useState } from 'react';
import { useGameState, useStore } from '../state/storeContext';
import { ActionStatusLine } from './ActionPanel';
import { ChipIcon } from './ChipIcon';
import { useSecondTick } from './useSecondTick';

export function RigPanel() {
  const store = useStore();
  const { world, selected, lastAction } = useGameState();
  useSecondTick(Boolean(world && !world.game.ended && world.rigs.some((rig) => rig.slots.length)));
  if (!world) return null;
  const resident = world.residents.find((person) => person.id === selected);
  const pool = resident ? store.poolInReach(resident.id) : null;
  const free = Boolean(resident && store.isFree(resident.id));
  const rules = world.rigRules;

  return (
    <section className="panel rig-panel">
      <h2>矿机经营</h2>
      <p className="small">建造 {rules.price.toLocaleString('zh-CN')} 金币 · 每台 {rules.capacity} 槽 · 每 {rules.cycleSeconds} 秒生产一次，产量为芯片单次的 {rules.yieldMultiplier} 倍</p>
      <p className="muted small">每 100 token 向矿主付 {rules.rentPer100} 金币租金，另付 {rules.energyPer100} 金币电费；自己使用免租。按实际产量扣预存，不足时暂停。</p>
      <p className="muted small">安装后可自由行动，每块芯片的产能与手动采矿相同，多个插槽同时生产。角色出局后停止生产，矿主出局则整机关闭并退还租客芯片和余额。</p>
      {resident ? (
        <>
          <p className="small">{resident.name}：可用 {resident.spendableCoins.toLocaleString('zh-CN')} 金币，矿机预存 {resident.rigBalance.toLocaleString('zh-CN')}（计入排名）</p>
          <button type="button" disabled={!free || !pool?.reserve || resident.spendableCoins < rules.price}
            onClick={() => pool && store.act({ type: 'build_rig', residentId: resident.id, poolId: pool.id })}>
            {pool ? `在 ${pool.id} 建造矿机` : '走到矿池内建造'}
          </button>
          {pool && <p className="muted small">当前矿池剩余 {pool.reserve} token，所有矿机与手动采矿共享；有限储量不保证回本。</p>}
        </>
      ) : <p className="muted small">选择居民后可建造矿机或租用空槽。</p>}
      {lastAction && <ActionStatusLine status={lastAction} />}
      {world.rigs.length === 0 && <p className="muted small">还没有矿机。</p>}
      {world.rigs.map((rig) => <RigCard key={`${rig.id}:${selected}`} rig={rig} resident={resident} free={free} />)}
    </section>
  );
}

function RigCard({ rig, resident, free }: { rig: RigView; resident: ResidentView | undefined; free: boolean }) {
  const store = useStore();
  const { world } = useGameState();
  const [chip, setChip] = useState('MK1');
  const [deposit, setDeposit] = useState('500');
  if (!world) return null;
  const owner = world.residents.find((person) => person.id === rig.ownerId);
  const pool = world.pools.find((candidate) => candidate.id === rig.poolId)!;
  const rules = world.rigRules;
  const atPool = Boolean(resident && store.poolInReach(resident.id)?.id === rig.poolId);
  const amount = Number(deposit);
  const validDeposit = Number.isSafeInteger(amount) && amount > 0 && amount <= (resident?.spendableCoins ?? 0);
  const models = world.market?.chips ?? [];
  const model = models.find((candidate) => candidate.model === chip);
  const output = Math.min((model?.tokensPerJob ?? 0) * rules.yieldMultiplier, pool.reserve);
  const rent = resident?.id === rig.ownerId ? 0 : Math.ceil(output * rules.rentPer100 / 100);
  const energy = Math.ceil(output * rules.energyPer100 / 100);
  const canInstall = free && atPool && rig.slots.length < rules.capacity && pool.reserve > 0
    && (resident?.carriedChips[chip] ?? 0) > 0 && validDeposit;

  return (
    <article className="rig-card">
      <h3>矿机 #{rig.id} <span className="tag">{rig.ownerId === resident?.id ? '我的矿机' : owner?.name}</span></h3>
      <p className="small">{rig.poolId} · 剩余 {pool.reserve} token · 插槽 {rig.slots.length}/{rules.capacity}</p>
      <button type="button" disabled={!free || atPool} onClick={() => resident && store.act({ type: 'move_to', residentId: resident.id, target: pool.position })}>前往矿机</button>
      {rig.slots.map((slot) => (
        <div className="rig-slot" key={slot.id}>
          <p className="small"><ChipIcon model={slot.chip} />{slot.chip} · {world.residents.find((person) => person.id === slot.residentId)?.name}
            <span className="tag">{world.game.ended ? '已结束' : slot.status === 'running' ? `生产中 · ${Math.ceil(store.countdown(slot.remainingSeconds))}秒` : slot.status === 'no_funds' ? '余额不足，已暂停' : '矿池已空'}</span>
          </p>
          <p className="small">预存 {slot.balance} 金币 · 累计 {slot.mined} token · 已付租金 {slot.rentPaid} 金币</p>
          <p className="muted small">下一周期最多 {slot.tokensPerCycle} token，租金 {slot.rentPerCycle} + 电费 {slot.energyPerCycle} 金币</p>
          {resident?.id === slot.residentId && (
            <div className="rig-buttons">
              <button type="button" disabled={!free || !validDeposit} onClick={() => store.act({ type: 'fund_rig', residentId: resident.id, rigId: rig.id, slotId: slot.id, amount })}>充值 {validDeposit ? amount : ''} 金币</button>
              <button type="button" disabled={!free} onClick={() => store.act({ type: 'remove_chip', residentId: resident.id, rigId: rig.id, slotId: slot.id })}>拆回芯片并退款</button>
            </div>
          )}
        </div>
      ))}
      {resident && (
        <form className="rig-form" onSubmit={(event) => { event.preventDefault(); if (canInstall) store.act({ type: 'install_chip', residentId: resident.id, rigId: rig.id, chip, deposit: amount }); }}>
          <label>芯片
            <select value={chip} onChange={(event) => setChip(event.target.value)}>
              {models.map((candidate) => <option key={candidate.model} value={candidate.model}>{candidate.model}（携带 {resident.carriedChips[candidate.model] ?? 0}）</option>)}
            </select>
          </label>
          <label>安装预存 / 充值金额
            <input aria-label={`矿机 ${rig.id} 预存金币`} type="number" min="1" step="1" max={resident.spendableCoins} value={deposit} onChange={(event) => setDeposit(event.target.value)} required />
          </label>
          <p className="muted small">{output} token / 周期，租金 {rent} + 电费 {energy} 金币。按当前收购价一次出售约净得 {(store.marketQuote(output) ?? 0) - rent - energy} 金币，价格会变化，出售需到收购点。</p>
          <button type="submit" disabled={!canInstall}>安装芯片{!atPool ? '（需走到矿池内）' : rig.slots.length >= rules.capacity ? '（插槽已满）' : ''}</button>
          <p className="muted small">预存不足一个周期会暂停。充值、拆回均可远程操作，未使用余额全额退回。</p>
        </form>
      )}
    </article>
  );
}
