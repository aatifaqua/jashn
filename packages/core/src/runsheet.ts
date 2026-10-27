/**
 * Day-of run sheet (design section 6.7). Templates are anchored to the start time; slots are
 * placed on an absolute minute line (day x 1440 + minute) so a slot past midnight lands on the
 * right day and sorting is a single integer compare.
 */
import { functionDays } from './context.ts';
import { formatTime } from './days.ts';
import type { StageInput } from './timeline.ts';
import type { RunSheetSlot, SlotTemplate } from './types.ts';

const MINUTES_PER_DAY = 1440;

/** A slot pinned to an absolute minute. */
interface Placed {
  readonly at: number;
  readonly template: SlotTemplate;
}

/** Appends templates anchored at an absolute minute; returns the latest end minute. */
function place(into: Placed[], templates: readonly SlotTemplate[], anchor: number): number {
  let end = anchor;
  for (const template of templates) {
    const at = anchor + template.offsetMin;
    into.push({ at, template });
    end = Math.max(end, at + template.durationMin);
  }
  return end;
}

/** Minutes a block's preparation starts before its anchor (0 when nothing comes before it). */
function leadIn(templates: readonly SlotTemplate[]): number {
  let earliest = 0;
  for (const { offsetMin } of templates) earliest = Math.min(earliest, offsetMin);
  return -earliest;
}

/**
 * Places the wedding function blocks on the days context.ts assigns them, so the run sheet and
 * the plan's span always agree: earlier functions on consecutive days before the ceremony, and
 * a reception either the next day at the start time or, on the same day, straight after the
 * main day's last slot (its preparation starting as that slot ends).
 */
function placeFunctions(into: Placed[], stage: StageInput, anchor: number, mainEnd: number): void {
  for (const { functionId, offset } of functionDays(stage.input)) {
    const def = stage.profile.functions.find((f) => f.id === functionId);
    if (def === undefined || functionId === 'ceremony') continue;
    const at = offset === 0 ? mainEnd + leadIn(def.runSheet) : anchor + offset * MINUTES_PER_DAY;
    place(into, def.runSheet, at);
  }
}

/** The event day's templates: the ceremony block (weddings), the style template, rule slots. */
function mainDayTemplates(stage: StageInput): SlotTemplate[] {
  const style = stage.profile.styles.find((def) => def.id === stage.input.style);
  const ceremony = stage.input.functions.includes('ceremony')
    ? stage.profile.functions.find((def) => def.id === 'ceremony')
    : undefined;
  const templates = [...(ceremony?.runSheet ?? []), ...(style?.runSheet ?? [])];
  for (const rule of stage.fired) templates.push(...(rule.effects.slots ?? []));
  return templates;
}

function toSlot({ at, template }: Placed): RunSheetSlot {
  return {
    day: Math.floor(at / MINUTES_PER_DAY),
    start: formatTime(at),
    end: formatTime(at + template.durationMin),
    title: template.title,
    owner: template.owner,
  };
}

/**
 * Builds the run sheet. The event day carries the style template (its own frame, such as a
 * community event's set-up, briefing and clean-up), the ceremony block for weddings and any
 * rule-added slots (accessibility helper, hydration, rain check); multi-function weddings add
 * one block per function on the days around it. Slots are returned in time order.
 */
export function buildRunSheet(stage: StageInput): RunSheetSlot[] {
  const placed: Placed[] = [];
  const anchor = stage.ctx.eventDay * MINUTES_PER_DAY + stage.ctx.startMinutes;
  const mainEnd = place(placed, mainDayTemplates(stage), anchor);
  placeFunctions(placed, stage, anchor, mainEnd);
  return placed.sort((a, b) => a.at - b.at).map(toSlot);
}
