/** Offline answers read only from the plan summary, so they never state uncomputed facts. */
import type { PlanSummary, SummaryTask } from '../summary.ts';
import { countWord, formatCount, formatRupees, formatShortIso } from '../text.ts';

const LIST_MAX = 3;

function taskLine(task: SummaryTask): string {
  return `${task.title} (due ${formatShortIso(task.due)})`;
}

/** "What is late?" */
export function lateAnswer(summary: PlanSummary): string {
  const { count, tasks } = summary.late;
  if (count === 0) {
    const { next } = summary;
    return next === null ? 'Nothing is late.' : `Nothing is late. Next up: ${taskLine(next)}.`;
  }
  const shown = tasks.slice(0, LIST_MAX).map((task) => task.title);
  const more = count > LIST_MAX ? `, and ${formatCount(count - LIST_MAX)} more` : '';
  return (
    `${countWord(count, 'task is', 'tasks are')} late: ${shown.join('; ')}${more}. ` +
    'The timeline spreads them from today, one working day apart, so start with the first.'
  );
}

/** "How can I save money?" */
export function saveAnswer(summary: PlanSummary): string {
  const { trims, verdict, contingency } = summary.money;
  if (trims.length === 0) {
    return (
      `Your budget looks ${verdict}, so no savings are needed. ` +
      `${formatRupees(contingency)} is held back as contingency.`
    );
  }
  const shown = trims
    .slice(0, LIST_MAX)
    .map((trim) => `${trim.label} (saves about ${formatRupees(trim.saves)})`);
  return (
    `Ways to save, largest first: ${shown.join('; ')}. ` +
    'Edit details changes the guests, date and start time; the rest you arrange with vendors or sponsors.'
  );
}

/** "What should I book first?" */
export function firstAnswer(summary: PlanSummary): string {
  if (summary.topActions.length === 0) return 'Everything is on track; nothing needs doing yet.';
  const shown = summary.topActions.map((task, i) => `${String(i + 1)}. ${taskLine(task)}`);
  return `Start with: ${shown.join(' ')}`;
}

/** "When are payments due?" */
export function paymentAnswer(summary: PlanSummary): string {
  const due = summary.payments
    .slice(0, LIST_MAX)
    .map(
      (payment) =>
        `${payment.vendor} ${payment.kind} ${formatRupees(payment.amount)} by ${formatShortIso(payment.due)}`,
    );
  return due.length === 0 ? 'No payments are scheduled.' : `Next payments: ${due.join('; ')}.`;
}

/** "Is my budget enough?" */
export function budgetAnswer(summary: PlanSummary): string {
  const { verdict, perGuest, floor } = summary.money;
  return (
    `Your budget is ${verdict}: ${formatRupees(perGuest)} per expected guest for ` +
    `${countWord(summary.expected, 'guest', 'guests')}, against a modest floor of ` +
    `${formatRupees(floor)} per guest.`
  );
}

/** What the offline assistant can do; changes go through the form. */
export function helpAnswer(summary: PlanSummary): string {
  return (
    `Your plan: ${countWord(summary.daysToGo, 'day', 'days')} to go, ` +
    `${countWord(summary.expected, 'guest', 'guests')} expected, budget ${summary.money.verdict}. ` +
    'Ask what is late, how to save money, what to book first or when payments are due. ' +
    'To change the plan, use Edit details.'
  );
}
