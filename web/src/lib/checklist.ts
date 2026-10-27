/**
 * The plain-text checklist copied to the clipboard: tasks grouped by phase with their due
 * dates and a tick for the ones done, readable in any messaging app.
 */
import { PHASES, occasion, type Plan } from '@jashn/core';
import { dayLabel, longDay } from './format.ts';
import { PHASE_LABELS } from './labels.ts';

/** Builds the checklist text; `checks` holds the ids of tasks the user has ticked. */
export function checklistText(plan: Plan, checks: ReadonlySet<string>): string {
  const { input } = plan;
  const head = `Jashn checklist: ${occasion(input)}, ${longDay(plan.today + plan.daysToGo)}`;
  const lines = [head];
  for (const phase of PHASES) {
    const tasks = plan.tasks.filter((task) => task.phase === phase);
    if (tasks.length === 0) continue;
    lines.push('', PHASE_LABELS[phase]);
    for (const task of tasks) {
      const done = checks.has(task.id) || task.status === 'done';
      lines.push(`[${done ? 'x' : ' '}] ${task.title} (due ${dayLabel(task.due)})`);
    }
  }
  return lines.join('\n');
}
