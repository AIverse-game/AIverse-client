import { useGameState, useStore } from '../state/react';
import { formatDuration } from './format';
import { useSecondTick } from './useSecondTick';

const STATUS_TEXT = { connecting: '连接中…', ready: '已连接', failed: '无法连接' } as const;

export function TopBar() {
  const { connection, error } = useGameState();

  return (
    <header className="top-bar">
      <h1>AIverse</h1>
      <span className={`status status-${connection}`}>{STATUS_TEXT[connection]}</span>
      <GameClock />
      <p className="mode">地图与居民由 Python 服务端计算，页面只负责渲染；未接入 AI 时可手动操作居民</p>
      {error && <p className="error" role="alert">{error}</p>}
    </header>
  );
}

/** Time left in the game, ticking locally between snapshots; the server decides when it ends. */
function GameClock() {
  const store = useStore();
  const { world } = useGameState();
  const ended = world?.game.ended ?? false;
  useSecondTick(!ended);

  if (!world) return null;
  if (ended) return <span className="clock clock-ended">游戏已结束</span>;
  const remaining = store.remainingSeconds() ?? 0;
  // The local count can reach zero a moment before the server's final state arrives.
  if (remaining <= 0) return <span className="clock">即将结束…</span>;
  return <span className="clock">剩余 {formatDuration(remaining)}</span>;
}
