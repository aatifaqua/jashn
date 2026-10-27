/**
 * Back-scheduling of profile and rule tasks into a dated timeline (design section 6.5). Every
 * date is an integer day number, so scheduling is plain integer arithmetic with no Date objects.
 */
import { applies } from './applies.ts';
import { weekday } from './days.ts';
import { countWord, formatDay } from './text.ts';
import type { FiredRule } from './rules.ts';
import type {
  EventContext,
  EventInput,
  Phase,
  Profile,
  Reason,
  Task,
  TaskStatus,
  TaskTemplate,
} from './types.ts';

/** What every planning stage reads: the profile, the derived context and the rules that fired. */
export interface StageInput {
  readonly profile: Profile;
  readonly ctx: EventContext;
  readonly input: EventInput;
  /** The rules that fired for this input (fireRules), in table order, reasons already worded. */
  readonly fired: readonly FiredRule[];
}

interface Entry {
  readonly template: TaskTemplate;
  readonly reasons: Reason[];
  /** Ideal due day after any lead-time factor. */
  idealDue: number;
}

/** Phase thresholds in days before the event, checked in order; frozen module-scope table. */
const PHASE_FLOORS: readonly { readonly min: number; readonly phase: Phase }[] = Object.freeze([
  { min: 60, phase: 'months-out' },
  { min: 14, phase: 'weeks-out' },
  { min: 1, phase: 'final-fortnight' },
]);

/** Display rank of each phase, so sorting needs no indexOf scans. */
const PHASE_RANK: Readonly<Record<Phase, number>> = Object.freeze({
  'do-now': 0,
  'months-out': 1,
  'weeks-out': 2,
  'final-fortnight': 3,
  'day-of': 4,
  after: 5,
});

const SUNDAY = 0;

function leadReason(leadDays: number): Reason {
  if (leadDays > 0)
    return {
      code: 'lead-time',
      text: `Usually done ${countWord(leadDays, 'day', 'days')} before the event.`,
    };
  if (leadDays === 0) return { code: 'lead-time', text: 'Done on the day of the event.' };
  return {
    code: 'lead-time',
    text: `Done within ${countWord(-leadDays, 'day', 'days')} after the event.`,
  };
}

/** Lead-time multipliers per vendor id with the reasons of the rules that set them. */
function leadFactors(stage: StageInput): Map<string, { factor: number; reasons: Reason[] }> {
  const factors = new Map<string, { factor: number; reasons: Reason[] }>();
  for (const rule of stage.fired) {
    const lead = rule.effects.leadFactor;
    if (lead === undefined) continue;
    const { reason } = rule;
    for (const vendorId of lead.vendorIds) {
      const current = factors.get(vendorId) ?? { factor: 1, reasons: [] };
      factors.set(vendorId, {
        factor: current.factor * lead.factor,
        reasons: [...current.reasons, reason],
      });
    }
  }
  return factors;
}

function addEntry(entries: Map<string, Entry>, template: TaskTemplate, reason?: Reason): void {
  const existing = entries.get(template.id);
  if (existing !== undefined) {
    if (reason !== undefined) existing.reasons.push(reason);
    return;
  }
  const reasons = [leadReason(template.leadDays)];
  if (reason !== undefined) reasons.push(reason);
  entries.set(template.id, { template, reasons, idealDue: 0 });
}

/**
 * Profile tasks that apply plus rule-added tasks, keyed by id. A rule task whose id is already
 * present only adds its reason, so a task never appears twice.
 */
function collectEntries(stage: StageInput): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  for (const template of stage.profile.tasks) {
    if (applies(template.appliesWhen, stage.input)) addEntry(entries, template);
  }
  for (const rule of stage.fired) {
    const tasks = rule.effects.tasks ?? [];
    if (tasks.length === 0) continue;
    const { reason } = rule;
    for (const template of tasks) {
      if (applies(template.appliesWhen, stage.input)) addEntry(entries, template, reason);
    }
  }
  return entries;
}

