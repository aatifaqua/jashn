/**
 * Offline assistant (design section 7, /api/assist fallback): a deterministic intent parser
 * that either proposes a validated PlanPatch or answers a question from the plan's own data.
 */
import { applyPatch, validatePatch } from '../input.ts';
import { planSummary, type PlanSummary } from '../summary.ts';
import type { AssistReply, EventInput, Plan, PlanPatch } from '../types.ts';
import {
  budgetAnswer,
  firstAnswer,
  helpAnswer,
  lateAnswer,
  paymentAnswer,
  saveAnswer,
} from './answers.ts';
import { leadVerb, parseFunctions, parseNeeds, parseSetting } from './choices.ts';
import { formatCount, formatIsoDate, formatRupees } from '../text.ts';
import {
  figureClause,
  parseBudget,
  parseDate,
  parseGuests,
  parseStart,
  type ClauseParser,
} from './intents.ts';

/** Messages are capped like the API's, which also bounds the regex work per message. */
const MESSAGE_MAX = 500;
/** Clause breaks; commas inside figures such as 8,00,000 are not followed by a space. */
const CLAUSE = /\s+and\s+|\s+also\s+|;|\n|\.\s+|,\s+/;
const BOTH_SETTINGS = /\bindoors?\s+and\s+outdoors?\b|\boutdoors?\s+and\s+indoors?\b/g;

/** Parsers of figures and dates; they read each clause exactly as written. */
const FIGURE_PARSERS: readonly ClauseParser[] = Object.freeze([
  parseDate,
  parseGuests,
  parseBudget,
  parseStart,
]);
/** Parsers of choices; a clause without a verb borrows the previous clause's verb. */
const CHOICE_PARSERS: readonly ClauseParser[] = Object.freeze([
  parseNeeds,
  parseSetting,
  parseFunctions,
]);

/** Question patterns in priority order, each with the answer it gets. */
const QUESTIONS: readonly (readonly [RegExp, (summary: PlanSummary) => string])[] = Object.freeze([
  [/\b(?:late|overdue|behind|missed)\b/, lateAnswer],
  [/\b(?:enough|realistic|feasible|afford|per guest|verdict)\b/, budgetAnswer],
  [/\b(?:save|saving|savings|cheaper|cost|costs|trim|trims|over budget)\b/, saveAnswer],
  [/\b(?:pay|payment|payments|deposit|deposits|balance)\b/, paymentAnswer],
  [/\b(?:first|priority|priorities|next|book|start|begin|urgent)\b/, firstAnswer],
  [/\bbudget\b/, budgetAnswer],
]);

/**
 * Reads every change the message asks for, clause by clause, into one patch. Later clauses
 * build on earlier ones, so "add jain and remove alcohol" keeps both needs. A figure borrows
 * the previous change word only for a relative "by N" ("cut guests by 50 and budget by 10%");
 * otherwise it is read as written, so "add 20 guests and budget 8 lakh" sets the budget.
 */
export function parseChanges(message: string, plan: Plan): PlanPatch {
  const text = message.slice(0, MESSAGE_MAX).toLowerCase().replace(BOTH_SETTINGS, 'mixed');
  let patch: PlanPatch = {};
  let verb = '';
  let change = '';
  for (const clause of text.split(CLAUSE)) {
    const own = leadVerb(clause);
    verb = own ?? verb;
    const choiceClause = own === undefined ? `${verb} ${clause}` : clause;
    const figures = figureClause(clause, change);
    change = figures.word;
    const base = applyPatch(plan.input, patch);
    for (const parse of FIGURE_PARSERS) patch = { ...patch, ...parse(figures.clause, plan, base) };
    for (const parse of CHOICE_PARSERS) patch = { ...patch, ...parse(choiceClause, plan, base) };
  }
  return patch;
}

function listChange(label: string, before: readonly string[], after: readonly string[]): string {
  const added = after.filter((id) => !before.includes(id)).map((id) => `+${id}`);
  const removed = before.filter((id) => !after.includes(id)).map((id) => `−${id}`);
  return `${label} ${[...added, ...removed].join(', ')}`;
}

/** One phrase per field that actually changes, e.g. "guests 300 → 180". */
function describe(before: EventInput, after: EventInput): string[] {
  const out: string[] = [];
  const change = <T>(label: string, a: T, b: T, show: (value: T) => string): void => {
    if (a !== b) out.push(`${label} ${show(a)} → ${show(b)}`);
  };
  change('guests', before.invited, after.invited, formatCount);
  change('budget', before.budget, after.budget, formatRupees);
  change('date', before.date, after.date, formatIsoDate);
  change('start', before.startTime, after.startTime, String);
  change('setting', before.setting, after.setting, String);
  // Normalised lists are sorted, so equal choices join to equal strings.
  if (before.constraints.join() !== after.constraints.join()) {
    out.push(listChange('needs', before.constraints, after.constraints));
  }
  if (before.functions.join() !== after.functions.join()) {
    out.push(listChange('functions', before.functions, after.functions));
  }
  return out;
}

function answer(message: string, plan: Plan): string {
  const text = message.slice(0, MESSAGE_MAX).toLowerCase();
  const match = QUESTIONS.find(([pattern]) => pattern.test(text));
  return (match?.[1] ?? helpAnswer)(planSummary(plan));
}

/**
 * Answers a message offline from the plan summary, the same facts Gemini sees. A requested change is validated exactly like the form; when it
 * passes, the reply describes it and carries the patch for the user to preview and confirm.
 * A change the form would reject gets the validator's own message and no patch.
 */
export function assistOffline(message: string, plan: Plan): AssistReply {
  const patch = parseChanges(message, plan);
  if (Object.keys(patch).length === 0) return { reply: answer(message, plan) };
  const result = validatePatch(patch, plan.input, plan.today);
  if (!result.ok) {
    const reasons = result.errors.map((error) => error.message).join(' ');
    return { reply: `I could not make that change. ${reasons}` };
  }
  const changes = describe(plan.input, result.value);
  if (changes.length === 0) return { reply: 'Your plan already has that.' };
  return {
    reply: `Proposed change: ${changes.join('; ')}. Preview it and apply it if it looks right.`,
    patch: result.patch,
  };
}
