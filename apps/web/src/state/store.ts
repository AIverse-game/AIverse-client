import { PROTOCOL_VERSION, type ServerMessage, type WorldView } from '@aiverse/protocol';
import type { GameConnection } from '../net/connection';

export interface ClientState {
  connection: 'connecting' | 'ready' | 'failed';
  world: WorldView | null;
  error: string | null;
}

const INITIAL_STATE: ClientState = { connection: 'connecting', world: null, error: null };

/**
 * Client-side mirror of the latest authoritative state. It only stores what the
 * server sent; rendering and UI read from here.
 */
export class GameStore {
  private state = INITIAL_STATE;
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
      case 'state':
        this.update({ world: message.world });
        return;
      case 'error': {
        const error = `${message.code}: ${message.message}`;
        // The server keeps the socket open, but nothing useful can follow a version mismatch.
        if (message.code === 'protocol_mismatch') this.fail(error);
        else this.update({ error });
        return;
      }
    }
  }

  private fail(error: string): void {
    this.update({ connection: 'failed', error });
    this.connection.close();
  }

  private update(patch: Partial<ClientState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}
