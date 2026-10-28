import { z } from 'zod';
import type { Action } from './actions';
import { worldViewSchema } from './view';

/** Bump together with PROTOCOL_VERSION in the Python server on incompatible changes. */
export const PROTOCOL_VERSION = 5;

// Client -> authority. Validated by the server on arrival.
export type ClientMessage =
  | { type: 'hello'; protocolVersion: number }
  /** Allowed only after `welcome`. */
  | { type: 'action'; action: Action };

// Authority -> client. Every message is a JSON text frame; the client validates it
// because the server is a separate codebase that can fall out of step.
export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('welcome'), protocolVersion: z.number().int() }),
  z.object({ type: z.literal('state'), world: worldViewSchema }),
  // Reply to the sender's `action`. On success the new world follows as a `state` sent to
  // every connection; `code` and `message` explain a rejection.
  z.object({
    type: z.literal('action_result'),
    ok: z.boolean(),
    code: z.string().optional(),
    message: z.string().optional(),
  }),
  // Codes are open-ended so a newer server's errors still reach the user.
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const ERROR_MAX_LENGTH = 200;

function formatIssues(error: z.ZodError): string {
  const text = error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  return text.length > ERROR_MAX_LENGTH ? `${text.slice(0, ERROR_MAX_LENGTH - 1)}…` : text;
}

export function parseServerMessage(input: unknown): ParseResult<ServerMessage> {
  const result = serverMessageSchema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: formatIssues(result.error) };
}
