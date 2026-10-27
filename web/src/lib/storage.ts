/**
 * Saved plans in this browser's localStorage. Everything read back is untrusted: the input
 * goes through the core's validateInput and every other field through a structural check, and
 * an entry that fails is dropped rather than repaired. Writes are debounced so ticking a run
 * of checkboxes costs one write.
 */
import {
  fromIso,
  validateInput,
  type EventInput,
  type Ideas,
  type Language,
  type Source,
  type VendorStatus,
} from '@jashn/core';
import { isId, isLanguage, isRecord, isSource, isVendorStatus, readIdeas } from './validate.ts';

/** Versioned, so a future format change can ignore or migrate older data instead of misreading it. */
export const STORAGE_KEY = 'jashn.plans.v1';
const VERSION = 1;
/** Plans kept per browser (design section 16). */
export const MAX_PLANS = 10;
/** Upper bound on stored checks, far above any timeline, so a tampered entry stays cheap to read. */
const MAX_CHECKS = 400;
/** Long enough to coalesce a burst of clicks, short enough that closing the tab rarely loses one. */
const WRITE_DELAY_MS = 400;

/** Generated ideas saved with the plan, labelled with their source and language. */
export interface SavedIdeas {
  readonly ideas: Ideas;
  readonly source: Source;
  readonly language: Language;
}

/** One saved plan: the validated input plus the user's own progress on it. */
export interface SavedPlan {
  readonly id: string;
  readonly input: EventInput;
  /** Ids of tasks the user has ticked. */
  readonly checks: readonly string[];
  /** Vendor progress by vendor id; a vendor without an entry is still to contact. */
  readonly vendors: Readonly<Record<string, VendorStatus>>;
  readonly ideas: SavedIdeas | null;
  /** Last change, in milliseconds since the epoch; the list shows the newest first. */
  readonly updated: number;
}

/** The browser's localStorage, or null where it is blocked (private modes, sandboxed frames). */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readChecks(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length > MAX_CHECKS || !value.every(isId)) return null;
  return [...new Set(value)];
}

function readVendors(value: unknown): Record<string, VendorStatus> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  const ok = entries.every(([id, status]) => isId(id) && isVendorStatus(status));
  return ok ? (Object.fromEntries(entries) as Record<string, VendorStatus>) : null;
}

function readSavedIdeas(value: unknown, input: EventInput): SavedIdeas | null {
  if (!isRecord(value) || !isSource(value.source) || !isLanguage(value.language)) return null;
  const ideas = readIdeas(value.ideas, input.constraints);
  return ideas === null ? null : { ideas, source: value.source, language: value.language };
}

/**
 * The day a plan is computed for: today, or the event day once the event has passed, so a
 * finished event keeps its plan (and its after-the-event tasks) instead of turning invalid.
 */
export function planDay(input: Pick<EventInput, 'date'>, today: number): number {
  return Math.min(today, fromIso(input.date) ?? today);
}

function storedDate(input: unknown): Pick<EventInput, 'date'> {
  return { date: isRecord(input) && typeof input.date === 'string' ? input.date : '' };
}

/**
 * One stored entry as a SavedPlan, or null when any part is invalid. A past event is
 * validated as of its own day, so it stays listed rather than being silently erased. Saved ideas that no
 * longer pass the guards are dropped on their own; the plan itself is kept.
 */
export function readPlan(value: unknown, today: number): SavedPlan | null {
  if (!isRecord(value) || !isId(value.id)) return null;
  const { updated } = value;
  if (typeof updated !== 'number' || !Number.isFinite(updated) || updated < 0) return null;
  const result = validateInput(value.input, planDay(storedDate(value.input), today));
  const checks = readChecks(value.checks);
  const vendors = readVendors(value.vendors);
  if (!result.ok || checks === null || vendors === null) return null;
  const ideas = readSavedIdeas(value.ideas, result.value);
  return { id: value.id, input: result.value, checks, vendors, ideas, updated };
}

/** Every valid saved plan, newest first, at most MAX_PLANS, with duplicate ids dropped. */
export function readPlans(storage: Storage | null, today: number): SavedPlan[] {
  let data: unknown;
  try {
    data = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    return [];
  }
  if (!isRecord(data) || data.version !== VERSION || !Array.isArray(data.plans)) return [];
  const seen = new Set<string>();
  const plans: SavedPlan[] = [];
  for (const entry of data.plans) {
    const plan = readPlan(entry, today);
    if (plan === null || seen.has(plan.id)) continue;
    seen.add(plan.id);
    plans.push(plan);
  }
  return plans.sort((a, b) => b.updated - a.updated).slice(0, MAX_PLANS);
}

/** Writes the plans now; false when storage is unavailable or full. */
export function writePlans(storage: Storage | null, plans: readonly SavedPlan[]): boolean {
  if (storage === null) return false;
  try {
    if (plans.length === 0) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, plans }));
    return true;
  } catch {
    return false;
  }
}

/** A debounced writer: `schedule` coalesces changes, `flush` writes any pending change now. */
export interface PlanWriter {
  schedule(plans: readonly SavedPlan[]): void;
  flush(): boolean;
  /** Drops a pending write without writing it. */
  cancel(): void;
}

/** Creates a debounced writer for one storage area; `onResult` hears whether each write stuck. */
export function createWriter(
  storage: Storage | null,
  delayMs = WRITE_DELAY_MS,
  onResult: (ok: boolean) => void = () => undefined,
): PlanWriter {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: readonly SavedPlan[] | null = null;
  const flush = (): boolean => {
    clearTimeout(timer);
    timer = undefined;
    if (pending === null) return true;
    const plans = pending;
    pending = null;
    const ok = writePlans(storage, plans);
    onResult(ok);
    return ok;
  };
  return {
    schedule(plans) {
      pending = plans;
      clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    cancel() {
      clearTimeout(timer);
      timer = undefined;
      pending = null;
    },
  };
}
