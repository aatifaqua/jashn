/**
 * Shared by the generative routes: body validation (zod, then the core validator), building
 * the plan on the server, and turning any Gemini failure into the labelled fallback.
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
import type { AppEnv } from '../env.ts';
import { invalidRequest, problem, type FieldIssue } from '../middleware/errors.ts';

/** Sent with every generated answer; the UI shows it next to generated content. */
export const DISCLAIMER =
  'Costs and dates are planning estimates for India, not vendor quotes. Check details with your vendors and local authorities.';

/** What the generating routes need: the client (null without a key) and today. */
export interface RouteDeps {
  readonly gemini: GeminiClient | null;
  readonly today: () => number;
}

type Validated<T> =
  | { readonly ok: true; readonly body: T; readonly plan: Plan }
  | { readonly ok: false; readonly response: Response };

// Fixed wording: neither values nor unknown key names are echoed, so no attacker text is reflected.
function zodFields(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => {
    const parts = issue.path.map(String);
    if (parts[0] === 'input' && parts.length > 1) parts.shift();
    const field = parts.length === 0 ? 'body' : parts.join('.');
    return issue.code === 'unrecognized_keys'
      ? { field, code: 'unknown', message: 'Remove fields the API does not accept.' }
      : { field, code: 'invalid', message: `${field} is not valid.` };
  });
}

/** Validates the body like the form does, then builds the plan: a client's plan is never trusted. */
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

/** Generated output failed a guard; the caller serves the fallback instead. */
export class GuardRejectedError extends Error {
  override readonly name = 'GuardRejectedError';
}

/** Rejects output when any guard reported an issue (or an invented amount). */
export function assertClean(issues: readonly unknown[]): void {
  if (issues.length > 0) throw new GuardRejectedError(`${String(issues.length)} guard issue(s)`);
}

/**
 * Runs the Gemini path, or on no client, a spent client share or any failure, the fallback.
 * The reason for a fallback (error name and API status) goes to the log line.
 */
export async function sourced<T extends object>(
  c: Context<AppEnv>,
  gemini: GeminiClient | null,
  live: (client: GeminiClient) => Promise<T>,
  fallback: () => T,
): Promise<Sourced<T>> {
  if (gemini !== null) {
    if (c.var.takeShare?.() === false) {
      c.set('failure', { name: 'ClientShareSpent' });
    } else {
      try {
        return { ...(await live(gemini)), source: 'gemini' };
      } catch (error) {
        const name = error instanceof Error ? error.name : typeof error;
        const status = statusOf(error instanceof Error ? error.cause : undefined);
        c.set('failure', status === undefined ? { name } : { name, status });
      }
    }
  }
  return { ...fallback(), source: 'fallback' };
}

/** A generated answer with its source and the estimates disclaimer. */
export function sendSourced(c: Context<AppEnv>, result: { readonly source: Source }): Response {
  c.set('source', result.source);
  return c.json({ ...result, disclaimer: DISCLAIMER });
}
