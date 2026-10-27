/**
 * The compact view of a plan that the assistant reasons over: the server sends it to Gemini as
 * prompt JSON and the offline assistant answers from it, so both can only state what the
 * engine computed. Dates are ISO strings, the form a language model reads most reliably.
 */
import { toIso } from './days.ts';
import { weekdayName } from './text.ts';
import type { EventInput, Plan, Task, TaskStatus, Verdict } from './types.ts';

/** Lists in the summary stop at this many items to keep prompts short. */
const LIST_MAX = 5;

/** A task as the assistant sees it. */
export interface SummaryTask {
  readonly title: string;
  /** ISO date. */
  readonly due: string;
  readonly status: TaskStatus;
}

/** An upcoming payment as the assistant sees it. */
export interface SummaryPayment {
  readonly vendor: string;
  readonly kind: 'deposit' | 'balance';
  /** ISO date. */
  readonly due: string;
  readonly amount: number;
}

/** Everything the assistant may quote; every rupee figure here is also in the full plan. */
export interface PlanSummary {
  /** The input without the free-text note, which a prompt fences separately as data. */
  readonly event: Omit<EventInput, 'note'> & { readonly weekday: string };
  readonly today: string;
  readonly daysToGo: number;
  readonly expected: number;
  readonly volunteers: number;
  readonly money: {
    readonly verdict: Verdict;
    readonly perGuest: number;
    readonly floor: number;
    readonly contingency: number;
    readonly lines: readonly { readonly category: string; readonly amount: number }[];
    /** Ranked by saving, largest first. */
    readonly trims: readonly { readonly label: string; readonly saves: number }[];
  };
  /** How many tasks are late, and the first of them in timeline order. */
  readonly late: { readonly count: number; readonly tasks: readonly SummaryTask[] };
  /** The next task that is neither late nor done. */
  readonly next: SummaryTask | null;
  readonly topActions: readonly SummaryTask[];
  readonly vendors: readonly { readonly label: string; readonly bookBy: string }[];
  /** Payments due today or later, soonest first (buildPayments already sorts them). */
  readonly payments: readonly SummaryPayment[];
  readonly notices: readonly string[];
}

/** An allow-list rather than a copy, so a field added to EventInput never leaks in unseen. */
function eventFacts(input: EventInput, weekday: string): PlanSummary['event'] {
  const { type, style, functions, date, startTime, city, tier, setting } = input;
  const { venueBooked, invited, budget, priorities, constraints, language } = input;
  return {
    type,
    style,
    functions,
    date,
    weekday,
    startTime,
    city,
    tier,
    setting,
    venueBooked,
    invited,
    budget,
    priorities,
    constraints,
    language,
  };
}

function brief(task: Task): SummaryTask {
  return { title: task.title, due: toIso(task.due), status: task.status };
}

function upcomingPayments(plan: Plan): SummaryPayment[] {
  const labels = new Map(plan.vendors.map((vendor) => [vendor.id, vendor.label]));
  return plan.payments
    .filter((payment) => payment.due >= plan.today)
    .slice(0, LIST_MAX)
    .map((payment) => ({
      vendor: labels.get(payment.vendorId) ?? payment.vendorId,
      kind: payment.kind,
      due: toIso(payment.due),
      amount: payment.amount,
    }));
}

/**
 * Condenses a plan for the assistant. The note is left out on purpose: it is user free text,
 * so the server passes it fenced and declared as data rather than mixed into the facts.
 */
export function planSummary(plan: Plan): PlanSummary {
  const late = plan.tasks.filter((task) => task.status === 'late');
  const next = plan.tasks.find((task) => task.status === 'upcoming' || task.status === 'at-risk');
  const { verdict, perGuest, floor, trims } = plan.feasibility;
  return {
    event: eventFacts(plan.input, weekdayName(plan.today + plan.daysToGo)),
    today: toIso(plan.today),
    daysToGo: plan.daysToGo,
    expected: plan.expected,
    volunteers: plan.volunteers,
    money: {
      verdict,
      perGuest,
      floor,
      contingency: plan.contingency,
      lines: plan.budget.map(({ category, amount }) => ({ category, amount })),
      trims: trims.map(({ label, saves }) => ({ label, saves })),
    },
    late: { count: late.length, tasks: late.slice(0, LIST_MAX).map(brief) },
    next: next === undefined ? null : brief(next),
    topActions: plan.topActions.map(brief),
    vendors: plan.vendors.map((vendor) => ({ label: vendor.label, bookBy: toIso(vendor.bookBy) })),
    payments: upcomingPayments(plan),
    notices: plan.notices.map((notice) => notice.text),
  };
}
