import {
  PROTOCOL_VERSION,
  type Action,
  type ResidentId,
  type ServerMessage,
  type WorldView,
} from '@aiverse/protocol';
import type { GameConnection } from '../net/connection';

/** Outcome of the latest operation primitive this client sent. */
export type ActionStatus = { status: 'pending' } | { status: 'accepted' } | { status: 'rejected'; reason: string };

export interface ClientState {
  connection: 'connecting' | 'ready' | 'failed';
  world: WorldView | null;
  error: string | null;
  /** The resident manual operations apply to. Local only; the server never sees it. */
  selected: ResidentId | null;
  lastAction: ActionStatus | null;
}

const INITIAL_STATE: ClientState = {
  connection: 'connecting',
  world: null,
  error: null,
  selected: null,
  lastAction: null,
};

/**
 * Client-side mirror of the latest authoritative state. Besides what the server
 * sent, it only keeps local UI choices; rendering and UI read from here. Changes to
 * the world go out as operation primitives and come back as a new snapshot.
 */
export class GameStore {
  private state = INITIAL_STATE;
  private readonly listeners = new Set<() => void>();
  private readonly detach: (() => void)[];

  constructor(private readonly connection: GameConnection) {
    this.detach = [
      connection.onMessage((message) => this.apply(message)),
      // No result can arrive any more, so a pending action is dropped rather than left spinning.
      connection.onFailure((reason) => this.update({ connection: 'failed', error: reason, lastAction: null })),
    ];
    connection.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION });
  }

  getState = (): ClientState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Sends an operation primitive. The world changes only when the server's new state arrives. */
  act(action: Action): void {
    if (this.state.connection !== 'ready') return;
    this.connection.send({ type: 'action', action });
    this.update({ lastAction: { status: 'pending' } });
  }

  select(id: ResidentId | null): void {
    if (id !== this.state.selected) this.update({ selected: id });
  }

  dispose(): void {
    for (const detach of this.detach) detach();
    this.connection.close();
    this.listeners.clear();
  }

  private apply(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        if (message.protocolVersion !== PROTOCOL_VERSION) {
          this.fail(`protocol_mismatch: 服务端协议版本 ${message.protocolVersion}，客户端为 ${PROTOCOL_VERSION}`);
          return;
        }
        this.update({ connection: 'ready', error: null });
        return;
      case 'state': {
        const { selected } = this.state;
        const stillThere = message.world.residents.some((resident) => resident.id === selected);
        this.update({ world: message.world, selected: stillThere ? selected : null });
        return;
      }
      case 'action_result':
        this.update({
          lastAction: message.ok
            ? { status: 'accepted' }
            : { status: 'rejected', reason: `${message.code ?? 'rejected'}: ${message.message ?? ''}` },
        });
        return;
      case 'error': {
        const error = `${message.code}: ${message.message}`;
        // The server keeps the socket open, but nothing useful can follow a version mismatch.
        if (message.code === 'protocol_mismatch') this.fail(error);
        else {
          // An error answers the pending action instead of a result; the top bar shows why.
          const { lastAction } = this.state;
          this.update({ error, lastAction: lastAction?.status === 'pending' ? null : lastAction });
        }
        return;
      }
    }
  }

  private fail(error: string): void {
    this.update({ connection: 'failed', error, lastAction: null });
    this.connection.close();
  }

  private update(patch: Partial<ClientState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}
