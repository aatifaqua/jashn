/**
 * Budget allocation (design 6.4): base weights, style deltas, rule deltas and priorities,
 * renormalised and rounded to ₹100 so the lines plus contingency equal the budget exactly.
 */
import { assessFeasibility } from './feasibility.ts';
import { ROUNDING_UNIT } from './money.ts';
import type { FiredRule } from './rules.ts';
import type {
  BudgetEffect,
  BudgetLine,
  EventContext,
  EventInput,
  Feasibility,
  FunctionAmount,
  Profile,
  Reason,
} from './types.ts';

/** Contingency without the budget-strict rule, as a fraction of the budget. */
export const DEFAULT_CONTINGENCY = 0.1;
/** Multiplier on each category the user picks as a priority. */
export const PRIORITY_FACTOR = 1.25;
/** Lines split across wedding functions by guest share. */
const SPLIT_CATEGORIES: ReadonlySet<string> = new Set(['catering', 'decor']);

/** Allocated lines and the reserve; lines plus contingency equal the budget exactly. */
export interface BudgetAllocation {
  readonly lines: readonly BudgetLine[];
  readonly contingency: number;
}

/** Allocation plus its feasibility verdict and trims. */
export interface BudgetResult extends BudgetAllocation {
  readonly feasibility: Feasibility;
}

interface Weight {
  readonly category: string;
  weight: number;
  readonly reasons: Reason[];
}

/** One item's whole-unit share from apportion. */
export interface Portion<T> {
  readonly item: T;
  units: number;
}

/**
 * Integer apportionment by the largest-remainder method: shares of `total` units proportional
 * to each item's weight, summing to `total` exactly. Ties go to the earlier item so results
 * are stable. With no positive weight, every item gets zero.
 */
export function apportion<T>(
  total: number,
  items: readonly T[],
  weightOf: (item: T) => number,
): Portion<T>[] {
  const sum = items.reduce((acc, item) => acc + weightOf(item), 0);
  if (sum <= 0) return items.map((item) => ({ item, units: 0 }));
  let left = total;
  const parts = items.map((item, index) => {
    const quota = (total * weightOf(item)) / sum;
    const units = Math.floor(quota);
    left -= units;
    return { item, units, index, remainder: quota - units };
  });
  const byRemainder = [...parts].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const part of byRemainder.slice(0, left)) part.units += 1;
  return parts.map(({ item, units }) => ({ item, units }));
}

/** Contingency share: the largest any fired rule asks for, else the default 10 %. */
export function contingencyShare(fired: readonly FiredRule[]): number {
  let share = DEFAULT_CONTINGENCY;
  for (const rule of fired) share = Math.max(share, rule.effects.contingency ?? 0);
  return share;
}

function signed(points: number): string {
  return points > 0 ? `+${String(points)}` : String(points);
}

function adjust(
  table: Map<string, Weight>,
  category: string,
  points: number,
  reason: Reason,
): void {
  const entry = table.get(category);
  if (entry === undefined) return;
  entry.weight = Math.max(0, entry.weight + points);
  entry.reasons.push(reason);
}

/** Applies one rule effect; an effect naming a category this profile lacks is ignored. */
function applyEffect(table: Map<string, Weight>, effect: BudgetEffect, reason: Reason): void {
  if (effect.kind === 'add') {
    adjust(table, effect.category, effect.points, reason);
    return;
  }
  if (effect.kind === 'remove') {
    adjust(table, effect.category, -Infinity, reason);
    return;
  }
  const from = table.get(effect.from);
  const to = table.get(effect.to);
  if (from === undefined || to === undefined) return;
  const moved = from.weight * effect.fraction;
  from.weight -= moved;
  to.weight += moved;
  from.reasons.push(reason);
  to.reasons.push(reason);
}

