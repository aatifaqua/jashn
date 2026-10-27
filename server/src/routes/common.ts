/**
 * What the three generative routes share: reading and validating the body (zod, then the
 * core validator), building the plan on the server, and wrapping Gemini so any failure
 * becomes the deterministic fallback with the source labelled.
 */
import {
  buildPlan,
  getProfile,
  validateInput,
  type Plan,
  type Source,
  type Sourced,
} from '@jashn/core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { statusOf, type GeminiClient } from '../ai/gemini.ts';
import type { AppEnv, Failure } from '../env.ts';
import { invalidRequest, problem, type FieldIssue } from '../middleware/errors.ts';

/** Sent with every generated answer; the UI shows it next to generated content. */
export const DISCLAIMER =
  'Costs and dates are planning estimates for India, not vendor quotes. Check details with your vendors and local authorities.';

/** A validated request: its body and the plan the server derived from the input. */
export type Validated<T> =
  | { readonly ok: true; readonly body: T; readonly plan: Plan }
  | { readonly ok: false; readonly response: Response };

/** Field paths name the EventInput field directly ("budget", not "input.budget"). */
function fieldOf(path: readonly PropertyKey[]): string {
  const parts = path.map(String);
  if (parts[0] === 'input' && parts.length > 1) parts.shift();
  return parts.length === 0 ? 'body' : parts.join('.');
}

/**
 * Converts zod issues to field issues with fixed wording. Neither values nor unknown key
 * names are echoed back, so a response never reflects attacker-chosen text.
 */
export function zodFields(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => {
    const field = fieldOf(issue.path);
    return issue.code === 'unrecognized_keys'
      ? { field, code: 'unknown', message: 'Remove fields the API does not accept.' }
      : { field, code: 'invalid', message: `${field} is not valid.` };
  });
}

/**
 * Parses the JSON body against a strict schema, then validates the event with the core (the
 * same rules as the form), then builds the plan. The server never trusts a client's plan.
 */
export async function readEvent<T extends { readonly input: unknown }>(
  c: Context<AppEnv>,
  schema: z.ZodType<T>,
  today: number,
): Promise<Validated<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return {
      ok: false,
      response: problem(c, 400, 'invalid-json', 'The request body is not valid JSON.'),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, response: invalidRequest(c, zodFields(parsed.error)) };
  const result = validateInput(parsed.data.input, today);
  if (!result.ok) return { ok: false, response: invalidRequest(c, result.errors) };
  const plan = buildPlan(result.value, today, getProfile(result.value.type));
  return { ok: true, body: parsed.data, plan };
}

/** Thrown when generated output fails a guard; the caller serves the fallback instead. */
export class GuardRejectedError extends Error {
  override readonly name = 'GuardRejectedError';
}

/** Rejects output when any guard reported an issue (or an invented amount). */
export function assertClean(issues: readonly unknown[]): void {
  if (issues.length > 0) throw new GuardRejectedError(`${String(issues.length)} guard issue(s)`);
}

/**
 * Why the Gemini path failed, for the log: the error's class name and the HTTP status of the
 * underlying API error, if any. A revoked key (403) or a wrong model id (404) then shows up in
 * the logs instead of as a silent, permanent fallback; a bug (a TypeError) shows its own name.
 */
export function failureOf(error: unknown): Failure {
  const name = error instanceof Error ? error.name : typeof error;
  const status = statusOf(error instanceof Error ? error.cause : undefined);
  return status === undefined ? { name } : { name, status };
}

/**
 * Runs the Gemini path and labels the result; with no client, or on any failure (timeout,
 * chain exhausted, budget spent, schema-invalid JSON, guard rejection), it labels and returns
 * the fallback. The user always gets an answer, the label says which kind, and the reason for
 * a fallback goes to the request's log line.
 */
export async function sourced<T extends object>(
  c: Context<AppEnv>,
  gemini: GeminiClient | null,
  live: (client: GeminiClient) => Promise<T>,
  fallback: () => T,
): Promise<Sourced<T>> {
  if (gemini !== null && takeShare(c)) {
    try {
      return { ...(await live(gemini)), source: 'gemini' };
    } catch (error) {
      c.set('failure', failureOf(error));
    }
  }
  return { ...fallback(), source: 'fallback' };
}

/** True while the client has Gemini share left this hour (always, without the middleware). */
function takeShare(c: Context<AppEnv>): boolean {
  const take = c.var.takeShare;
  if (take === undefined || take()) return true;
  c.set('failure', { name: 'ClientShareSpent' });
  return false;
}

/** Sends a generated answer with its source and the estimates disclaimer. */
export function sendSourced(c: Context<AppEnv>, result: { readonly source: Source }): Response {
  c.set('source', result.source);
  return c.json({ ...result, disclaimer: DISCLAIMER });
}
