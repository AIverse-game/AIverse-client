import { useGameState } from '../state/storeContext';
import { CoinIcon } from './CoinIcon';

/** Residents by score as the server ranks them: coins plus what their items are worth; final once the game is over. */
export function RankingPanel() {
  const { world } = useGameState();
  if (!world || world.residents.length === 0) return null;
  // Stable sort, so residents sharing a place keep the server's order.
  const ranked = [...world.residents].sort((a, b) => a.rank - b.rank);

  return (
    <section className="panel">
      <h2>{world.game.ended ? '最终排名' : '排名'}</h2>
      <ol className="ranking">
        {ranked.map((resident) => (
          <li key={resident.id} className={resident.left ? 'left' : undefined}>
            <span className="place">{resident.rank}</span>
            <span className="swatch" style={{ background: resident.color }} />
            <span className="name">{resident.name}</span>
            {resident.left && <span className="tag">已出局</span>}
            <span className="coins" title={`金币 ${resident.coins.toLocaleString('zh-CN')} + 物品估值 ${resident.itemValue.toLocaleString('zh-CN')}`}>
              <CoinIcon />
              {resident.score.toLocaleString('zh-CN')}
              <span className="muted">（{resident.coins.toLocaleString('zh-CN')} + {resident.itemValue.toLocaleString('zh-CN')}）</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="muted small">
        {world.game.ended
          ? '游戏已结束，汲能塔已停产，未成交的报价和挂单已撤销，合约已终止，预存的金币和物品已退回；得分按结束时的收购价计算。'
          : '按得分排名：金币总额（含报价、合约、汲能塔和买单中预存的金币）加物品估值。能量按收购点现价、晶核按进口价的一半估值，晶砂不计，得分随服务端每次推送更新；出局的居民保留金币和名次，物品已清空。'}
      </p>
    </section>
  );
}
