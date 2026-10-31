/**
 * The current plan, saved in this browser's localStorage. Everything read back is untrusted: the input
 * goes through the core's validateInput and every other field through a structural check, and
 * an entry that fails is dropped rather than repaired.
 */
import {
  fromIso,
  validateInput,
  type EventInput,
  type Ideas,
  type Source,
  type VendorStatus,
} from '@jashn/core';
import { debounce, type Debounced } from './debounce.ts';
import { isId, isRecord, isSource, isVendorStatus, readIdeas } from './validate.ts';

/** Versioned, so a future format change can ignore older data instead of misreading it. */
export const STORAGE_KEY = 'jashn.plan.v1';
/** The list of plans earlier versions kept; read once into the single plan, then removed. */
export const LEGACY_KEY = 'jashn.plans.v1';
/** Upper bound on stored checks, far above any timeline, so a tampered entry stays cheap to read. */
const MAX_CHECKS = 400;
/** Long enough to coalesce a burst of clicks, short enough that closing the tab rarely loses one. */
const WRITE_DELAY_MS = 400;

/** Generated ideas saved with the plan, labelled with their source. */
export interface SavedIdeas {
  readonly ideas: Ideas;
  readonly source: Source;
}

/** The saved plan: the validated input plus the user's own progress on it. */
export interface SavedPlan {
  readonly id: string;
  readonly input: EventInput;
  /** Ids of tasks the user has ticked. */
  readonly checks: readonly string[];
  /** Vendor progress by vendor id; a vendor without an entry is still to contact. */
  readonly vendors: Readonly<Record<string, VendorStatus>>;
  readonly ideas: SavedIdeas | null;
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
  // Only known fields are read, so unknown keys drop away.
  if (!isRecord(value) || !isSource(value.source)) return null;
  const ideas = readIdeas(value.ideas, input.constraints);
  return ideas === null ? null : { ideas, source: value.source };
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
 * A stored value as a SavedPlan, or null when any part is invalid. A past event is validated
 * as of its own day, so it is kept rather than silently erased. Saved ideas that no longer
 * pass the guards are dropped on their own; the plan itself is kept.
 */
export function readPlan(value: unknown, today: number): SavedPlan | null {
  if (!isRecord(value) || !isId(value.id)) return null;
  const result = validateInput(value.input, planDay(storedDate(value.input), today));
  const checks = readChecks(value.checks);
  const vendors = readVendors(value.vendors);
  if (!result.ok || checks === null || vendors === null) return null;
  const ideas = readSavedIdeas(value.ideas, result.value);
  return { id: value.id, input: result.value, checks, vendors, ideas };
}

/** When a legacy entry was last changed, so the newest one is migrated; 0 when unreadable. */
function updatedOf(entry: unknown): number {
  const updated = isRecord(entry) ? entry.updated : undefined;
  return typeof updated === 'number' && Number.isFinite(updated) ? updated : 0;
}

/** The most recently updated valid plan in a legacy `{ version: 1, plans }` list. */
function newestLegacy(raw: string, today: number): SavedPlan | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.version !== 1 || !Array.isArray(data.plans)) return null;
  const newestFirst = [...(data.plans as unknown[])].sort((a, b) => updatedOf(b) - updatedOf(a));
  for (const entry of newestFirst) {
    const plan = readPlan(entry, today);
    if (plan !== null) return plan;
  }
  return null;
}

/**
 * Moves the newest valid plan from the legacy list to the current key when that key is empty,
 * then removes the legacy list even if nothing in it was valid, so old data is never orphaned.
 */
function migrateLegacy(storage: Storage, today: number): void {
  try {
    const raw = storage.getItem(LEGACY_KEY);
    if (raw === null) return;
    const plan = storage.getItem(STORAGE_KEY) === null ? newestLegacy(raw, today) : null;
    if (plan !== null) storage.setItem(STORAGE_KEY, JSON.stringify(plan));
    storage.removeItem(LEGACY_KEY);
  } catch {
    // Storage refused the write; the legacy list stays for the next load to try again.
  }
}

/** The saved plan (migrating a legacy list first), or null when there is none or it is invalid. */
export function loadPlan(storage: Storage | null, today: number): SavedPlan | null {
  if (storage === null) return null;
  migrateLegacy(storage, today);
  try {
    return readPlan(JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null'), today);
  } catch {
    return null;
  }
}

/** Writes the plan now (null removes it); false when storage is unavailable or full. */
export function writePlan(storage: Storage | null, plan: SavedPlan | null): boolean {
  if (storage === null) return false;
  try {
    if (plan === null) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify(plan));
    return true;
  } catch {
    return false;
  }
}

/** Debounced writes, so ticking a run of checkboxes costs one; `onResult` hears whether each stuck. */
export function createWriter(
  storage: Storage | null,
  delayMs = WRITE_DELAY_MS,
  onResult: (ok: boolean) => void = () => undefined,
): Debounced<[SavedPlan | null]> {
  return debounce((plan) => {
    onResult(writePlan(storage, plan));
  }, delayMs);
}
