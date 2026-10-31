/**
 * Offline assistant: answers questions from the plan's data. It never changes the
 * plan, so a bare change request is pointed to the form.
 */
import { ASSIST_LIMITS } from '../fields.ts';
import { planSummary, type PlanSummary } from '../summary.ts';
import type { AssistReply } from '../engine-types.ts';
import type { Plan } from '../types.ts';
import {
  budgetAnswer,
  firstAnswer,
  helpAnswer,
  lateAnswer,
  paymentAnswer,
  saveAnswer,
} from './answers.ts';

/** A question rather than an instruction: "is 20 lakh enough?", "who does the make-up?". */
const QUESTION =
  /\?\s*$|^\s*(?:is|are|can|could|will|would|should|what|when|how|who|which|where|why|do|does)\b/;
/** Words that ask for a change to the plan: "cut guests by 20", "move to Saturday". */
const CHANGE =
  /\b(?:cut|reduce|lower|raise|increase|add|remove|drop|move|change|switch|shift|make|set|invite|postpone)\b/;

/** Also served live when a model reply is rejected, so it must not assume the assistant is offline. */
export const CHANGE_REPLY =
  'I could not make that change just now. ' +
  'Try again, or use Edit details to change the plan yourself.';

/** Topics answered even when the message also names a change: "ways to cut costs". */
const QUESTIONS: readonly (readonly [RegExp, (summary: PlanSummary) => string])[] = Object.freeze([
  [/\b(?:late|overdue|behind|missed)\b/, lateAnswer],
  [/\b(?:enough|realistic|feasible|afford|per guest|verdict)\b/, budgetAnswer],
  [/\b(?:save|saving|savings|cheaper|cost|costs|trim|trims|over budget)\b/, saveAnswer],
  [/\b(?:pay|payment|payments|deposit|deposits|balance)\b/, paymentAnswer],
  // "next Saturday" and "start time" name a date or field to change, not the next task.
  [
    /\b(?:first|priority|priorities|book|begin|urgent|start(?! time)|next(?! (?:week|month|[a-z]+day)))\b/,
    firstAnswer,
  ],
]);
/** Too broad to outrank a change: "raise the budget to 25 lakh" is a change, not a question. */
const BUDGET = /\bbudget\b/;

/** Answers from the plan summary, the same facts Gemini sees; never proposes a patch. */
export function assistOffline(message: string, plan: Plan): AssistReply {
  // Messages are capped like the API's, which also bounds the regex work per message.
  const text = message.slice(0, ASSIST_LIMITS.message).toLowerCase();
  const match = QUESTIONS.find(([pattern]) => pattern.test(text));
  if (match !== undefined) return { reply: match[1](planSummary(plan)) };
  if (!QUESTION.test(text) && CHANGE.test(text)) return { reply: CHANGE_REPLY };
  return { reply: (BUDGET.test(text) ? budgetAnswer : helpAnswer)(planSummary(plan)) };
}
