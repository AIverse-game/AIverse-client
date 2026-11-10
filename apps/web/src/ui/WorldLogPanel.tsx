import type { ResidentView } from '@aiverse/protocol';
import { useLayoutEffect, useRef } from 'react';
import { useGameState } from '../state/storeContext';
import { formatDuration } from './format';
import { describeWorldLogEntry, type LogPart } from './worldLogText';

/** How close to the bottom, in pixels, still counts as following the newest lines. */
const FOLLOW_SLACK = 24;

/**
 * Everything residents do, whispers and offers between anyone included, as a terminal: the newest
 * line at the bottom pushes the older ones up. It follows new lines unless the reader scrolled up.
 */
export function WorldLogPanel({ onClose }: { onClose: () => void }) {
  const { world, connection } = useGameState();
  const list = useRef<HTMLOListElement>(null);
  const following = useRef(true);
  const entries = world?.worldLog ?? [];
  const latest = entries.at(-1)?.seq;
  const ended = world?.game.ended ?? false;

  useLayoutEffect(() => {
    const element = list.current;
    if (element && following.current) element.scrollTop = element.scrollHeight;
  }, [latest, ended]);

  const onScroll = () => {
    const element = list.current;
    if (element) following.current = element.scrollHeight - element.scrollTop - element.clientHeight < FOLLOW_SLACK;
  };

  const residents = new Map((world?.residents ?? []).map((resident) => [resident.id, resident]));

  return (
    <section className="world-log" aria-label="世界日志">
      <header className="world-log-bar">
        <h2>世界日志</h2>
        <span className="muted">{entries.length} 条</span>
        <button type="button" className="world-log-close" aria-label="关闭世界日志" onClick={onClose}>
          ×
        </button>
      </header>
      <ol className="world-log-lines" ref={list} onScroll={onScroll} role="log">
        {connection === 'failed' && <li className="error">连接已断开，以下为最后收到的记录。</li>}
        {entries.length === 0 && <li className="muted">等待世界里发生第一件事…</li>}
        {entries.map((entry) => (
          <li key={entry.seq} className={`log-${entry.verb}${entry.verb === 'said' && entry.otherId ? ' log-whisper' : ''}`}>
            <span className="time">[{formatDuration(Math.floor(entry.time))}]</span>{' '}
            {describeWorldLogEntry(entry).map((part, index) => (
              <Part key={index} part={part} residents={residents} />
            ))}
          </li>
        ))}
        {ended && <li className="world-log-end">== 对局结束 ==</li>}
        <li className="world-log-cursor" aria-hidden="true">&gt; _</li>
      </ol>
    </section>
  );
}

function Part({ part, residents }: { part: LogPart; residents: Map<string, ResidentView> }) {
  if (typeof part === 'string') return <>{part}</>;
  const resident = residents.get(part.residentId);
  return (
    <span className="log-name" style={{ color: resident?.color }}>
      {resident?.name ?? part.residentId}
    </span>
  );
}
