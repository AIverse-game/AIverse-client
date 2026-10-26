import { PHASE_NAMES } from '../labels';
import { useGameState, useStore } from '../state/react';

export function TopBar() {
  const store = useStore();
  const { connection, phase, world, error } = useGameState();
  const canStart = connection === 'ready' && phase === 'lobby';

  return (
    <header className="top-bar">
      <h1>AIverse</h1>
      <div className="round">
        {world ? `第 ${world.round} / ${world.maxRounds} 回合` : connection === 'failed' ? '无法连接' : '连接中…'}
        {phase && <span className={`phase phase-${phase}`}>{PHASE_NAMES[phase]}</span>}
      </div>
      <button type="button" onClick={() => store.start()} disabled={!canStart}>
        开始对局
      </button>
      <p className="mode">本地演示：规则在浏览器内运行，居民由调试用规则 Agent 控制</p>
      {error && <p className="error" role="alert">{error}</p>}
    </header>
  );
}
