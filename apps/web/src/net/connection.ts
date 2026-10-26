import type { ClientMessage, ServerMessage } from '@aiverse/protocol';

/**
 * A link to the authority. The rest of the client only knows this interface, so the
 * transport can change without touching state, rendering or UI code.
 */
export interface GameConnection {
  send(message: ClientMessage): void;
  onMessage(listener: (message: ServerMessage) => void): () => void;
  /** The link broke or the authority could not be reached; no further messages are expected. */
  onFailure(listener: (reason: string) => void): () => void;
  close(): void;
}
