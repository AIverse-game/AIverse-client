import type { ResidentView, CollectorView } from '@aiverse/protocol';
import { useState } from 'react';
import { useGameState, useStore } from '../state/storeContext';
import { ActionStatusLine } from './ActionPanel';
import { ProgramIcon } from './ProgramIcon';
import { useSecondTick } from './useSecondTick';

export function CollectorPanel() {
  const store = useStore();
  const { world, selected, lastAction } = useGameState();
  useSecondTick(Boolean(world && !world.game.ended && world.collectors.some((collector) => collector.slots.length)));
  if (!world) return null;
  const resident = world.residents.find((person) => person.id === selected);
  const spring = resident ? store.springInReach(resident.id) : null;
  const free = Boolean(resident && store.isFree(resident.id));
  const rules = world.collectorRules;

  return (
    <section className="panel collector-panel">
      <h2>采集节点经营</h2>
      <p className="small">建造 {rules.price.toLocaleString('zh-CN')} 金币 · 每座 {rules.capacity} 槽 · 每 {rules.cycleSeconds} 秒生产一次，产量为程序单次的 {rules.yieldMultiplier} 倍</p>
      <p className="muted small">每 100 算力向节点主付 {rules.rentPer100} 金币租金，另付 {rules.upkeepPer100} 金币维护费；自己使用免租。按实际产量扣预存，不足时暂停。</p>
      <p className="muted small">安装后可自由行动，每个程序的产能与手动采集相同，多个插槽同时生产。角色出局后停止生产，节点主出局则整座采集节点关闭并退还租客程序和余额。</p>
      {resident ? (
        <>
          <p className="small">{resident.name}：可用 {resident.spendableCoins.toLocaleString('zh-CN')} 金币，采集节点预存 {resident.collectorBalance.toLocaleString('zh-CN')}（计入排名）</p>
          <button type="button" disabled={!free || !spring?.reserve || resident.spendableCoins < rules.price}
            onClick={() => spring && store.act({ type: 'build_collector', residentId: resident.id, springId: spring.id })}>
            {spring ? `在 ${spring.id} 建造采集节点` : '走到算力泉内建造'}
          </button>
          {spring && <p className="muted small">当前算力泉剩余 {spring.reserve} 算力，所有采集节点与手动采集共享；有限储量不保证回本。</p>}
        </>
      ) : <p className="muted small">选择居民后可建造采集节点或租用空槽。</p>}
      {lastAction && <ActionStatusLine status={lastAction} />}
      {world.collectors.length === 0 && <p className="muted small">还没有采集节点。</p>}
      {world.collectors.map((collector) => <CollectorCard key={`${collector.id}:${selected}`} collector={collector} resident={resident} free={free} />)}
    </section>
  );
}

function CollectorCard({ collector, resident, free }: { collector: CollectorView; resident: ResidentView | undefined; free: boolean }) {
  const store = useStore();
  const { world } = useGameState();
  const [program, setProgram] = useState('v1');
  const [deposit, setDeposit] = useState('500');
  if (!world) return null;
  const owner = world.residents.find((person) => person.id === collector.ownerId);
  const spring = world.springs.find((candidate) => candidate.id === collector.springId)!;
  const rules = world.collectorRules;
  const atSpring = Boolean(resident && store.springInReach(resident.id)?.id === collector.springId);
  const amount = Number(deposit);
  const validDeposit = Number.isSafeInteger(amount) && amount > 0 && amount <= (resident?.spendableCoins ?? 0);
  const tiers = world.market?.programs ?? [];
  const tier = tiers.find((candidate) => candidate.tier === program);
  const output = Math.min((tier?.computePerJob ?? 0) * rules.yieldMultiplier, spring.reserve);
  const rent = resident?.id === collector.ownerId ? 0 : Math.ceil(output * rules.rentPer100 / 100);
  const upkeep = Math.ceil(output * rules.upkeepPer100 / 100);
  const canInstall = free && atSpring && collector.slots.length < rules.capacity && spring.reserve > 0
    && (resident?.carriedPrograms[program] ?? 0) > 0 && validDeposit;

  return (
    <article className="collector-card">
      <h3>采集节点 #{collector.id} <span className="tag">{collector.ownerId === resident?.id ? '我的采集节点' : owner?.name}</span></h3>
      <p className="small">{collector.springId} · 剩余 {spring.reserve} 算力 · 插槽 {collector.slots.length}/{rules.capacity}</p>
      <button type="button" disabled={!free || atSpring} onClick={() => resident && store.act({ type: 'move_to', residentId: resident.id, target: spring.position })}>前往采集节点</button>
      {collector.slots.map((slot) => (
        <div className="collector-slot" key={slot.id}>
          <p className="small"><ProgramIcon tier={slot.program} />{slot.program} · {world.residents.find((person) => person.id === slot.residentId)?.name}
            <span className="tag">{world.game.ended ? '已结束' : slot.status === 'running' ? `生产中 · ${Math.ceil(store.countdown(slot.remainingSeconds))}秒` : slot.status === 'no_funds' ? '余额不足，已暂停' : '算力泉已空'}</span>
          </p>
          <p className="small">预存 {slot.balance} 金币 · 累计 {slot.harvested} 算力 · 已付租金 {slot.rentPaid} 金币</p>
          <p className="muted small">下一周期最多 {slot.computePerCycle} 算力，租金 {slot.rentPerCycle} + 维护费 {slot.upkeepPerCycle} 金币</p>
          {resident?.id === slot.residentId && (
            <div className="collector-buttons">
              <button type="button" disabled={!free || !validDeposit} onClick={() => store.act({ type: 'fund_collector', residentId: resident.id, collectorId: collector.id, slotId: slot.id, amount })}>充值 {validDeposit ? amount : ''} 金币</button>
              <button type="button" disabled={!free} onClick={() => store.act({ type: 'remove_program', residentId: resident.id, collectorId: collector.id, slotId: slot.id })}>拆回程序并退款</button>
            </div>
          )}
        </div>
      ))}
      {resident && (
        <form className="collector-form" onSubmit={(event) => { event.preventDefault(); if (canInstall) store.act({ type: 'install_program', residentId: resident.id, collectorId: collector.id, program, deposit: amount }); }}>
          <label>程序
            <select value={program} onChange={(event) => setProgram(event.target.value)}>
              {tiers.map((candidate) => <option key={candidate.tier} value={candidate.tier}>{candidate.tier}（携带 {resident.carriedPrograms[candidate.tier] ?? 0}）</option>)}
            </select>
          </label>
          <label>安装预存 / 充值金额
            <input aria-label={`采集节点 ${collector.id} 预存金币`} type="number" min="1" step="1" max={resident.spendableCoins} value={deposit} onChange={(event) => setDeposit(event.target.value)} required />
          </label>
          <p className="muted small">{output} 算力 / 周期，租金 {rent} + 维护费 {upkeep} 金币。按当前收购价一次出售约净得 {(store.marketQuote(output) ?? 0) - rent - upkeep} 金币，价格会变化，出售需到收购点。</p>
          <button type="submit" disabled={!canInstall}>安装程序{!atSpring ? '（需走到算力泉内）' : collector.slots.length >= rules.capacity ? '（插槽已满）' : ''}</button>
          <p className="muted small">预存不足一个周期会暂停。充值、拆回均可远程操作，未使用余额全额退回。</p>
        </form>
      )}
    </article>
  );
}
