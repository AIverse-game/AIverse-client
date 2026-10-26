import { createScriptedAgent, type Strategy } from '@aiverse/agents';
import type { PlayerProfile } from '@aiverse/engine';
import { GameHost, type Scheduler } from '@aiverse/host';

// Stand-in for the future game server while the game is a static site. It is the
// only client-side code allowed to import the engine, host and agents.

export const LOCAL_VIEWER_ID = 'p1';

/** Faster than the 20 s design target so the demo is watchable. */
export const LOCAL_ROUND_MS = 1500;
export const LOCAL_DECISION_TIMEOUT_MS = 1000;

const DEMO_SEATS: { profile: PlayerProfile; strategy: Strategy }[] = [
  { profile: { id: LOCAL_VIEWER_ID, name: '阿青', color: '#e4572e' }, strategy: 'self-sufficient' },
  { profile: { id: 'p2', name: '小麦', color: '#f3a712' }, strategy: 'grain-gatherer' },
  { profile: { id: 'p3', name: '松木', color: '#5fb49c' }, strategy: 'wood-gatherer' },
  { profile: { id: 'p4', name: '白露', color: '#8e9aed' }, strategy: 'self-sufficient' },
];

export interface LocalServerOptions {
  seed: number;
  scheduler: Scheduler;
  onError?: (error: unknown) => void;
}

export function createLocalServer({ seed, scheduler, onError }: LocalServerOptions): GameHost {
  return new GameHost({
    seed,
    seats: DEMO_SEATS.map(({ profile, strategy }) => ({ profile, decider: createScriptedAgent(strategy) })),
    scheduler,
    roundDurationMs: LOCAL_ROUND_MS,
    decisionTimeoutMs: LOCAL_DECISION_TIMEOUT_MS,
    ...(onError ? { onError } : {}),
  });
}
