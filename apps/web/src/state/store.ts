import {
  PROTOCOL_VERSION,
  type AgentStatus,
  type GameEvent,
  type GamePhase,
  type PlayerId,
  type ServerMessage,
  type WorldView,
} from '@aiverse/protocol';
import type { GameConnection } from '../net/connection';

export const LOG_LIMIT = 100;

export interface LogEntry {
  /** Stable, increasing id for list keys. */
  id: number;
  event: GameEvent;
}

export interface ClientState {
  connection: 'connecting' | 'ready' | 'failed';
  viewerId: PlayerId | null;
  roundDurationMs: number;
  phase: GamePhase | null;
  world: WorldView | null;
  agent: AgentStatus | null;
  /** Newest first, capped at LOG_LIMIT. */
  log: LogEntry[];
  error: string | null;
}

const INITIAL_STATE: ClientState = {
  connection: 'connecting',
  viewerId: null,
  roundDurationMs: 0,
  phase: null,
  world: null,
  agent: null,
  log: [],
  error: null,
};

/**
 * Client-side mirror of the latest authoritative state. It only stores what the
 * server sent; rendering and UI read from here and send intents through it.
 */
export class GameStore {
  private state = INITIAL_STATE;
  private nextLogId = 1;
  private readonly listeners = new Set<() => void>();
  private readonly detach: (() => void)[];

  constructor(private readonly connection: GameConnection) {
    this.detach = [
      connection.onMessage((message) => this.apply(message)),
      connection.onFailure((reason) => this.update({ connection: 'failed', error: reason })),
    ];
    connection.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION });
  }

  getState = (): ClientState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  start(): void {
    this.connection.send({ type: 'start' });
  }

  dispose(): void {
    for (const detach of this.detach) detach();
    this.connection.close();
    this.listeners.clear();
  }

  private apply(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        this.update({
          connection: 'ready',
          viewerId: message.viewerId,
          roundDurationMs: message.roundDurationMs,
          error: null,
        });
        return;
      case 'state': {
        const previousRound = this.state.world?.round ?? 0;
        // A repeated snapshot (reconnect, phase change) must not duplicate log lines.
        const fresh = message.world.round > previousRound
          ? message.events.map((event) => ({ id: this.nextLogId++, event })).reverse()
          : [];
        this.update({
          phase: message.phase,
          world: message.world,
          agent: message.agent,
          log: fresh.length ? [...fresh, ...this.state.log].slice(0, LOG_LIMIT) : this.state.log,
        });
        return;
      }
      case 'error':
        this.update({ error: `${message.code}: ${message.message}` });
        return;
    }
  }

  private update(patch: Partial<ClientState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}
