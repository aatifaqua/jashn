/**
 * POST /api/assist: answers a question from the plan summary, or turns a change request into
 * a validated PlanPatch through Gemini function calling. Never cached: turns are conversational.
 */
import {
  assistOffline,
  buildPlan,
  diffPlans,
  formatCount,
  getProfile,
  guardReply,
  validatePatch,
  type AssistReply,
  type Language,
  type Plan,
  type PlanDiff,
} from '@jashn/core';
import type { FunctionCall } from '@google/genai';
import type { Handler } from 'hono';
import type { GeminiClient } from '../ai/gemini.ts';
import { assistContents, assistSystem } from '../ai/prompts.ts';
import { assistRequestSchema } from '../ai/schemas.ts';
import { ASSIST_TOOLS, UPDATE_EVENT } from '../ai/tools.ts';
import type { AppEnv } from '../env.ts';
import { assertClean, GuardRejectedError, readEvent, sendSourced, sourced } from './common.ts';

/** What the assistant route needs. */
export interface AssistDeps {
  readonly gemini: GeminiClient | null;
  readonly today: () => number;
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/**
 * The Hindi reply for a change the model proposed without words. The preview beside it lists
 * every changed figure, so one fixed sentence keeps the reply in the user's language without
 * translating engine output.
 */
const PROPOSAL_HI =
  'मैंने यह बदलाव सुझाया है। नीचे पहले और बाद का अंतर देखें, और ठीक लगे तो इसे लागू करें।';

/**
 * A reply for a proposed change when the model sent only the function call. It is built from
 * the plan diff, so every figure in it was computed by the engine, and it follows the
 * language chosen for generated text.
 */
export function describeDiff(diff: PlanDiff, language: Language = 'en'): string {
  if (language === 'hi') return PROPOSAL_HI;
  const parts: string[] = [];
  const { expected, verdict, budget, newlyLate } = diff;
  if (expected.before !== expected.after) {
    parts.push(`expected guests ${formatCount(expected.before)} → ${formatCount(expected.after)}`);
  }
  if (verdict.before !== verdict.after) {
    parts.push(`budget verdict ${verdict.before} → ${verdict.after}`);
  }
  if (budget.length > 0)
    parts.push(plural(budget.length, 'budget line changes', 'budget lines change'));
  if (newlyLate.length > 0)
    parts.push(plural(newlyLate.length, 'task becomes late', 'tasks become late'));
  const summary = parts.length > 0 ? `: ${parts.join('; ')}` : '';
  return `Here is the proposed change${summary}. Preview it and apply it if it looks right.`;
}

/**
 * Validates a function call exactly like a form submission and rebuilds the plan. The model's
 * words are kept only when they pass the reply guards against the current plan and the patch,
 * the same check the browser repeats; otherwise the reply is built from the plan diff, so a
 * valid change is never lost to its wording and the browser never rejects what was sent.
 */
export function proposal(call: FunctionCall, text: string, plan: Plan): AssistReply {
  if (call.name !== UPDATE_EVENT) throw new GuardRejectedError('unknown tool');
  const result = validatePatch(call.args, plan.input, plan.today);
  if (!result.ok) throw new GuardRejectedError('patch rejected by validation');
  const after = buildPlan(result.value, plan.today, getProfile(result.value.type));
  const usable = text !== '' && guardReply(text, plan, result.patch).length === 0;
  const reply = usable ? text : describeDiff(diffPlans(plan, after), plan.input.language);
  return { reply, patch: result.patch };
}

/** One assistant turn through Gemini; the first function call, if any, is the proposal. */
export async function liveAssist(
  gemini: GeminiClient,
  plan: Plan,
  body: { readonly message: string; readonly history: Parameters<typeof assistContents>[0] },
): Promise<AssistReply> {
  const generation = await gemini.generate({
    endpoint: 'assist',
    systemInstruction: assistSystem(plan),
    contents: assistContents(body.history, body.message),
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
export function assistHandler(deps: AssistDeps): Handler<AppEnv> {
  return async (c) => {
    const request = await readEvent(c, assistRequestSchema, deps.today());
    if (!request.ok) return request.response;
    const { plan, body } = request;
    const result = await sourced<AssistReply>(
      deps.gemini,
      (gemini) => liveAssist(gemini, plan, body),
      () => assistOffline(body.message, plan),
    );
    return sendSourced(c, result);
  };
}
