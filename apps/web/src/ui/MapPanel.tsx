import { formatCoordinate } from '../render/layout';
import { useGameState, useStore } from '../state/storeContext';

/** Map facts and residents as text, to cross-check the drawing; picks who to operate. */
export function MapPanel() {
  const store = useStore();
  const { world, selected, selectedParcel } = useGameState();
  if (!world) return null;
  const size = formatCoordinate(world.map.size);

  return (
    <section className="panel">
      <h2>地图</h2>
      <p className="small">
        {size} × {size}，原点 (0, 0) 是西北角；默认视角下它在地图最上方的顶角，x 向右下、y 向左下增大，旋转后随之变化。
      </p>
      <p className="muted small">滚轮移动视野，Ctrl（或触控板捏合）缩放，按住右键拖动旋转，左键拖动平移。</p>
      <p className="muted small">点击地块查看和建设；选中居民后按住 Shift 点击地图可让其行走。</p>
      <p className="small">当前地块：{selectedParcel ?? '未选择'}</p>
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
                {resident.walking && <span className="tag tag-walking">行走中</span>}
                <span className="coords">
                  ({formatCoordinate(resident.position.x)}, {formatCoordinate(resident.position.y)})
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
