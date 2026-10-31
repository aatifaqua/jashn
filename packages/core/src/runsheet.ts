/**
 * Day-of run sheet. Slots sit on an absolute minute line so one past midnight
 * lands on the right day and sorting is one integer compare.
 */
import { functionDays } from './context.ts';
import { formatTime } from './days.ts';
import type { StageInput } from './timeline.ts';
import type { RunSheetSlot, SlotTemplate } from './types.ts';

const MINUTES_PER_DAY = 1440;

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

function leadIn(templates: readonly SlotTemplate[]): number {
  let earliest = 0;
  for (const { offsetMin } of templates) earliest = Math.min(earliest, offsetMin);
  return -earliest;
}

/**
 * Function blocks on the days context.ts assigns, each at its customary time; a same-day
 * reception waits for the main day's last slot to end.
 */
function placeFunctions(into: Placed[], stage: StageInput, mainEnd: number): void {
  for (const { functionId, offset } of functionDays(stage.input)) {
    const def = stage.profile.functions.find((f) => f.id === functionId);
    if (def === undefined || functionId === 'ceremony') continue;
    const customary = (stage.ctx.eventDay + offset) * MINUTES_PER_DAY + def.anchorMin;
    const at = offset === 0 ? Math.max(customary, mainEnd + leadIn(def.runSheet)) : customary;
    place(into, def.runSheet, at);
  }
}

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

/** Builds the run sheet in time order, with one block per extra wedding function. */
export function buildRunSheet(stage: StageInput): RunSheetSlot[] {
  const placed: Placed[] = [];
  const anchor = stage.ctx.eventDay * MINUTES_PER_DAY + stage.ctx.startMinutes;
  const mainEnd = place(placed, mainDayTemplates(stage), anchor);
  placeFunctions(placed, stage, mainEnd);
  return placed.sort((a, b) => a.at - b.at).map(toSlot);
}
