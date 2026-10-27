/**
 * Calendar export. TaskList imports this module dynamically on the first click, so the .ics
 * writer stays out of the Plan view's chunk until someone actually exports.
 */
import { toIcs, type Plan } from '@jashn/core';

const REVOKE_DELAY_MS = 1000;

/** Builds the .ics text for a plan; the plan id keeps UIDs stable across re-exports. */
export function calendarText(plan: Plan, planId: string, now: number): string {
  return toIcs(plan, { stampMs: now, planId });
}

/** Downloads the plan's timeline as an .ics file through a temporary object URL. */
export function downloadCalendar(plan: Plan, planId: string): void {
  const blob = new Blob([calendarText(plan, planId, Date.now())], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'jashn-timeline.ics';
  // Attached while clicked: some browsers ignore clicks on detached anchors.
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked a moment later: some browsers start the download only after the click returns.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_DELAY_MS);
}
