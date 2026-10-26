import type { ClientMessage, ServerMessage } from '@aiverse/protocol';

/**
 * A link to the authority. The rest of the client only knows this interface, so the
 * in-browser local server can later be swapped for a WebSocket to a real server.
 */
export interface GameConnection {
  send(message: ClientMessage): void;
  onMessage(listener: (message: ServerMessage) => void): () => void;
  /** The link broke or the authority could not run; no further messages are expected. */
  onFailure(listener: (reason: string) => void): () => void;
  close(): void;
}