/** Sets each entry's ideal due day; lead factors stretch only pre-event booking tasks. */
function setIdealDue(entries: Map<string, Entry>, stage: StageInput): void {
  const factors = leadFactors(stage);
  for (const entry of entries.values()) {
    const { leadDays, vendorId } = entry.template;
    const boost = vendorId === undefined || leadDays <= 0 ? undefined : factors.get(vendorId);
    const lead = boost === undefined ? leadDays : Math.ceil(leadDays * boost.factor);
    if (boost !== undefined) entry.reasons.push(...boost.reasons);
    entry.idealDue = stage.ctx.eventDay - lead;
  }
}

/** Task ids the fired rules pin to the front, such as "Lock the venue today". */
export function pinnedIds(fired: readonly FiredRule[]): string[] {
  return fired.flatMap((rule) => rule.effects.pinTasks ?? []);
}

/**
 * The top actions once the user has ticked some tasks off: ticked ones drop out and the next
 * late, at-risk or upcoming tasks move up, while the plan's own top actions keep their order.
 */
export function remainingActions(
  plan: { readonly tasks: readonly Task[]; readonly topActions: readonly Task[] },
  ticked: ReadonlySet<string>,
): Task[] {
  const open = plan.tasks.filter((task) => !ticked.has(task.id));
  return topActions(
    open,
    plan.topActions.map((task) => task.id),
  );
}

/**
 * Orders entries so every task follows the task it depends on, otherwise pinned tasks first and
 * then the most urgent (earliest ideal due day); this is also the priority order for spreading
 * late tasks, so a pinned late task is due today. A dependency on a task that does not apply is
 * ignored, and a cycle is broken at the back edge.
 */
function dependencyOrder(entries: Map<string, Entry>, pinned: ReadonlySet<string>): Entry[] {
  const rank = (entry: Entry): number => (pinned.has(entry.template.id) ? 0 : 1);
  const roots = [...entries.values()].sort((a, b) => rank(a) - rank(b) || a.idealDue - b.idealDue);
  const ordered: Entry[] = [];
  const seen = new Set<string>();
  const visit = (entry: Entry): void => {
    if (seen.has(entry.template.id)) return;
    seen.add(entry.template.id);
    const before =
      entry.template.after === undefined ? undefined : entries.get(entry.template.after);
    if (before !== undefined) visit(before);
    ordered.push(entry);
  };
  for (const entry of roots) visit(entry);
  return ordered;
}

/** Ids the fired rules mark as already done, with the reason of the rule that did so. */
function completedIds(stage: StageInput): Map<string, Reason> {
  const done = new Map<string, Reason>();
  for (const rule of stage.fired) {
    for (const id of rule.effects.completeTasks ?? []) done.set(id, rule.reason);
  }
  return done;
}

/** The next working day after `day`; Sundays are skipped because most vendors close then. */
function nextWorkingDay(day: number): number {
  const next = day + 1;
  return weekday(next) === SUNDAY ? next + 1 : next;
}

function phaseOf(late: boolean, leadDays: number, daysBefore: number): Phase {
  if (late) return 'do-now';
  if (leadDays < 0) return 'after';
  for (const { min, phase } of PHASE_FLOORS) if (daysBefore >= min) return phase;
  return 'day-of';
}

/** Mutable state of the scheduling pass. */
interface Pass {
  readonly ctx: EventContext;
  readonly done: Map<string, Reason>;
  /** Day each scheduled task occupies for its dependents. */
  readonly dueById: Map<string, number>;
  /** Next free day for a late task. */
  cursor: number;
}

/**
 * Reasons the status adds: how late the task is, and, when even the earliest workable day falls
 * after its last realistic day, why it is at risk. A late task can be both.
 */