function addStyleDeltas(table: Map<string, Weight>, input: EventInput, profile: Profile): void {
  const style = profile.styles.find((def) => def.id === input.style);
  if (style === undefined) return;
  for (const { category, points } of style.deltas) {
    const text = `${style.label} style: ${signed(points)} points.`;
    adjust(table, category, points, { code: 'style', text });
  }
}

function addPriorities(table: Map<string, Weight>, input: EventInput, profile: Profile): void {
  for (const { id, label } of profile.categories) {
    const entry = table.get(id);
    if (entry === undefined || !input.priorities.includes(id)) continue;
    const text = `You chose ${label.toLowerCase()} as a priority: ×${String(PRIORITY_FACTOR)}.`;
    entry.weight *= PRIORITY_FACTOR;
    entry.reasons.push({ code: 'priority', text });
  }
}

/** Weights after base, style, rule and priority steps (design 6.4 steps 1 to 3). */
function weighCategories(
  input: EventInput,
  profile: Profile,
  fired: readonly FiredRule[],
): Map<string, Weight> {
  const table = new Map<string, Weight>();
  const kind = profile.label.toLowerCase();
  for (const { id, label, weight } of profile.categories) {
    const text = `${label}: ${String(weight)} of 90 base points for a ${kind}.`;
    table.set(id, { category: id, weight, reasons: weight > 0 ? [{ code: 'base', text }] : [] });
  }
  addStyleDeltas(table, input, profile);
  for (const rule of fired) {
    for (const effect of rule.effects.budget ?? []) applyEffect(table, effect, rule.reason);
  }
  addPriorities(table, input, profile);
  return table;
}

/** Splits a line across the chosen wedding functions by their guest share. */
function splitByFunction(amount: number, input: EventInput, profile: Profile): FunctionAmount[] {
  const chosen = profile.functions.filter((def) => input.functions.includes(def.id));
  return apportion(amount / ROUNDING_UNIT, chosen, (def) => def.guestShare).map(
    ({ item, units }) => ({ functionId: item.id, amount: units * ROUNDING_UNIT }),
  );
}

/**
 * Allocates the budget across the profile's categories. Weights are renormalised to the
 * non-contingency share and apportioned in ₹100 units in one pass; the contingency takes the
 * rupees left over, so lines plus contingency always equal the budget exactly. Categories
 * whose weight ends at zero (an unfunded or removed bar) get no line.
 */
export function allocateBudget(
  input: EventInput,
  profile: Profile,
  fired: readonly FiredRule[],
): BudgetAllocation {
  const funded = [...weighCategories(input, profile, fired).values()].filter(
    (entry) => entry.weight > 0,
  );
  const reservePercent = Math.round(contingencyShare(fired) * 100);
  const spendUnits = Math.floor((input.budget * (100 - reservePercent)) / (100 * ROUNDING_UNIT));
  const split = input.type === 'wedding' && input.functions.length > 1;
  const lines = apportion(spendUnits, funded, (entry) => entry.weight).map(
    ({ item, units }): BudgetLine => {
      const amount = units * ROUNDING_UNIT;
      const { category, reasons } = item;
      const line = { category, amount, share: amount / input.budget, reasons };
      if (!split || !SPLIT_CATEGORIES.has(category)) return line;
      return { ...line, perFunction: splitByFunction(amount, input, profile) };
    },
  );
  return { lines, contingency: input.budget - spendUnits * ROUNDING_UNIT };
}

/**
 * Allocation and feasibility for one plan. `fired` is the output of fireRules for the same
 * context, so the rules are evaluated once per plan.
 */
export function planBudget(
  input: EventInput,
  profile: Profile,
  ctx: EventContext,
  fired: readonly FiredRule[],
): BudgetResult {
  const allocation = allocateBudget(input, profile, fired);
  const alwaysTrim = fired.some((rule) => rule.effects.alwaysTrim === true);
  const feasibility = assessFeasibility(input, profile, ctx, {
    lines: allocation.lines,
    alwaysTrim,
  });
  return { ...allocation, feasibility };
}
