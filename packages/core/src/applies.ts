/** Evaluates the declarative `appliesWhen` conditions of profile catalogue entries. */
import type { Applicability, EventInput } from './types.ts';

function someIn(chosen: readonly string[], listed: readonly string[] | undefined): boolean {
  return listed === undefined || chosen.some((id) => listed.includes(id));
}

/** True when every condition present in `when` matches; an absent one matches anything. */
export function applies(when: Applicability | undefined, input: EventInput): boolean {
  if (when === undefined) return true;
  const { styles, functions, anyConstraint, noConstraint, settings } = when;
  return (
    someIn([input.style], styles) &&
    someIn(input.functions, functions) &&
    someIn(input.constraints, anyConstraint) &&
    !(noConstraint ?? []).some((id) => input.constraints.includes(id)) &&
    someIn([input.setting], settings)
  );
}
