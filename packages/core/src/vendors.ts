/** Vendor checklist, questions and payment schedule (design section 6.6). */
import { applies } from './applies.ts';
import { formatDay } from './text.ts';
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

function mergeQuestions(base: readonly string[], added: readonly string[]): string[] {
  const questions: string[] = [];
  for (const list of [base, added]) {
    for (const text of list) if (!questions.includes(text)) questions.push(text);
  }
  return questions;
}

function bookByReason(task: Task | undefined, bookBy: number): Reason {
  if (task === undefined) return { code: 'book-by', text: `Book by ${formatDay(bookBy)}.` };
  if (task.status === 'done') {
    return { code: 'booked', text: 'Already booked, so the deposit is taken as paid.' };
  }
  return {
    code: 'book-by',
    text: `Book by ${formatDay(bookBy)}: the "${task.title}" task on the timeline.`,
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
 * Matching profile vendors minus any a rule removes. Book-by is the vendor's task due day, or
 * today when that task is missing or done.
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
  const { lineShare } = template;
  return {
    id: template.id,
    label: template.label,
    category: template.category,
    bookBy,
    booked: task?.status === 'done',
    depositShare: template.depositShare,
    ...(lineShare === undefined ? {} : { lineShare }),
    questions: mergeQuestions(template.questions, extra.questions),
    reasons: [
      bookByReason(task, bookBy),
      depositReason(template, labels.get(template.category) ?? template.category),
      ...extra.reasons,
    ],
  };
}

/** Even split in whole hundreds; leftovers go to the first vendors so parts sum exactly. */
function splitLine(total: number, count: number, index: number): number {
  const units = Math.floor(total / ROUNDING_UNIT);
  const share = Math.floor(units / count) + (index < units % count ? 1 : 0);
  return share * ROUNDING_UNIT + (index === 0 ? total - units * ROUNDING_UNIT : 0);
}

/** Each vendor's part of one line: its line share, or an even split of what is left. */
function lineParts(total: number, group: readonly VendorItem[]): [VendorItem, number][] {
  const own = (v: VendorItem): number | undefined =>
    v.lineShare === undefined ? undefined : roundRupees(total * v.lineShare);
  const open = group.filter((v) => v.lineShare === undefined).length;
  const left = total - group.reduce((sum, v) => sum + (own(v) ?? 0), 0);
  let index = 0;
  return group.map((v) => [v, own(v) ?? splitLine(left, open, index++)]);
}

function pushPayments(
  payments: Payment[],
  vendor: VendorItem,
  amount: number,
  eventDay: number,
): void {
  // A booked vendor already holds its deposit, so only the balance is listed.
  const deposit = Math.min(amount, roundRupees(amount * vendor.depositShare));
  if (deposit > 0 && !vendor.booked) {
    payments.push({ vendorId: vendor.id, kind: 'deposit', due: vendor.bookBy, amount: deposit });
  }
  if (amount > deposit) {
    const due = Math.max(eventDay - BALANCE_LEAD_DAYS, vendor.bookBy);
    payments.push({ vendorId: vendor.id, kind: 'balance', due, amount: amount - deposit });
  }
}

/**
 * Deposits on the book-by date, balances a week before the event (or at booking if later),
 * sorted by due day with deposits first. A vendor with no funded line has no payments.
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
    for (const [vendor, amount] of lineParts(lineAmount.get(category) ?? 0, group)) {
      if (amount > 0) pushPayments(payments, vendor, amount, eventDay);
    }
  }
  return payments.sort((a, b) => a.due - b.due || KIND_RANK[a.kind] - KIND_RANK[b.kind]);
}
