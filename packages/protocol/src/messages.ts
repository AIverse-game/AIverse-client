import { z } from 'zod';
import type { Action } from './actions';
import { worldViewSchema, type ResidentId } from './view';

/** Bump together with PROTOCOL_VERSION in the Python server on incompatible changes. */
export const PROTOCOL_VERSION = 21;

/**
 * Where and what a language model is asked: an OpenAI-compatible chat completions API at
 * `baseUrl` (to which `/chat/completions` is added), the API key and the model. Blank or left
 * out means not given, which is fine for those the server's config overrides.
 */
export interface LLMSettings {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export type LLMSettingName = keyof LLMSettings;

// Client -> authority. Validated by the server on arrival.
export type ClientMessage =
  | { type: 'hello'; protocolVersion: number }
  /**
   * Allowed only after `welcome`. Choose whose whispers, offers, contracts and exchange orders this
   * connection's states carry: the resident's, or none for null. The server answers with a `state`.
   */
  | { type: 'view_as'; residentId: ResidentId | null }
  /** Allowed only after `welcome`. */
  | { type: 'action'; action: Action }
  /**
   * Allowed only after `welcome`. Hand the resident to a language model, replacing any agent
   * driving them; the server answers with `agent_result`. The key goes to the server, which
   * uses it only to ask the model.
   */
  | { type: 'start_agent'; residentId: ResidentId; llm: LLMSettings; strategy?: string }
  /** Allowed only after `welcome`. Stop the agent driving the resident, if any. */
  | { type: 'stop_agent'; residentId: ResidentId };

// Authority -> client. Every message is a JSON text frame; the client validates it
// because the server is a separate codebase that can fall out of step.
export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('welcome'),
    protocolVersion: z.number().int(),
    /**
     * Language model settings the server's config fixes for every agent, so pages need not ask
     * for them; only which ones, never their values. Open-ended so a newer server still connects.
     */
    llmOverrides: z.array(z.string()).default([]),
  }),
  z.object({ type: z.literal('state'), world: worldViewSchema }),
  // Reply to the sender's `action`. On success the new world follows as a `state` sent to
  // every connection; `code` and `message` explain a rejection.
  z.object({
    type: z.literal('action_result'),
    ok: z.boolean(),
    code: z.string().optional(),
    message: z.string().optional(),
  }),
  // Reply to the sender's `start_agent` or `stop_agent` for `residentId`. On success every
  // connection receives a `state` showing who drives the resident; `code` and `message` explain a
  // rejection.
  z.object({
    type: z.literal('agent_result'),
    residentId: z.string(),
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
