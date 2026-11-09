import type { ResidentId, ResidentView, SpeechView } from '@aiverse/protocol';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useGameState, useStore } from '../state/storeContext';
import { formatDuration } from './format';

/** Mirrors SPEECH_LENGTH_LIMIT in the server, which counts code points; it trims and checks again. */
const SPEECH_MAX_LENGTH = 300;

/** Value of the listener choice that means speaking aloud rather than to one resident. */
const ALOUD = '';

/**
 * What residents have said aloud, the selected resident's whispers (the server sends no one
 * else's), and a way for that resident to speak aloud or to one other resident.
 */
export function SpeechPanel() {
  const store = useStore();
  const { world, selected, lastAction } = useGameState();
  const [text, setText] = useState('');
  // The listener belongs to the speaker it was chosen for; another speaker starts aloud.
  const [choice, setChoice] = useState<{ speaker: ResidentId | null; to: string }>({ speaker: null, to: ALOUD });
  // Whether the latest action is this panel's line, so its result clears the text or explains a refusal.
  const [awaiting, setAwaiting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  // The server already sends only the selected resident's whispers; filtering again keeps a
  // state sent for an earlier selection, or one left over after the connection failed, honest.
  const lines = (world?.speech ?? []).filter(
    (line) => line.to === undefined || (selected !== null && (line.speakerId === selected || line.to === selected)),
  );
  const latest = lines.at(-1)?.seq;

  // Keep the newest line in view as the conversation goes on.
  useEffect(() => {
    const element = list.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [latest]);

  // The text is kept until the server accepts it, so a refused line can be sent again.
  useEffect(() => {
    if (!awaiting || lastAction?.status === 'pending') return;
    setAwaiting(false);
    if (lastAction?.status === 'accepted') setText('');
    if (lastAction?.status === 'rejected') setRefusal(lastAction.reason);
  }, [awaiting, lastAction]);

  if (!world) return null;
  const names = new Map(world.residents.map((resident) => [resident.id, resident]));
  const speaker = world.residents.find((candidate) => candidate.id === selected) ?? null;
  // Speaking works while walking, so only leaving or the end of the game stops it.
  const canSpeak = speaker !== null && store.canAct(speaker.id);
  const others = world.residents.filter((resident) => resident.id !== speaker?.id && !resident.left);
  const listener = choice.speaker === speaker?.id ? choice.to : ALOUD;
  // A whisper's listener who has since left stays chosen, so the words are never sent aloud instead.
  const gone = listener !== ALOUD && !others.some((resident) => resident.id === listener);
  const trimmed = text.trim();
  // Code points, as the server counts; `maxLength` would count UTF-16 units.
  const length = [...trimmed].length;
  const canSend = canSpeak && !gone && !awaiting && length > 0 && length <= SPEECH_MAX_LENGTH;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!speaker || !canSend) return;
    store.act({ type: 'say', residentId: speaker.id, text: trimmed, ...(listener === ALOUD ? {} : { to: listener }) });
    setAwaiting(true);
    setRefusal(null);
  };

  return (
    <section className="panel">
      <h2>对话</h2>
      {lines.length === 0 ? (
        <p className="muted small">还没有人说话。</p>
      ) : (
        <ol className="speech" ref={list}>
          {lines.map((line) => (
            <SpeechLine key={line.seq} line={line} names={names} />
          ))}
        </ol>
      )}
      <form className="speech-form" onSubmit={submit}>
        <label>
          {speaker ? `${speaker.name} 对` : '对'}
          <select
            value={listener}
            disabled={!canSpeak}
            onChange={(event) => setChoice({ speaker: speaker?.id ?? null, to: event.target.value })}
          >
            <option value={ALOUD}>附近的人</option>
            {others.map((resident) => (
              <option key={resident.id} value={resident.id}>
                {resident.name}（私聊）
              </option>
            ))}
            {gone && (
              <option value={listener} disabled>
                {names.get(listener)?.name ?? listener}（已出局）
              </option>
            )}
          </select>
          说
        </label>
        <input
          type="text"
          aria-label="说的话"
          placeholder={canSpeak ? `最多 ${SPEECH_MAX_LENGTH} 字` : '先选一名在局中的居民'}
          disabled={!canSpeak}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setRefusal(null);
          }}
        />
        <button type="submit" disabled={!canSend}>
          发送
        </button>
      </form>
      {canSpeak && length > SPEECH_MAX_LENGTH && (
        <p className="error small" role="alert">
          一句最多 {SPEECH_MAX_LENGTH} 字，现在 {length} 字。
        </p>
      )}
      {canSpeak && gone && (
        <p className="error small" role="alert">
          {names.get(listener)?.name ?? listener} 已出局，不能再私聊；换一个对象或改为对附近的人说。
        </p>
      )}
      {refusal && (
        <p className="error small" role="alert">
          未发出：{refusal}
        </p>
      )}
      <p className="muted small">
        说话不花东西：当众说只有附近的居民听得到；私聊不论远近只有对方听到。行走中也能说话。
        这里只显示所选居民自己发出或收到的私聊。
      </p>
    </section>
  );
}

function SpeechLine({ line, names }: { line: SpeechView; names: Map<string, ResidentView> }) {
  const speaker = names.get(line.speakerId);
  return (
    <li className={line.to === undefined ? undefined : 'whisper'}>
      <span className="time">{formatDuration(Math.floor(line.time))}</span>
      <span className="swatch" style={{ background: speaker?.color }} />
      <span className="name">{speaker?.name ?? line.speakerId}</span>
      {line.to !== undefined ? (
        <span className="tag">私聊 {names.get(line.to)?.name ?? line.to}</span>
      ) : (
        <span className="muted">{line.listeners.length === 0 ? '没人听到' : `${line.listeners.length} 人听到`}</span>
      )}
      <p className="text">{line.text}</p>
    </li>
  );
}
