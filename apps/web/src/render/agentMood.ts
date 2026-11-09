import type { AgentResidentView } from '@aiverse/protocol';

export type AgentState = 'idle' | 'think' | 'talk' | 'happy';

/** Milliseconds a talk or a success is acted out, from when the page first sees it. */
export const TALK_MS = 2600;
export const HAPPY_MS = 2400;
/** A round that ends at once still shows as thinking this long, so it is not a flicker. */
export const THINK_MIN_MS = 700;

/**
 * Which of the four states an agent's resident shows. The server says whether it is waiting for its
 * brain and the latest talk or success it had; a cue plays for a fixed time from when the page first
 * sees its `seq`, so what was already there when the page opened is not replayed.
 */
export class MoodTracker {
  private seenSeq: number | null = null;
  private cue: { kind: 'talk' | 'happy'; until: number } | null = null;
  private thinking = false;
  private thinkUntil = 0;

  /** `now` is `performance.now()`; call it with every snapshot of the resident. */
  observe(agent: AgentResidentView, now: number): void {
    const seq = agent.cue?.seq ?? 0;
    if (this.seenSeq !== null && agent.cue && seq !== this.seenSeq) {
      this.cue = { kind: agent.cue.kind, until: now + (agent.cue.kind === 'happy' ? HAPPY_MS : TALK_MS) };
    }
    this.seenSeq = seq;
    const thinking = agent.thinking === true;
    if (thinking && !this.thinking) this.thinkUntil = now + THINK_MIN_MS;
    this.thinking = thinking;
  }

  /** Success outranks talk, which outranks waiting for the brain. */
  state(now: number): AgentState {
    if (this.cue && now < this.cue.until) return this.cue.kind;
    if (this.thinking || now < this.thinkUntil) return 'think';
    return 'idle';
  }
}
