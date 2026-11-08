import { useState } from 'react';
import type { BuildFacilityAction } from '@aiverse/protocol';
import { activeContents } from '../state/facilityContents';
import { useGameState, useStore } from '../state/storeContext';
import { useSecondTick } from './useSecondTick';

const names = { ad: '广告位', portal: '传送门', game_hall: '游戏厅', workspace: '工作空间' } as const;
const jobNames: Record<string, string> = { build_ad: '建广告位', build_portal: '建传送门', build_game_hall: '建游戏厅', build_workspace: '建工作空间', make_content: '渲染广告', make_game: '渲染游戏' };

/** First manual facility loop: buy a plot, build, render content and fill its interior. */
export function FacilityPanel() {
  const store = useStore();
  const { world, selected, selectedParcel } = useGameState();
  const [source, setSource] = useState<'self' | 'on_demand'>('self');
  useSecondTick(Boolean(world && !world.game.ended && (world.jobs.length || world.parcels.some((parcel) => parcel.facility?.expiresIn.length))));
  if (!world) return null;
  const resident = world.residents.find((item) => item.id === selected);
  const carried = world.content?.viewerId === selected ? world.content : null;
  const parcel = world.parcels.find((item) => item.id === selectedParcel);
  const coordinates = /^L(\d+)-(\d+)$/.exec(selectedParcel ?? '');
  const price = coordinates ? world.map.parcelPrices[Number(coordinates[2])]?.[Number(coordinates[1])] : undefined;
  const parcelJob = world.jobs.find((job) => job.parcelId === selectedParcel);
  const atParcel = resident && selectedParcel === `L${Math.min(Math.floor(resident.position.x / world.map.parcelSize), Math.max(1, Math.floor(world.map.size / world.map.parcelSize)) - 1)}-${Math.min(Math.floor(resident.position.y / world.map.parcelSize), Math.max(1, Math.floor(world.map.size / world.map.parcelSize)) - 1)}`;
  const canOperate = resident && store.canAct(resident.id);
  const own = parcel?.ownerId === selected;
  const canBuild = canOperate && own && !parcel.facility && !parcelJob;
  const availableContent = parcel?.facility?.kind === 'game_hall' ? carried?.gameContent : carried?.adContent;
  const contentFacility = parcel?.facility?.kind === 'ad' || parcel?.facility?.kind === 'game_hall';
  const shown = parcel?.facility ? activeContents(parcel.facility, (time) => store.countdown(time)) : 0;
  const nameOf = (id: string) => world.residents.find((item) => item.id === id)?.name ?? id;

  return (
    <section className="panel">
      <h2>地块与设施</h2>
      {!selectedParcel ? <p className="muted small">在地图上点击一块地。</p> : <>
        <p className="small"><strong>{selectedParcel}</strong> · {parcel ? `产权人 ${nameOf(parcel.ownerId)}` : '未出售'}</p>
        {parcel && <>
          <p className="small">份额：{Object.entries(parcel.shares).map(([id, count]) => `${nameOf(id)} ${count}%`).join('，')}</p>
          <p className="small">设施：{parcel.facility ? names[parcel.facility.kind] : '空地'}{contentFacility ? ` · 展示 ${shown}/5` : ''}</p>
        </>}
        {parcelJob && <p className="small" role="status">{jobNames[parcelJob.kind] ?? parcelJob.kind}中，约 {Math.ceil(store.countdown(parcelJob.remainingSeconds))} 秒</p>}
        {!parcel && <button type="button" disabled={!canOperate || !atParcel || !!resident?.walking} onClick={() => resident && store.act({ type: 'buy_parcel', residentId: resident.id })}>购买所站地块（{price ?? '…'} 金币）</button>}
        {own && <>
          {!parcel.facility && <div className="facility-actions">{(Object.keys(names) as BuildFacilityAction['kind'][]).map((kind) =>
            <button key={kind} type="button" disabled={!canBuild} onClick={() => resident && store.act({ type: 'build_facility', residentId: resident.id, parcelId: parcel.id, kind, source })}>建{names[kind]}</button>
          )}</div>}
          {contentFacility && <button type="button" disabled={!canOperate || !availableContent || shown >= 5} onClick={() => resident && store.act({ type: 'place_content', residentId: resident.id, parcelId: parcel.id })}>放入内容</button>}
        </>}
      </>}
      {resident && <>
        <p className="small">{resident.name} 携带：广告 {carried?.adContent ?? '…'}，游戏 {carried?.gameContent ?? '…'}</p>
        <label className="facility-source">算力来源
          <select value={source} onChange={(event) => setSource(event.target.value as 'self' | 'on_demand')}>
            <option value="self">自带算力（慢，免费）</option>
            <option value="on_demand">按需节点（快，付金币）</option>
          </select>
        </label>
        <div className="facility-actions">
          <button type="button" disabled={!canOperate} onClick={() => store.act({ type: 'make_content', residentId: resident.id, content: 'ad', source })}>制作广告</button>
          <button type="button" disabled={!canOperate} onClick={() => store.act({ type: 'make_content', residentId: resident.id, content: 'game', source })}>制作游戏</button>
        </div>
      </>}
    </section>
  );
}
