import type { ResidentView, TowerView } from '@aiverse/protocol';
import { useState } from 'react';
import { useGameState, useStore } from '../state/storeContext';
import { ActionStatusLine } from './ActionPanel';
import { CrystalIcon } from './CrystalIcon';
import { useSecondTick } from './useSecondTick';

export function TowerPanel() {
  const store = useStore();
  const { world, selected, lastAction } = useGameState();
  useSecondTick(Boolean(world && !world.game.ended && world.towers.some((tower) => tower.slots.length)));
  if (!world) return null;
  const resident = world.residents.find((person) => person.id === selected);
  const spring = resident ? store.springInReach(resident.id) : null;
  const free = Boolean(resident && store.isFree(resident.id));
  const rules = world.towerRules;

  return (
    <section className="panel tower-panel">
      <h2>汲能塔经营</h2>
      <p className="small">建造 {rules.price.toLocaleString('zh-CN')} 金币 · 每座 {rules.capacity} 槽 · 每 {rules.cycleSeconds} 秒生产一次，产量为晶核单次的 {rules.yieldMultiplier} 倍</p>
      <p className="muted small">每 100 能量向塔主付 {rules.rentPer100} 金币租金，另付 {rules.upkeepPer100} 金币维护费；自己使用免租。按实际产量扣预存，不足时暂停。</p>
      <p className="muted small">安装后可自由行动，每块晶核的产能与手动汲取相同，多个插槽同时生产。角色出局后停止生产，塔主出局则整座塔关闭并退还租客晶核和余额。</p>
      {resident ? (
        <>
          <p className="small">{resident.name}：可用 {resident.spendableCoins.toLocaleString('zh-CN')} 金币，汲能塔预存 {resident.towerBalance.toLocaleString('zh-CN')}（计入排名）</p>
          <button type="button" disabled={!free || !spring?.reserve || resident.spendableCoins < rules.price}
            onClick={() => spring && store.act({ type: 'build_tower', residentId: resident.id, springId: spring.id })}>
            {spring ? `在 ${spring.id} 建造汲能塔` : '走到能量泉内建造'}
          </button>
          {spring && <p className="muted small">当前能量泉剩余 {spring.reserve} 能量，所有汲能塔与手动汲取共享；有限储量不保证回本。</p>}
        </>
      ) : <p className="muted small">选择居民后可建造汲能塔或租用空槽。</p>}
      {lastAction && <ActionStatusLine status={lastAction} />}
      {world.towers.length === 0 && <p className="muted small">还没有汲能塔。</p>}
      {world.towers.map((tower) => <TowerCard key={`${tower.id}:${selected}`} tower={tower} resident={resident} free={free} />)}
    </section>
  );
}

function TowerCard({ tower, resident, free }: { tower: TowerView; resident: ResidentView | undefined; free: boolean }) {
  const store = useStore();
  const { world } = useGameState();
  const [crystal, setCrystal] = useState('C1');
  const [deposit, setDeposit] = useState('500');
  if (!world) return null;
  const owner = world.residents.find((person) => person.id === tower.ownerId);
  const spring = world.springs.find((candidate) => candidate.id === tower.springId)!;
  const rules = world.towerRules;
  const atSpring = Boolean(resident && store.springInReach(resident.id)?.id === tower.springId);
  const amount = Number(deposit);
  const validDeposit = Number.isSafeInteger(amount) && amount > 0 && amount <= (resident?.spendableCoins ?? 0);
  const tiers = world.market?.crystals ?? [];
  const tier = tiers.find((candidate) => candidate.tier === crystal);
  const output = Math.min((tier?.energyPerJob ?? 0) * rules.yieldMultiplier, spring.reserve);
  const rent = resident?.id === tower.ownerId ? 0 : Math.ceil(output * rules.rentPer100 / 100);
  const upkeep = Math.ceil(output * rules.upkeepPer100 / 100);
  const canInstall = free && atSpring && tower.slots.length < rules.capacity && spring.reserve > 0
    && (resident?.carriedCrystals[crystal] ?? 0) > 0 && validDeposit;

  return (
    <article className="tower-card">
      <h3>汲能塔 #{tower.id} <span className="tag">{tower.ownerId === resident?.id ? '我的汲能塔' : owner?.name}</span></h3>
      <p className="small">{tower.springId} · 剩余 {spring.reserve} 能量 · 插槽 {tower.slots.length}/{rules.capacity}</p>
      <button type="button" disabled={!free || atSpring} onClick={() => resident && store.act({ type: 'move_to', residentId: resident.id, target: spring.position })}>前往汲能塔</button>
      {tower.slots.map((slot) => (
        <div className="tower-slot" key={slot.id}>
          <p className="small"><CrystalIcon tier={slot.crystal} />{slot.crystal} · {world.residents.find((person) => person.id === slot.residentId)?.name}
            <span className="tag">{world.game.ended ? '已结束' : slot.status === 'running' ? `生产中 · ${Math.ceil(store.countdown(slot.remainingSeconds))}秒` : slot.status === 'no_funds' ? '余额不足，已暂停' : '能量泉已空'}</span>
          </p>
          <p className="small">预存 {slot.balance} 金币 · 累计 {slot.harvested} 能量 · 已付租金 {slot.rentPaid} 金币</p>
          <p className="muted small">下一周期最多 {slot.energyPerCycle} 能量，租金 {slot.rentPerCycle} + 维护费 {slot.upkeepPerCycle} 金币</p>
          {resident?.id === slot.residentId && (
            <div className="tower-buttons">
              <button type="button" disabled={!free || !validDeposit} onClick={() => store.act({ type: 'fund_tower', residentId: resident.id, towerId: tower.id, slotId: slot.id, amount })}>充值 {validDeposit ? amount : ''} 金币</button>
              <button type="button" disabled={!free} onClick={() => store.act({ type: 'remove_crystal', residentId: resident.id, towerId: tower.id, slotId: slot.id })}>拆回晶核并退款</button>
            </div>
          )}
        </div>
      ))}
      {resident && (
        <form className="tower-form" onSubmit={(event) => { event.preventDefault(); if (canInstall) store.act({ type: 'install_crystal', residentId: resident.id, towerId: tower.id, crystal, deposit: amount }); }}>
          <label>晶核
            <select value={crystal} onChange={(event) => setCrystal(event.target.value)}>
              {tiers.map((candidate) => <option key={candidate.tier} value={candidate.tier}>{candidate.tier}（携带 {resident.carriedCrystals[candidate.tier] ?? 0}）</option>)}
            </select>
          </label>
          <label>安装预存 / 充值金额
            <input aria-label={`汲能塔 ${tower.id} 预存金币`} type="number" min="1" step="1" max={resident.spendableCoins} value={deposit} onChange={(event) => setDeposit(event.target.value)} required />
          </label>
          <p className="muted small">{output} 能量 / 周期，租金 {rent} + 维护费 {upkeep} 金币。按当前收购价一次出售约净得 {(store.marketQuote(output) ?? 0) - rent - upkeep} 金币，价格会变化，出售需到收购点。</p>
          <button type="submit" disabled={!canInstall}>安装晶核{!atSpring ? '（需走到能量泉内）' : tower.slots.length >= rules.capacity ? '（插槽已满）' : ''}</button>
          <p className="muted small">预存不足一个周期会暂停。充值、拆回均可远程操作，未使用余额全额退回。</p>
        </form>
      )}
    </article>
  );
}
