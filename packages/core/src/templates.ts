/** Positional constructors that keep each catalogue row on one readable line. */
import type { SlotTemplate, TaskTemplate } from './types.ts';

/** A run-sheet slot `offsetMin` minutes from the start; profiles and rules both add slots. */
export function slot(
  offsetMin: number,
  durationMin: number,
  title: string,
  owner: string,
): SlotTemplate {
  return { offsetMin, durationMin, title, owner };
}

/** A catalogue task `leadDays` before the event. */
export function task(
  id: string,
  title: string,
  leadDays: number,
  extras: Omit<TaskTemplate, 'id' | 'title' | 'leadDays'> = {},
): TaskTemplate {
  return { id, title, leadDays, ...extras };
}
