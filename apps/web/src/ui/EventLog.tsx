import { describeEvent } from '../labels';
import { useGameState } from '../state/react';

export function EventLog() {
  const { world, log } = useGameState();
  const names = new Map(world?.players.map((p) => [p.id, p.name]));
  const nameOf = (id: string) => names.get(id) ?? id;

  return (
    <section className="panel log">
      <h2>行动记录</h2>
      {log.length === 0 ? (
        <p className="muted">开局后这里会显示每回合的行动。</p>
      ) : (
        <ul>
          {log.map(({ id, event }) => (
            <li key={id} className={event.type === 'actionFailed' ? 'failed' : undefined}>
              <span className="muted">R{event.round}</span> {describeEvent(event, nameOf)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
