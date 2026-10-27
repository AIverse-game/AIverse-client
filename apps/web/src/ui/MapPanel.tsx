import { formatCoordinate } from '../render/layout';
import { useGameState, useStore } from '../state/react';

/** Map facts and resident coordinates as text, to cross-check the drawing; picks who to operate. */
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
