import { describe, expect, it } from 'vitest';
import { HAPPY_MS, MoodTracker, TALK_MS, THINK_MIN_MS } from './agentMood';

describe('MoodTracker', () => {
  it('stands idle until told otherwise', () => {
    const mood = new MoodTracker();

    mood.observe({}, 0);

    expect(mood.state(0)).toBe('idle');
  });

  it('thinks while the server says the agent waits for its brain', () => {
    const mood = new MoodTracker();
    mood.observe({}, 0);

    mood.observe({ thinking: true }, 1000);
    const waiting = mood.state(1000 + THINK_MIN_MS * 10);
    mood.observe({}, 20_000);

    expect(waiting).toBe('think');
    expect(mood.state(20_000 + THINK_MIN_MS)).toBe('idle');
  });

  it('keeps a round that ended at once on show for a moment', () => {
    const mood = new MoodTracker();
    mood.observe({}, 0);

    mood.observe({ thinking: true }, 1000);
    mood.observe({}, 1005);

    expect(mood.state(1005)).toBe('think');
    expect(mood.state(1000 + THINK_MIN_MS)).toBe('idle');
  });

  it('acts out a cue when its seq is new, then goes back', () => {
    const mood = new MoodTracker();
    mood.observe({ cue: { kind: 'talk', seq: 1 } }, 0);

    mood.observe({ cue: { kind: 'talk', seq: 2 } }, 5000);

    expect(mood.state(5000)).toBe('talk');
    expect(mood.state(5000 + TALK_MS)).toBe('idle');
  });

  it('does not replay a cue that was already there when the resident first appeared', () => {
    const mood = new MoodTracker();

    mood.observe({ cue: { kind: 'happy', seq: 7 } }, 0);

    expect(mood.state(0)).toBe('idle');
  });

  it('does not restart a cue on a snapshot with the same seq', () => {
    const mood = new MoodTracker();
    mood.observe({}, 0);
    mood.observe({ cue: { kind: 'happy', seq: 1 } }, 1000);

    mood.observe({ cue: { kind: 'happy', seq: 1 } }, 1000 + HAPPY_MS - 100);

    expect(mood.state(1000 + HAPPY_MS)).toBe('idle');
  });

  it('shows success over talk over thinking', () => {
    const mood = new MoodTracker();
    mood.observe({}, 0);

    mood.observe({ thinking: true, cue: { kind: 'talk', seq: 1 } }, 1000);
    const talking = mood.state(1000);
    mood.observe({ thinking: true, cue: { kind: 'happy', seq: 2 } }, 1100);

    expect(talking).toBe('talk');
    expect(mood.state(1100)).toBe('happy');
    expect(mood.state(1100 + HAPPY_MS)).toBe('think');
  });
});