function statusReasons(entry: Entry, raw: number, late: boolean, pass: Pass): Reason[] {
  const { today, eventDay } = pass.ctx;
  const done = pass.done.get(entry.template.id);
  if (done !== undefined) return [done];
  const reasons: Reason[] = [];
  if (late) {
    const ago = countWord(today - entry.idealDue, 'day', 'days');
    reasons.push({
      code: 'late',
      text: `Ideally done by ${formatDay(entry.idealDue)}, ${ago} ago.`,
    });
  }
  if (impossible(entry, raw, pass)) {
    const lastDay = formatDay(eventDay - (entry.template.minLead ?? 0));
    reasons.push({
      code: 'at-risk',
      text: `The earliest workable date, ${formatDay(raw)}, is after ${lastDay}, the last day this can realistically happen.`,
    });
  }
  return reasons;
}

/** True when the earliest workable day of a pre-event task is past its last realistic day. */
function impossible(entry: Entry, raw: number, pass: Pass): boolean {
  const { leadDays, minLead } = entry.template;
  return leadDays >= 0 && raw > pass.ctx.eventDay - (minLead ?? 0);
}

/**
 * At-risk wins over late: a late task spread past its last workable day must say so, rather
 * than sit quietly on the event day looking merely overdue.
 */
function statusOf(entry: Entry, raw: number, late: boolean, pass: Pass): TaskStatus {
  if (pass.done.has(entry.template.id)) return 'done';
  if (impossible(entry, raw, pass)) return 'at-risk';
  return late ? 'late' : 'upcoming';
}

/** Schedules one task: due = max(idealDue, today, due(after) + 1), late tasks spread apart. */
function schedule(entry: Entry, pass: Pass): Task {
  const { today, eventDay } = pass.ctx;
  const { id, title, leadDays, after, vendorId } = entry.template;
  const depDue = after === undefined ? undefined : pass.dueById.get(after);
  const floor = Math.max(today, depDue === undefined ? today : depDue + 1);
  const isLate = !pass.done.has(id) && entry.idealDue < today;
  const raw = isLate ? Math.max(pass.cursor, floor) : Math.max(entry.idealDue, floor);
  if (isLate) pass.cursor = nextWorkingDay(raw);
  const status = statusOf(entry, raw, isLate, pass);
  const due = leadDays >= 0 ? Math.min(raw, eventDay) : raw;
  pass.dueById.set(id, status === 'done' ? today - 1 : due);
  const reasons = [...entry.reasons, ...statusReasons(entry, raw, isLate, pass)];
  const phase = phaseOf(isLate, leadDays, eventDay - due);
  const task = { id, title, due, idealDue: entry.idealDue, phase, status, reasons };
  return vendorId === undefined ? task : { ...task, vendorId };
}

/**
 * Builds the timeline in one pass over the tasks in dependency order. Nothing is dropped: a task
 * that cannot fit before the event stays on the list as at-risk with its reason. The result is
 * sorted by phase, then due day.
 */
export function buildTimeline(stage: StageInput): Task[] {
  const entries = collectEntries(stage);
  setIdealDue(entries, stage);
  const pass: Pass = {
    ctx: stage.ctx,
    done: completedIds(stage),
    dueById: new Map(),
    cursor: stage.ctx.today,
  };
  const pinned = new Set(pinnedIds(stage.fired));
  const tasks = dependencyOrder(entries, pinned).map((entry) => schedule(entry, pass));
  return tasks.sort((a, b) => PHASE_RANK[a.phase] - PHASE_RANK[b.phase] || a.due - b.due);
}

const TOP_ACTIONS = 3;
const ACTION_ORDER: readonly TaskStatus[] = Object.freeze(['late', 'at-risk', 'upcoming']);

/**
 * The first three of: the pinned tasks (those a fired rule pins), late tasks, at-risk tasks,
 * then the next upcoming ones. Done tasks never appear. Expects tasks in timeline order.
 */
export function topActions(tasks: readonly Task[], pinned: readonly string[]): Task[] {
  const picks: Task[] = [];
  const take = (task: Task | undefined): void => {
    if (
      task !== undefined &&
      task.status !== 'done' &&
      picks.length < TOP_ACTIONS &&
      !picks.includes(task)
    ) {
      picks.push(task);
    }
  };
  for (const id of pinned) take(tasks.find((t) => t.id === id));
  for (const status of ACTION_ORDER)
    for (const task of tasks) if (task.status === status) take(task);
  return picks;
}
