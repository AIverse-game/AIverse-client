import { useGameState } from '../state/react';

const STATUS_TEXT = { connecting: '连接中…', ready: '已连接', failed: '无法连接' } as const;

export function TopBar() {
  const { connection, error } = useGameState();

  return (
    <header className="top-bar">
      <h1>AIverse</h1>
      <span className={`status status-${connection}`}>{STATUS_TEXT[connection]}</span>
      <p className="mode">地图与居民坐标由 Python 服务端下发，页面只负责渲染</p>
      {error && <p className="error" role="alert">{error}</p>}
    </header>
  );
}
