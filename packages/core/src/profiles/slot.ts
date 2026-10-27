/** Compact constructor for run-sheet slot templates in the profile tables. */
import type { SlotTemplate } from '../types.ts';

/**
 * A run-sheet slot `offsetMin` minutes from the start time, lasting `durationMin`. Positional
 * arguments keep each slot on one readable line in the catalogues; the result is plain data.
 */
export function slot(
  offsetMin: number,
  durationMin: number,
  title: string,
  owner: string,
): SlotTemplate {
  return { offsetMin, durationMin, title, owner };
}
