/**
 * POST /api/assist: answers from the plan summary, or turns a change request into a validated
 * PlanPatch through function calling. Never cached: turns are conversational.
 */
import {
  assistOffline,
  buildPlan,
  countWord,
  diffPlans,
  formatCount,
  guardReply,
  validatePatch,
  type AssistReply,
  type Plan,
  type PlanDiff,
} from '@jashn/core';
import { getProfile } from '@jashn/core/server';
import type { FunctionCall } from '@google/genai';
import type { Handler } from 'hono';
import type { GeminiClient } from '../ai/gemini.ts';
import { assistContents, assistSystem } from '../ai/prompts.ts';
import { assistRequestSchema } from '../ai/schemas.ts';
import { ASSIST_TOOLS, UPDATE_EVENT } from '../ai/tools.ts';
import type { AppEnv } from '../env.ts';
import {
  assertClean,
  GuardRejectedError,
  readEvent,
  sendSourced,
  sourced,
  type RouteDeps,
} from './common.ts';

/** A reply built from the plan diff, so every figure in it was computed by the engine. */
export function describeDiff(diff: PlanDiff): string {
  const parts: string[] = [];
  const { expected, verdict, budget, newlyLate } = diff;
  if (expected.before !== expected.after) {
    parts.push(`expected guests ${formatCount(expected.before)} → ${formatCount(expected.after)}`);
  }
  if (verdict.before !== verdict.after) {
    parts.push(`budget verdict ${verdict.before} → ${verdict.after}`);
  }
  if (budget.length > 0)
    parts.push(countWord(budget.length, 'budget line changes', 'budget lines change'));
  if (newlyLate.length > 0)
    parts.push(countWord(newlyLate.length, 'task becomes late', 'tasks become late'));
  const summary = parts.length > 0 ? `: ${parts.join('; ')}` : '';
  return `Here is the proposed change${summary}. Preview it and apply it if it looks right.`;
}

/**
 * Validates a function call like a form submission. The model's words are kept only if they
 * pass the same reply guards the browser repeats; otherwise the reply comes from the plan diff,
 * so a valid change is never lost to its wording.
 */
function proposal(call: FunctionCall, text: string, plan: Plan): AssistReply {
  if (call.name !== UPDATE_EVENT) throw new GuardRejectedError('unknown tool');
  const result = validatePatch(call.args, plan.input, plan.today);
  if (!result.ok) throw new GuardRejectedError('patch rejected by validation');
  const after = buildPlan(result.value, plan.today, getProfile(result.value.type));
  const usable = text !== '' && guardReply(text, plan, result.patch).length === 0;
  const reply = usable ? text : describeDiff(diffPlans(plan, after));
  return { reply, patch: result.patch };
}

/** One assistant turn; the first function call, if any, is the proposal. */
export async function liveAssist(
  gemini: GeminiClient,
  plan: Plan,
  body: { readonly message: string; readonly history: Parameters<typeof assistContents>[1] },
): Promise<AssistReply> {
  const generation = await gemini.generate({
    endpoint: 'assist',
    systemInstruction: assistSystem(plan),
    contents: assistContents(plan.input.note, body.history, body.message),
    tools: [...ASSIST_TOOLS],
  });
  const text = generation.text.trim();
  const [call] = generation.functionCalls;
  if (call !== undefined) return proposal(call, text, plan);
  if (text === '') throw new GuardRejectedError('empty reply');
  assertClean(guardReply(text, plan));
  return { reply: text };
}

/** Handler for POST /api/assist. */
export function assistHandler(deps: RouteDeps): Handler<AppEnv> {
  return async (c) => {
    const request = await readEvent(c, assistRequestSchema, deps.today());
    if (!request.ok) return request.response;
    const { plan, body } = request;
    const result = await sourced<AssistReply>(
      c,
      deps.gemini,
      (gemini) => liveAssist(gemini, plan, body),
      () => assistOffline(body.message, plan),
    );
    return sendSourced(c, result);
  };
}
