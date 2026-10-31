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
  isPatchField,
  type EventInput,
  type PatchField,
  type PlanDiff,
  type PlanPatch,
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

function list(words: readonly string[]): string {
  return words.length === 0 ? 'none' : words.join(', ');
}

/** How each patchable field reads in the preview, keyed by field so every value keeps its type. */
const SHOW: { readonly [K in PatchField]: (value: EventInput[K], labelOf: LabelOf) => string } = {
  date: (value) => {
    const day = fromIso(value);
    return day === null ? value : formatDay(day);
  },
  startTime: (value) => value,
  invited: (value) => formatCount(value),
  budget: (value) => formatRupees(value),
  priorities: (ids, labelOf) => list(ids.map((id) => labelOf(id))),
  constraints: (ids) => list(ids.map((id) => CONSTRAINT_LABELS[id])),
  setting: (value) => SETTING_LABELS[value],
  tier: (value) => TIER_LABELS[value],
  functions: (ids, labelOf) => list(ids.map((id) => labelOf(id))),
  style: (value, labelOf) => labelOf(value),
};

function show<K extends PatchField>(field: K, value: EventInput[K], labelOf: LabelOf): string {
  return SHOW[field](value, labelOf);
}

/** The event fields the patch changes, with their old and new values in words. */
export function patchRows(before: EventInput, patch: PlanPatch, labelOf: LabelOf): PreviewRow[] {
  const row = (field: PatchField): PreviewRow[] => {
    const after = patch[field];
    if (after === undefined) return [];
    const shown = {
      label: FIELD_LABELS[field],
      before: show(field, before[field], labelOf),
      after: show(field, after, labelOf),
    };
    return shown.before === shown.after ? [] : [shown];
  };
  return Object.keys(patch).filter(isPatchField).flatMap(row);
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
