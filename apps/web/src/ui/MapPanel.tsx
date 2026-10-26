import { formatCoordinate } from '../render/layout';
import { useGameState } from '../state/react';

/** Map facts and resident coordinates as text, to cross-check the drawing. */
export function MapPanel() {
  const { world } = useGameState();
  if (!world) return null;
  const size = formatCoordinate(world.map.size);

  return (
    <section className="panel">
      <h2>地图</h2>
      <p className="small">
        {size} × {size}，原点 (0, 0) 在左上角，x 向右、y 向下增大。
      </p>
      <h2 className="subheading">居民</h2>
      {world.residents.length === 0 ? (
        <p className="muted small">地图上暂无居民。</p>
      ) : (
        <ul className="residents">
          {world.residents.map((resident) => (
            <li key={resident.id}>
              <span className="swatch" style={{ background: resident.color }} />
              <span className="name">{resident.name}</span>
              <span className="coords">
                ({formatCoordinate(resident.position.x)}, {formatCoordinate(resident.position.y)})
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
