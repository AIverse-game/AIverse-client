import { useState } from 'react';
import { parcelAt, sameBlock, venueFits, venueSize, venueTaking, type BuildFacilityAction, type MallOrientation, type MapGridSpec } from '@aiverse/protocol';
import { activeContents } from '../state/facilityContents';
import { useGameState, useStore } from '../state/storeContext';
import { useSecondTick } from './useSecondTick';

const names = { ad: '广告位', portal: '传送门', game_hall: '游戏厅', workspace: '工作空间', mall: '商场', garden: '花园' } as const;
const venueKinds = ['game_hall', 'workspace', 'mall'] as const;
const venueJobs: Record<string, (typeof venueKinds)[number]> = { build_game_hall: 'game_hall', build_workspace: 'workspace', build_mall: 'mall' };
const isVenue = (kind: BuildFacilityAction['kind']): kind is (typeof venueKinds)[number] => (venueKinds as readonly string[]).includes(kind);
const jobNames: Record<string, string> = { build_ad: '建广告位', build_portal: '建传送门', build_game_hall: '建游戏厅', build_workspace: '建工作空间', build_mall: '建商场', build_garden: '建花园', make_content: '渲染广告', make_game: '渲染游戏' };

/** Whether a position stands in the same block as a parcel id; a block is bought whole, so any of its parcels will do. */
function standsInBlockOf(map: MapGridSpec, position: { x: number; y: number }, parcelId: string | null): boolean {
  const match = /^L(\d+)-(\d+)$/.exec(parcelId ?? '');
  return match !== null && sameBlock(map, parcelAt(map, position.x, position.y), { col: Number(match[1]), row: Number(match[2]) });
}

/** First manual facility loop: buy a plot, build, render content and fill its interior. */
export function FacilityPanel() {
  const store = useStore();
  const { world, selected, selectedParcel } = useGameState();
  const [source, setSource] = useState<'self' | 'on_demand'>('self');
  const [orientation, setOrientation] = useState<MallOrientation>('north_south');
  useSecondTick(Boolean(world && !world.game.ended && (world.jobs.length || world.parcels.some((parcel) => parcel.facility?.expiresIn.length))));
  if (!world) return null;
  const resident = world.residents.find((item) => item.id === selected);
  const carried = world.content?.viewerId === selected ? world.content : null;
  const parcel = world.parcels.find((item) => item.id === selectedParcel);
  const coordinates = /^L(\d+)-(\d+)$/.exec(selectedParcel ?? '');
  const price = coordinates ? world.map.parcelPrices[Number(coordinates[2])]?.[Number(coordinates[1])] : undefined;
  const parcelJob = world.jobs.find((job) => job.parcelId === selectedParcel);
  const atParcel = resident && standsInBlockOf(world.map, resident.position, selectedParcel);
  const canOperate = resident && store.canAct(resident.id);
  const own = parcel?.ownerId === selected;
  // A venue, built or being built, takes up several parcels from the one it stands on: a square for a game hall or workspace, two in a row for a mall, down or across as its owner chose.
  const venues = [
    ...world.parcels.flatMap((item) => (item.facility && venueKinds.includes(item.facility.kind as (typeof venueKinds)[number]) ? [{ id: item.id, col: item.col, row: item.row, kind: item.facility.kind, orientation: item.facility.orientation }] : [])),
    ...world.jobs.flatMap((job) => world.parcels.filter((item) => item.id === job.parcelId && venueJobs[job.kind]).map((item) => ({ id: item.id, col: item.col, row: item.row, kind: venueJobs[job.kind]!, orientation: job.orientation }))),
  ];
  const takenBy = coordinates ? venueTaking(world.map, venues, Number(coordinates[1]), Number(coordinates[2])) : undefined;
  // Whether a venue of `kind` could start here: its land lies in the block and every parcel of it is the owner's, bare and not taken up.
  const venueFitsHere = (kind: (typeof venueKinds)[number]) => {
    if (coordinates === null) return false;
    const { cols, rows } = venueSize(world.map, kind, orientation);
    return venueFits(world.map, Number(coordinates[1]), Number(coordinates[2]), kind, orientation) && Array.from({ length: cols * rows }, (_, index) => {
      const col = Number(coordinates[1]) + (index % cols), row = Number(coordinates[2]) + Math.floor(index / cols);
      const item = world.parcels.find((other) => other.col === col && other.row === row);
      return item?.ownerId === selected && !item.facility && !world.jobs.some((job) => job.parcelId === item.id) && !venueTaking(world.map, venues, col, row);
    }).every(Boolean);
  };
  const venueHint = (kind: (typeof venueKinds)[number]) => {
    const { cols, rows } = venueSize(world.map, kind, orientation);
    return `占 ${cols} × ${rows} 块地，本块在西北角${venueFitsHere(kind) ? '' : '（这里放不下：必须在街区内，占的地块都得是自己的空地）'}`;
  };
  // A block has one garden, built or being built; while it stands every income of the block's facilities is a tenth higher.
  const inGardenBlock = (item: { col: number; row: number }) => coordinates !== null && sameBlock(world.map, { col: Number(coordinates[1]), row: Number(coordinates[2]) }, item);
  const blockHasGarden = world.parcels.some((item) => item.facility?.kind === 'garden' && inGardenBlock(item));
  const blockBuildsGarden = world.jobs.some((job) => job.kind === 'build_garden' && world.parcels.some((item) => item.id === job.parcelId && inGardenBlock(item)));
  const gardenHint = blockHasGarden || blockBuildsGarden ? '这个街区已有花园，或正在建' : '建成后镇上一次性奖励地主，街区里所有设施的收入多 10%；每个街区一座';
  const canBuild = canOperate && own && !parcel.facility && !parcelJob && !takenBy;
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
          {blockHasGarden && <p className="small">本街区有花园：街区里所有设施的收入多 10%</p>}
          <p className="small">设施：{parcel.facility ? names[parcel.facility.kind] : takenBy ? `被 ${takenBy.id} 的场馆占用` : '空地'}{contentFacility ? ` · 展示 ${shown}/5` : ''}</p>
        </>}
        {parcelJob && <p className="small" role="status">{jobNames[parcelJob.kind] ?? parcelJob.kind}中，约 {Math.ceil(store.countdown(parcelJob.remainingSeconds))} 秒</p>}
        {!parcel && <button type="button" disabled={!canOperate || !atParcel || !!resident?.walking} onClick={() => resident && store.act({ type: 'buy_parcel', residentId: resident.id })}>购买所站街区（{price ?? '…'} 金币）</button>}
        {own && <>
          {!parcel.facility && !takenBy && <label className="facility-source">商场朝向
            <select value={orientation} onChange={(event) => setOrientation(event.target.value as MallOrientation)}>
              <option value="north_south">竖放（占本块和正南一块，入口朝南）</option>
              <option value="east_west">横放（占本块和正东一块，入口朝东）</option>
            </select>
          </label>}
          {!parcel.facility && !takenBy && <div className="facility-actions">{(Object.keys(names) as BuildFacilityAction['kind'][]).map((kind) =>
            <button key={kind} type="button" disabled={!canBuild || (isVenue(kind) && !venueFitsHere(kind)) || (kind === 'garden' && (blockHasGarden || blockBuildsGarden))} title={isVenue(kind) ? venueHint(kind) : kind === 'garden' ? gardenHint : undefined} onClick={() => resident && store.act({ type: 'build_facility', residentId: resident.id, parcelId: parcel.id, kind, source, ...(kind === 'mall' ? { orientation } : {}) })}>建{names[kind]}</button>
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
