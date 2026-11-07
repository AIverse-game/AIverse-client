import { useGameState } from '../state/storeContext';
import { CoinIcon } from './CoinIcon';

/** Residents by coins as the server ranks them; final once the game is over. */
export function RankingPanel() {
  const { world } = useGameState();
  if (!world || world.residents.length === 0) return null;
  // Stable sort, so residents sharing a place keep the server's order.
  const ranked = [...world.residents].sort((a, b) => a.rank - b.rank);

  return (
    <section className="panel">
      <h2>{world.game.ended ? '最终排名' : '金币排名'}</h2>
      <ol className="ranking">
        {ranked.map((resident) => (
          <li key={resident.id} className={resident.left ? 'left' : undefined}>
            <span className="place">{resident.rank}</span>
            <span className="swatch" style={{ background: resident.color }} />
            <span className="name">{resident.name}</span>
            {resident.left && <span className="tag">已出局</span>}
            <span className="coins">
              <CoinIcon />
              {resident.coins.toLocaleString('zh-CN')} 金币
            </span>
          </li>
        ))}
      </ol>
      <p className="muted small">
        {world.game.ended
          ? '游戏已结束，未成交的报价和挂单已撤销，合约已终止，预存的金币已退回；手里剩下的物品不计。'
          : '按金币总额排名，含报价、合约和买单中预存的金币；手里的物品不计。出局的居民保留金币和名次。'}
      </p>
    </section>
  );
}
