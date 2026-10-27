import { useState, type FormEvent } from 'react';
import { formatCoordinate } from '../render/layout';
import { useGameState, useStore } from '../state/react';
import type { ActionStatus } from '../state/store';

/**
 * Manual control for when no AI drives the residents. It sends the same operation
 * primitives an AI will use; the server decides whether each one is allowed.
 */
export function ActionPanel() {
  const store = useStore();
  const { world, selected, lastAction } = useGameState();
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  if (!world) return null;
  const resident = world.residents.find((candidate) => candidate.id === selected) ?? null;
  const size = world.map.size;
  const ended = world.game.ended;
  const canAct = resident !== null && store.canAct(resident.id);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!resident) return;
    store.act({ type: 'move_to', residentId: resident.id, target: { x: Number(x), y: Number(y) } });
  };

  const leave = () => {
    if (!resident) return;
    if (!window.confirm(`让 ${resident.name} 退出游戏？退出后不能再行动，物品清空，金币保留并参与排名。`)) return;
    store.act({ type: 'leave_game', residentId: resident.id });
  };

  return (
    <section className="panel">
      <h2>操作</h2>
      {resident ? (
        <p className="small selected">
          <span className="swatch" style={{ background: resident.color }} />
          {resident.name}，现在位于 ({formatCoordinate(resident.position.x)}, {formatCoordinate(resident.position.y)})
        </p>
      ) : (
        <p className="muted small">先在居民列表或地图上点选一名居民。</p>
      )}
      {ended ? (
        <p className="muted small">游戏已结束，不能再操作。</p>
      ) : (
        resident?.left && <p className="muted small">{resident.name} 已出局，不能再操作。</p>
      )}
      <form className="move-form" onSubmit={submit}>
        <label>
          x
          <input
            type="number"
            inputMode="decimal"
            required
            min={0}
            max={size}
            step="any"
            value={x}
            onChange={(event) => setX(event.target.value)}
          />
        </label>
        <label>
          y
          <input
            type="number"
            inputMode="decimal"
            required
            min={0}
            max={size}
            step="any"
            value={y}
            onChange={(event) => setY(event.target.value)}
          />
        </label>
        <button type="submit" disabled={!canAct}>
          移动到此坐标
        </button>
      </form>
      <p className="muted small">选中居民后，点击地图上的地面也会让其移动到该点。</p>
      <button type="button" className="leave" disabled={!canAct} onClick={leave}>
        退出游戏
      </button>
      {lastAction && <ActionStatusLine status={lastAction} />}
    </section>
  );
}

function ActionStatusLine({ status }: { status: ActionStatus }) {
  switch (status.status) {
    case 'pending':
      return <p className="muted small" role="status">执行中…</p>;
    case 'accepted':
      return <p className="muted small" role="status">已执行</p>;
    case 'rejected':
      return <p className="error small" role="alert">未执行：{status.reason}</p>;
  }
}
