import { z } from 'zod';
import { formatIssues, type ParseResult } from './decision';
import type { PlayerId } from './ids';
import type { AgentStatus, GameEvent, GamePhase, WorldView } from './view';

export const PROTOCOL_VERSION = 1;

// Client -> authority. Untrusted, so validated on arrival.
export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), protocolVersion: z.number().int() }),
  z.object({ type: z.literal('start') }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export function parseClientMessage(input: unknown): ParseResult<ClientMessage> {
  const result = clientMessageSchema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: formatIssues(result.error) };
}

export type ErrorCode = 'bad_message' | 'protocol_mismatch' | 'not_ready' | 'already_started';

// Authority -> client. Every message must survive a JSON round trip.
export type ServerMessage =
  | { type: 'welcome'; protocolVersion: number; viewerId: PlayerId | null; roundDurationMs: number }
  | {
      type: 'state';
      phase: GamePhase;
      world: WorldView;
      /** Visible events from the most recently resolved round. */
      events: GameEvent[];
      /** Decision status of the viewer's own agent; null for spectators. */
      agent: AgentStatus | null;
    }
  | { type: 'error'; code: ErrorCode; message: string };
