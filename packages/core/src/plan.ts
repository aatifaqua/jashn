/**
 * Plan assembly and diff (design 6.8): one context, one pass of the rules, then each stage in
 * a fixed order, so a plan is a pure function of the input, the day and the profile.
 */
import { volunteersNeeded } from './attendance.ts';
import { planBudget } from './budget.ts';
import { deriveContext } from './context.ts';
import { canonicalKey, normaliseInput } from './input.ts';
import { deepFreeze } from './profiles/freeze.ts';
import { fireRules } from './rules.ts';
import { buildRunSheet } from './runsheet.ts';
import { buildTimeline, pinnedIds, topActions, type StageInput } from './timeline.ts';
import { buildPayments, buildVendors } from './vendors.ts';
import type { BudgetLine, EventInput, Plan, PlanDiff, Profile } from './types.ts';

/**
 * Plans kept for reuse. The browser rebuilds on every keystroke of the live summary and the
 * assistant preview builds the current and the patched plan, so a handful of recent entries
 * catches nearly every repeat while keeping memory flat on a long-running server.
 */
const CACHE_SIZE = 16;

interface Cached {
  readonly profile: Profile;
  readonly plan: Plan;
}

/** Insertion-ordered, so the first key is the least recently used. */
const cache = new Map<string, Cached>();

function assemble(input: EventInput, today: number, profile: Profile): Plan {
  const ctx = deriveContext(input, today, profile);
  const stage: StageInput = { profile, ctx, input, fired: fireRules(ctx, input) };
  const budget = planBudget(input, profile, ctx, stage.fired);
  const tasks = buildTimeline(stage);
  const vendors = buildVendors(stage, tasks);
  return {
    input,
    today,
    daysToGo: ctx.daysToGo,
    expected: ctx.expected,
    volunteers: volunteersNeeded(input.type, ctx.expected),
    budget: budget.lines,
    contingency: budget.contingency,
    feasibility: budget.feasibility,
    tasks,
    vendors,
    payments: buildPayments(vendors, budget.lines, ctx.eventDay),
    runSheet: buildRunSheet(stage),
    topActions: topActions(tasks, pinnedIds(stage.fired)),
    notices: stage.fired.flatMap((rule) => rule.effects.notices ?? []),
  };
}

/**
 * Builds the complete plan for a validated input (the output of validateInput) on `today`,
 * using the profile of the input's event type. The profile is passed in rather than looked up
 * so the browser can load just that type's tables on demand (loadProfile) while the server
 * passes getProfile(type). Plans are memoised on the canonical input key and deep-frozen,
 * because the same plan object is handed to every caller that asks for it.
 */
export function buildPlan(input: EventInput, today: number, profile: Profile): Plan {
  if (profile.type !== input.type) {
    throw new TypeError(`A ${input.type} needs the ${input.type} profile, not ${profile.type}.`);
  }
  const key = `${String(today)}|${canonicalKey(input)}`;
  const hit = cache.get(key);
  if (hit?.profile === profile) {
    cache.delete(key);
    cache.set(key, hit);
    return hit.plan;
  }
  const plan = deepFreeze(assemble(normaliseInput(input), today, profile));
  cache.set(key, { profile, plan });
  if (cache.size > CACHE_SIZE) {
    for (const oldest of cache.keys()) {
      cache.delete(oldest);
      break;
    }
  }
  return plan;
}

function lineAmounts(lines: readonly BudgetLine[]): Map<string, number> {
  return new Map(lines.map((line) => [line.category, line.amount]));
}

/**
 * The user-facing changes between two plans, shown before a patch is applied: headcount,
 * verdict, every budget line whose amount changes (a line missing on one side counts as zero,
 * in the order the lines appear, new lines last) and tasks that become late.
 */
export function diffPlans(before: Plan, after: Plan): PlanDiff {
  const was = lineAmounts(before.budget);
  const now = lineAmounts(after.budget);
  const categories = new Set([...was.keys(), ...now.keys()]);
  const budget = [...categories]
    .map((category) => ({
      category,
      before: was.get(category) ?? 0,
      after: now.get(category) ?? 0,
    }))
    .filter((line) => line.before !== line.after);
  const lateBefore = new Set(
    before.tasks.filter((task) => task.status === 'late').map((task) => task.id),
  );
  return {
    expected: { before: before.expected, after: after.expected },
    verdict: { before: before.feasibility.verdict, after: after.feasibility.verdict },
    budget,
    newlyLate: after.tasks.filter((task) => task.status === 'late' && !lateBefore.has(task.id)),
  };
}
