// Keyboard model of the plan's ARIA tablist (WAI-ARIA Authoring Practices): arrows move to the
// previous or next tab and wrap, Home and End jump to the ends. Selection follows focus.

/** The plan's sections in tab order. */
export const PLAN_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'budget', label: 'Budget' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'day-of', label: 'Day of' },
  { id: 'ideas', label: 'Ideas' },
] as const;

/** One of the plan's tabs. */
export type PlanTabId = (typeof PLAN_TABS)[number]['id'];

/** The index a key moves to from `index` in a list of `length` tabs, or null for other keys. */
export function tabIndexForKey(key: string, index: number, length: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % length;
    case 'ArrowLeft':
      return (index - 1 + length) % length;
    case 'Home':
      return 0;
    case 'End':
      return length - 1;
    default:
      return null;
  }
}
