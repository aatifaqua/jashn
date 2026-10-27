/** Vendor checklist, questions and payment schedule (design section 6.6). */
import { applies } from './applies.ts';
import { toIso } from './days.ts';
import { ROUNDING_UNIT, roundRupees } from './money.ts';
import type { StageInput } from './timeline.ts';
import type { BudgetLine, Payment, Reason, Task, VendorItem, VendorTemplate } from './types.ts';

/** Balances fall due this many days before the event. */
const BALANCE_LEAD_DAYS = 7;
/** On the same day a deposit is listed before a balance. */
const KIND_RANK: Readonly<Record<Payment['kind'], number>> = Object.freeze({
  deposit: 0,
  balance: 1,
});

/** Questions and reasons that fired rules add to one vendor. */
interface Extra {
  readonly questions: string[];
  readonly reasons: Reason[];
}

const NO_EXTRA: Extra = Object.freeze({ questions: [], reasons: [] });

function ruleExtras(stage: StageInput): Map<string, Extra> {
  const extras = new Map<string, Extra>();
  for (const rule of stage.fired) {
    const questions = rule.effects.questions ?? [];
    if (questions.length === 0) continue;
    const { reason } = rule;
    for (const { vendorId, text } of questions) {
      const extra = extras.get(vendorId) ?? { questions: [], reasons: [] };
      extra.questions.push(text);
      if (!extra.reasons.some((r) => r.code === reason.code)) extra.reasons.push(reason);
      extras.set(vendorId, extra);
    }
  }
  return extras;
}

function removedVendors(stage: StageInput): Set<string> {
  const removed = new Set<string>();
  for (const rule of stage.fired)
    for (const id of rule.effects.removeVendors ?? []) removed.add(id);
  return removed;
}

/** Base questions first, then rule questions, without repeats. */
function mergeQuestions(base: readonly string[], added: readonly string[]): string[] {
  const questions: string[] = [];
  for (const list of [base, added]) {
    for (const text of list) if (!questions.includes(text)) questions.push(text);
  }
  return questions;
}

function bookByReason(task: Task | undefined, bookBy: number): Reason {
  if (task === undefined) return { code: 'book-by', text: `Book by ${toIso(bookBy)}.` };
  if (task.status === 'done') {
    return { code: 'booked', text: 'Already booked, so the deposit is taken as paid.' };
  }
  return {
    code: 'book-by',
    text: `Book by ${toIso(bookBy)}: the "${task.title}" task on the timeline.`,
  };
}

function depositReason(template: VendorTemplate, categoryLabel: string): Reason {
  const percent = String(Math.round(template.depositShare * 100));
  return {
    code: 'deposit',
    text: `A typical deposit is ${percent}% of the ${categoryLabel} line, paid on booking.`,
  };
}

/**
 * The vendors this event needs: profile vendors whose conditions match the input (style,
 * functions, constraints, setting), minus any a fired rule removes. The book-by date is the due
 * day of the vendor's timeline task, or today when that task is not on the timeline or is already
 * done (the vendor is booked). Tasks are
 * indexed once in a Map so the pass over vendors does no nested scans.
 */
export function buildVendors(stage: StageInput, tasks: readonly Task[]): VendorItem[] {
  const removed = removedVendors(stage);
  const extras = ruleExtras(stage);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const labels = new Map(stage.profile.categories.map((c) => [c.id, c.label]));
  const vendors: VendorItem[] = [];
  for (const template of stage.profile.vendors) {
    if (removed.has(template.id) || !applies(template.appliesWhen, stage.input)) continue;
    const task = taskById.get(template.taskId);
    const extra = extras.get(template.id) ?? NO_EXTRA;
    const booked = task?.status === 'done';
    const bookBy = booked || task === undefined ? stage.ctx.today : task.due;
    vendors.push(vendorItem(template, { task, bookBy, extra, labels }));
  }
  return vendors;
}

interface ItemParts {
  readonly task: Task | undefined;
  readonly bookBy: number;
  readonly extra: Extra;
  readonly labels: ReadonlyMap<string, string>;
}

function vendorItem(template: VendorTemplate, parts: ItemParts): VendorItem {
  const { task, bookBy, extra, labels } = parts;
  return {
    id: template.id,
    label: template.label,
    category: template.category,
    bookBy,
    booked: task?.status === 'done',
    depositShare: template.depositShare,
    questions: mergeQuestions(template.questions, extra.questions),
    reasons: [
      bookByReason(task, bookBy),
      depositReason(template, labels.get(template.category) ?? template.category),
      ...extra.reasons,
    ],
  };
}

/**
 * Splits a budget line evenly between the vendors it pays, in whole hundreds; leftover hundreds
 * (and any odd rupees) go to the first vendors so the parts add up to the line exactly.
 */
function splitLine(total: number, count: number, index: number): number {
  const units = Math.floor(total / ROUNDING_UNIT);
  const share = Math.floor(units / count) + (index < units % count ? 1 : 0);
  return share * ROUNDING_UNIT + (index === 0 ? total - units * ROUNDING_UNIT : 0);
}

function pushPayments(
  payments: Payment[],
  vendor: VendorItem,
  amount: number,
  eventDay: number,
): void {
  // A vendor the user has already booked is taken to hold its deposit, so only the balance is left.
  const deposit = vendor.booked ? 0 : Math.min(amount, roundRupees(amount * vendor.depositShare));
  if (deposit > 0) {
    payments.push({ vendorId: vendor.id, kind: 'deposit', due: vendor.bookBy, amount: deposit });
  }
  if (amount > deposit) {
    const due = Math.max(eventDay - BALANCE_LEAD_DAYS, vendor.bookBy);
    payments.push({ vendorId: vendor.id, kind: 'balance', due, amount: amount - deposit });
  }
}

/**
 * Payment schedule: the deposit on the book-by date and the balance seven days before the event
 * (or on the book-by date when booking is later than that); a booked vendor owes only the
 * balance. Amounts come from the vendor's budget
 * line, shared evenly when one line pays several vendors; a vendor with no funded line has no
 * payments. Vendors are grouped by line in one pass and lines are looked up in a Map. Sorted by
 * due day, deposits first.
 */
export function buildPayments(
  vendors: readonly VendorItem[],
  budget: readonly BudgetLine[],
  eventDay: number,
): Payment[] {
  const groups = new Map<string, VendorItem[]>();
  for (const vendor of vendors) {
    const group = groups.get(vendor.category);
    if (group === undefined) groups.set(vendor.category, [vendor]);
    else group.push(vendor);
  }
  const lineAmount = new Map(budget.map((line) => [line.category, line.amount]));
  const payments: Payment[] = [];
  for (const [category, group] of groups) {
    const total = lineAmount.get(category) ?? 0;
    group.forEach((vendor, index) => {
      const amount = splitLine(total, group.length, index);
      if (amount > 0) pushPayments(payments, vendor, amount, eventDay);
    });
  }
  return payments.sort((a, b) => a.due - b.due || KIND_RANK[a.kind] - KIND_RANK[b.kind]);
}
