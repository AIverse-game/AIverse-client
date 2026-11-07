import type { AgentTurnView } from '@aiverse/protocol';
import { useGameState } from '../state/storeContext';
import { formatDuration } from './format';

const ACTION_NAMES: Record<string, string> = {
  move_to: '行走', harvest: '开始采集', sell_compute: '卖出算力', buy_program: '购买程序',
  say: '说话', offer_to_buy: '发起购买报价', offer_to_sell: '发起出售报价',
  respond_to_offer: '答复报价或合约', withdraw_offer: '撤回提议',
  propose_contract: '提议合约', deliver: '交付合约', cancel_contract: '取消合约',
  remember: '记录笔记', forget: '忘掉笔记',
};

const REASONS: Record<string, string> = {
  busy: '正在行走或采集', not_at_market: '不在收购点范围内', no_program: '没有可用程序',
  spring_empty: '算力泉已空', not_at_spring: '不在算力泉范围内', not_enough_items: '物品不足',
  not_enough_coins: '可用金币不足', not_enough_compute: '算力不足', unknown_program: '未知程序版本',
  invalid_arguments: '参数无效', unknown_tool: '无法识别的动作',
  game_over: '对局已结束', resident_left: '居民已出局',
};

const signed = (value: number) => value > 0 ? `+${value}` : String(value);
const change = (coins: number, compute: number) => `金币 ${signed(coins)} · 算力 ${signed(compute)}`;

/** Only the selected resident's completed turns; never show a stale viewer's snapshot. */
export function AgentTimelinePanel() {
  const { world, selected, connection } = useGameState();
  if (!world) return null;
  const resident = world.residents.find((person) => person.id === selected);
  const timeline = world.agentTimeline;
  const ready = timeline?.residentId === selected;
  const turns = ready ? timeline.turns : [];

  return (
    <section className="panel agent-timeline-panel" aria-label="AI 行动时间线">
      <h2>AI 行动时间线{resident ? ` · ${resident.name}` : ''}</h2>
      <p className="muted small">最近 30 个已完成的决策轮，最新在前。计划摘要是 AI 自述，实际成败以执行记录为准。</p>
      {connection === 'failed' && <p className="error small">连接已断开，以下为最后收到的记录。</p>}
      {!resident ? <p className="muted small">点选一名居民，查看它的计划与执行结果。</p>
        : !ready ? <p className="muted small">等待该居民的行动记录…</p>
        : turns.length === 0 ? <p className="muted small">暂无已完成的 AI 决策轮。交给 AI 后，摘要和动作会显示在这里。</p>
        : <ol className="agent-timeline">
          {[...turns].reverse().map((turn, index) => {
            const previous = turns[turns.length - index - 2];
            return <Turn key={turn.seq} turn={turn} previous={previous} />;
          })}
        </ol>}
    </section>
  );
}

function Turn({ turn, previous }: { turn: AgentTurnView; previous: AgentTurnView | undefined }) {
  const betweenCoins = previous ? turn.before.coins - previous.after.coins : 0;
  const betweenCompute = previous ? turn.before.compute - previous.after.compute : 0;
  return (
    <li className="agent-turn">
      <div className="agent-turn-heading">
        <strong>{formatDuration(turn.time)} — {formatDuration(turn.endedAt)}</strong>
        <span className="muted">#{turn.seq}</span>
      </div>
      {(betweenCoins !== 0 || betweenCompute !== 0) && <p className="small muted">
        轮间变化：{change(betweenCoins, betweenCompute)}（含采集到账、他人交易或手动操作等）
      </p>}
      <p className="agent-summary"><strong>计划摘要：</strong>{turn.summary ?? 'AI 未提供摘要。'}</p>
      <p className="small">本轮资源：金币 {turn.before.coins} → {turn.after.coins} · 算力 {turn.before.compute} → {turn.after.compute}</p>
      {turn.error && <p className="error small" role="status">{turn.error}</p>}
      {turn.calls.length === 0 ? <p className="muted small">本轮未执行动作。</p>
        : <ol className="agent-calls">
          {turn.calls.map((call, index) => <li key={index}>
            <div className="agent-call-heading">
              <span>{formatDuration(call.time)} · {ACTION_NAMES[call.name] ?? call.name}</span>
              <span className={call.ok ? 'agent-success' : 'error'}>
                {call.ok ? (call.name === 'harvest' || call.name === 'move_to' ? '已开始' : '成功') : '未执行'}
              </span>
            </div>
            {!call.ok && <p className="error small">{REASONS[call.code ?? ''] ?? call.code ?? '动作被拒绝'}</p>}
            <p className="small muted">{change(call.coinsChange, call.computeChange)}</p>
            <details><summary>动作参数</summary><pre>{call.arguments}</pre></details>
          </li>)}
        </ol>}
      <p className="muted small">金币含报价与合约中的托管；资源变化记录这一时间段的净变化。</p>
    </li>
  );
}
