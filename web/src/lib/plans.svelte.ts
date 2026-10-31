/**
 * App state: the current plan, its event type's profile and the plan built from them. The
 * core computes the plan in the browser, so it needs no network. State is replaced immutably, which keeps every saved
 * entry plain JSON and lets `$derived` skip work when nothing it reads has changed.
 */
import {
  applyPatch,
  buildPlan,
  guardIdeas,
  loadProfile,
  type EventInput,
  type EventType,
  type Plan,
  type PlanPatch,
  type Profile,
  type VendorStatus,
} from '@jashn/core';
import type { Debounced } from './debounce.ts';
import { createWriter, loadPlan, planDay, type SavedIdeas, type SavedPlan } from './storage.ts';

/** Construction options; the id source is injectable for tests. */
interface StoreOptions {
  readonly storage: Storage | null;
  readonly today: number;
  readonly newId?: () => string;
  readonly writeDelayMs?: number;
  /** Profile loader; defaults to the core's lazy per-type chunks. */
  readonly loadProfile?: (type: EventType) => Promise<Profile>;
}

/** Shown when a profile chunk fails to load, typically offline before it was ever cached. */
const LOAD_ERROR =
  'Could not load the planner for this event type. Check your connection and try again.';

/** Holds and autosaves the one current plan in this browser. */
export class PlanStore {
  /** The calendar day in India; App refreshes it when the page is shown again. */
  today = $state.raw(0);
  current = $state.raw<SavedPlan | null>(null);
  profile = $state.raw<Profile | null>(null);
  error = $state.raw<string | null>(null);
  /** False when the browser refuses to store the plan (blocked, private mode or full). */
  persisted = $state.raw(true);
  /** Kept as its own derived value: progress changes reuse the input object, so the plan is not rebuilt. */
  readonly input = $derived(this.current?.input ?? null);
  readonly plan: Plan | null = $derived.by(() => {
    const { input, profile } = this;
    if (input === null || profile?.type !== input.type) return null;
    return buildPlan(input, planDay(input, this.today), profile);
  });
  readonly #writer: Debounced<[SavedPlan | null]>;
  readonly #storage: Storage | null;
  readonly #newId: () => string;
  readonly #load: (type: EventType) => Promise<Profile>;
  #loading = 0;
  /** Repeats the open, create or edit that last failed to load its planner. */
  #retry: (() => Promise<boolean>) | null = null;

  constructor(options: StoreOptions) {
    this.today = options.today;
    this.#storage = options.storage;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
    this.persisted = options.storage !== null;
    this.#writer = createWriter(options.storage, options.writeDelayMs, (ok) => {
      this.persisted = ok;
    });
    this.#load = options.loadProfile ?? loadProfile;
    this.current = loadPlan(options.storage, options.today);
  }

  /**
   * Loads a type's profile without making it the open plan's profile (the form uses this);
   * null, with `error` set, when the chunk cannot load.
   */
  async fetchProfile(type: EventType): Promise<Profile | null> {
    try {
      const profile = await this.#load(type);
      this.error = null;
      this.#retry = null;
      return profile;
    } catch {
      this.#retry = null;
      this.error = LOAD_ERROR;
      return null;
    }
  }

  /**
   * Makes a type's profile current. Only the latest request wins: an older one that resolves
   * later reports false, so its caller does not open a plan the profile no longer matches.
   */
  async #useProfile(type: EventType): Promise<boolean> {
    const ticket = ++this.#loading;
    if (this.profile?.type === type) {
      this.error = null;
      return true;
    }
    const profile = await this.fetchProfile(type);
    if (profile === null || ticket !== this.#loading) return false;
    this.profile = profile;
    return true;
  }

  #save(plan: SavedPlan | null): void {
    this.current = plan;
    this.#writer.run(plan);
  }

  #updateCurrent(change: (entry: SavedPlan) => SavedPlan): void {
    if (this.current !== null) this.#save(change(this.current));
  }

  /**
   * Loads the saved plan's profile, so the plan shows; false, with `error` set, when the
   * planner cannot load.
   */
  async open(): Promise<boolean> {
    const entry = this.current;
    if (entry === null) return false;
    if (!(await this.#useProfile(entry.input.type))) {
      this.#retry = () => this.open();
      return false;
    }
    return true;
  }

  async create(input: EventInput): Promise<boolean> {
    if (!(await this.#useProfile(input.type))) {
      this.#retry = () => this.create(input);
      return false;
    }
    this.#save({ id: this.#newId(), input, checks: [], vendors: {}, ideas: null });
    return true;
  }

  /**
   * Repeats the open, create or edit whose planner failed to load, so "Try again" retries what
   * the user asked for; null when the last failure was not one of those.
   */
  async retry(): Promise<boolean | null> {
    const again = this.#retry;
    this.#retry = null;
    return again === null ? null : again();
  }

  /** Moves to a new day (the page was left open past midnight); the plan follows. */
  setToday(day: number): void {
    if (day !== this.today) this.today = day;
  }

  clear(): void {
    this.#save(null);
    this.#writer.flush();
  }

  /**
   * Replaces the open plan's details from the form. Ideas are dropped because they described
   * the old event; a change of type also clears progress, whose task and vendor ids differ.
   */
  async edit(input: EventInput): Promise<boolean> {
    const current = this.current;
    if (current === null) return false;
    if (!(await this.#useProfile(input.type))) {
      this.#retry = () => this.edit(input);
      return false;
    }
    const sameType = current.input.type === input.type;
    this.#updateCurrent((entry) => ({
      ...entry,
      input,
      ideas: null,
      checks: sameType ? entry.checks : [],
      vendors: sameType ? entry.vendors : {},
    }));
    return true;
  }

  /** Applies a confirmed assistant change; saved ideas stay only if they still respect the needs. */
  applyChange(patch: PlanPatch): void {
    this.#updateCurrent((entry) => {
      const input = applyPatch(entry.input, patch);
      const { ideas } = entry;
      const keep = ideas !== null && guardIdeas(ideas.ideas, input.constraints).length === 0;
      return { ...entry, input, ideas: keep ? ideas : null };
    });
  }

  setTask(taskId: string, done: boolean): void {
    this.#updateCurrent((entry) => {
      const others = entry.checks.filter((id) => id !== taskId);
      return { ...entry, checks: done ? [...others, taskId] : others };
    });
  }

  setVendorStatus(vendorId: string, status: VendorStatus): void {
    this.#updateCurrent((entry) => ({
      ...entry,
      vendors: { ...entry.vendors, [vendorId]: status },
    }));
  }

  /**
   * Saves generated ideas with the open plan, but only if they were made for its current
   * input: a slow request must not attach ideas to a plan whose needs (or identity) changed.
   */
  setIdeas(ideas: SavedIdeas, forInput: EventInput): void {
    if (this.plan?.input !== forInput) return;
    this.#updateCurrent((entry) => ({ ...entry, ideas }));
  }

  /**
   * Re-reads the saved plan after another tab wrote it. A pending write from this tab is
   * dropped first, so a stale copy never overwrites the newer plan.
   */
  async reload(): Promise<void> {
    this.#writer.cancel();
    this.current = loadPlan(this.#storage, this.today);
    if (this.current !== null) await this.open();
  }

  /** Writes any pending change now (called when the page is hidden). */
  flush(): void {
    this.#writer.flush();
  }
}
