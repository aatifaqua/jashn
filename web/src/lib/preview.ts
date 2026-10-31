/**
 * Rows for the assistant's before/after preview: what the proposed patch changes in the event,
 * then what that does to the plan (from the core's diffPlans).
 */
import {
  FIELD_LABELS,
  formatCount,
  formatDay,
  formatRupees,
  fromIso,
  type CityTier,
  type Constraint,
  type EventInput,
  type PatchField,
  type PlanDiff,
  type PlanPatch,
  type Setting,
} from '@jashn/core';
import { CONSTRAINT_LABELS, SETTING_LABELS, TIER_LABELS, VERDICTS } from './labels.ts';

/** One line of the before and after preview. */
export interface PreviewRow {
  readonly label: string;
  readonly before: string;
  readonly after: string;
}

/** Turns an id into words; the caller supplies the profile's category, function and style labels. */
type LabelOf = (id: string) => string;

function word(field: PatchField, id: string, labelOf: LabelOf): string {
  if (field === 'constraints') return CONSTRAINT_LABELS[id as Constraint];
  if (field === 'setting') return SETTING_LABELS[id as Setting];
  if (field === 'tier') return TIER_LABELS[id as CityTier];
  return labelOf(id);
}

function show(field: PatchField, value: EventInput[PatchField], labelOf: LabelOf): string {
  if (typeof value === 'number')
    return field === 'budget' ? formatRupees(value) : formatCount(value);
  if (typeof value !== 'string') {
    return value.length === 0 ? 'none' : value.map((id) => word(field, id, labelOf)).join(', ');
  }
  if (field === 'date') {
    const day = fromIso(value);
    return day === null ? value : formatDay(day);
  }
  return field === 'startTime' ? value : word(field, value, labelOf);
}

/** The event fields the patch changes, with their old and new values in words. */
export function patchRows(before: EventInput, patch: PlanPatch, labelOf: LabelOf): PreviewRow[] {
  const fields = Object.keys(patch) as PatchField[];
  return fields.flatMap((field) => {
    const after = patch[field];
    if (after === undefined) return [];
    const row = {
      label: FIELD_LABELS[field],
      before: show(field, before[field], labelOf),
      after: show(field, after, labelOf),
    };
    return row.before === row.after ? [] : [row];
  });
}

/** The plan consequences: headcount, verdict, changed budget lines and newly late tasks. */
export function diffRows(diff: PlanDiff, labelOf: LabelOf): PreviewRow[] {
  const rows: PreviewRow[] = [];
  if (diff.expected.before !== diff.expected.after) {
    rows.push({
      label: 'Expected guests',
      before: formatCount(diff.expected.before),
      after: formatCount(diff.expected.after),
    });
  }
  if (diff.verdict.before !== diff.verdict.after) {
    rows.push({
      label: 'Budget verdict',
      before: VERDICTS[diff.verdict.before].word,
      after: VERDICTS[diff.verdict.after].word,
    });
  }
  for (const line of diff.budget) {
    rows.push({
      label: labelOf(line.category),
      before: formatRupees(line.before),
      after: formatRupees(line.after),
    });
  }
  for (const task of diff.newlyLate) {
    rows.push({ label: task.title, before: 'On time', after: 'Late' });
  }
  return rows;
}
