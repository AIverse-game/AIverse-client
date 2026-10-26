import { useGameState } from '../state/react';

export function Leaderboard() {
  const { world, viewerId } = useGameState();
  if (!world) return null;
  // Stable sort keeps seat order among equal coins; equal coins share a rank.
  const ranked = [...world.players].sort((a, b) => b.coins - a.coins);

  return (
    <section className="panel">
      <h2>排行榜</h2>
      <ol className="leaderboard">
        {ranked.map((player) => (
          <li key={player.id} className={player.id === viewerId ? 'me' : undefined}>
            <span className="rank">{ranked.findIndex((p) => p.coins === player.coins) + 1}</span>
            <span className="swatch" style={{ background: player.color }} />
            <span className="name">{player.name}</span>
            <span className="coins">{player.coins} 金币</span>
          </li>
        ))}
      </ol>
      <p className="muted small">即时金币；库存尚未变现，不计入排名。</p>
    </section>
  );
}
