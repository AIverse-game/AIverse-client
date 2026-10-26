import { z } from 'zod';
import { ZONE_IDS } from './ids';

// Decisions come from players' models and are untrusted: everything is validated here
// before the engine sees it. Rule legality (location, stamina, materials) is the engine's job.

export const NOTE_MAX_LENGTH = 100;
export const MEMORY_MAX_LENGTH = 300;

export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), to: z.enum(ZONE_IDS) }),
  z.object({ type: z.literal('gather') }),
  z.object({ type: z.literal('craft') }),
  z.object({ type: z.literal('rest'), useBread: z.boolean() }),
  z.object({ type: z.literal('wait') }),
]);

export type Action = z.infer<typeof actionSchema>;
export type ActionType = Action['type'];

export const decisionSchema = z.object({
  action: actionSchema,
  note: z.string().max(NOTE_MAX_LENGTH).optional(),
  memory: z.string().max(MEMORY_MAX_LENGTH).optional(),
});

export type Decision = z.infer<typeof decisionSchema>;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const ERROR_MAX_LENGTH = 200;

export function formatIssues(error: z.ZodError): string {
  const text = error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  return text.length > ERROR_MAX_LENGTH ? `${text.slice(0, ERROR_MAX_LENGTH - 1)}…` : text;
}

export function parseDecision(input: unknown): ParseResult<Decision> {
  const result = decisionSchema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: formatIssues(result.error) };
}
