/**
 * App state: the saved plans, which one is open, its event type's profile and the plan built
 * from them. The plan is computed in the browser by the core, so it needs no network and is
 * identical with or without the API. State is replaced immutably, which keeps every saved
 * entry plain JSON and lets `$derived` skip work when nothing it reads has changed.
 */
import {
  applyPatch,
  buildPlan,
  canonicalKey,
  guardIdeas,
  loadProfile,
  type EventInput,
  type EventType,
  type Plan,
  type PlanPatch,
  type Profile,
  type VendorStatus,
} from '@jashn/core';
import {
  MAX_PLANS,
  createWriter,
  planDay,
  readPlans,
  type PlanWriter,
  type SavedIdeas,
  type SavedPlan,
} from './storage.ts';

/** Construction options; the clock and id source are injectable for tests. */
export interface StoreOptions {
  readonly storage: Storage | null;
  readonly today: number;
  readonly now?: () => number;
  readonly newId?: () => string;
  readonly writeDelayMs?: number;
  /** Profile loader; defaults to the core's lazy per-type chunks. */
  readonly loadProfile?: (type: EventType) => Promise<Profile>;
}

/** Shown when a profile chunk fails to load, typically offline before it was ever cached. */
const LOAD_ERROR =
  'Could not load the planner for this event type. Check your connection and try again.';

/** Shown when every saved plan has progress, so none can make way for a new one. */
const FULL_ERROR = `All ${String(MAX_PLANS)} saved plans have progress. Delete one you no longer need to make room.`;

/** Plans with ticked tasks or vendor progress are never dropped to make room. */
function hasProgress(entry: SavedPlan): boolean {
  return entry.checks.length > 0 || Object.keys(entry.vendors).length > 0;
}

/**
 * The list with room for one more plan: as it is when below the limit, otherwise without its
 * oldest plan that has no progress; null when every plan has progress.
 */
function withRoom(plans: readonly SavedPlan[]): readonly SavedPlan[] | null {
  if (plans.length < MAX_PLANS) return plans;
  const index = plans.map(hasProgress).lastIndexOf(false);
  return index === -1 ? null : plans.filter((_, at) => at !== index);
}

/** Holds and persists every plan in this browser. */
export class PlanStore {
  /** The calendar day in India; App refreshes it when the page is shown again. */
  today = $state.raw(0);
  plans = $state.raw<readonly SavedPlan[]>([]);
  currentId = $state.raw<string | null>(null);
  profile = $state.raw<Profile | null>(null);
  error = $state.raw<string | null>(null);
  /** False when the browser refuses to store plans (blocked, private mode or full). */
  persisted = $state.raw(true);
  readonly current = $derived(this.plans.find((entry) => entry.id === this.currentId) ?? null);
  /** Kept as its own derived value: progress changes reuse the input object, so the plan is not rebuilt. */
  readonly input = $derived(this.current?.input ?? null);
  readonly plan: Plan | null = $derived.by(() => {
    const { input, profile } = this;
    if (input === null || profile?.type !== input.type) return null;
    return buildPlan(input, planDay(input, this.today), profile);
  });
  readonly #writer: PlanWriter;
  readonly #storage: Storage | null;
  readonly #now: () => number;
  readonly #newId: () => string;
  readonly #load: (type: EventType) => Promise<Profile>;
  #loading = 0;
  /** Repeats the open, create or edit that last failed to load its planner. */
  #retry: (() => Promise<boolean>) | null = null;

  constructor(options: StoreOptions) {
    this.today = options.today;
    this.#storage = options.storage;
    this.#now = options.now ?? Date.now;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
    this.persisted = options.storage !== null;
    this.#writer = createWriter(options.storage, options.writeDelayMs, (ok) => {
      this.persisted = ok;
    });
    this.#load = options.loadProfile ?? loadProfile;
    this.plans = readPlans(options.storage, options.today);
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

  #save(plans: readonly SavedPlan[]): void {
    this.plans = plans;
    this.#writer.schedule(plans);
  }

  /** Replaces the open entry and moves it to the front, the list being newest first. */
  #updateCurrent(change: (entry: SavedPlan) => SavedPlan): void {
    const entry = this.current;
    if (entry === null) return;
    const next = { ...change(entry), updated: this.#now() };
    this.#save([next, ...this.plans.filter((candidate) => candidate.id !== entry.id)]);
  }

  /**
   * Saves a new plan for a validated input and opens it. The same event (a sample picked again,
   * a share link opened twice) opens its existing plan instead of adding a copy. At the limit,
   * the oldest plan without progress makes way; when every plan has progress, nothing is
   * dropped and `error` says why.
   */
  async create(input: EventInput): Promise<string | null> {
    const key = canonicalKey(input);
    const same = this.plans.find((entry) => canonicalKey(entry.input) === key);
    if (same !== undefined) return (await this.open(same.id)) ? same.id : null;
    const room = withRoom(this.plans);
    if (room === null) {
      this.error = FULL_ERROR;
      return null;
    }
    if (!(await this.#useProfile(input.type))) {
      this.#retry = async () => (await this.create(input)) !== null;
      return null;
    }
    const entry: SavedPlan = {
      id: this.#newId(),
      input,
      checks: [],
      vendors: {},
      ideas: null,
      updated: this.#now(),
    };
    this.#save([entry, ...room]);
    this.currentId = entry.id;
    return entry.id;
  }

  /** Opens a saved plan once its type's profile is loaded. */
  async open(id: string): Promise<boolean> {
    const entry = this.plans.find((candidate) => candidate.id === id);
    if (entry === undefined) return false;
    if (!(await this.#useProfile(entry.input.type))) {
      this.#retry = () => this.open(id);
      return false;
    }
    this.currentId = id;
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

  /** Moves to a new day (the page was left open past midnight); every plan follows. */
  setToday(day: number): void {
    if (day !== this.today) this.today = day;
  }

  /**
   * Re-reads the plans another tab saved, so this tab never writes a stale copy over them. A
   * pending write from this tab is dropped (the other tab's newer save wins), and the open
   * plan closes only if the other tab deleted it.
   */
  reload(): void {
    this.#writer.cancel();
    this.plans = readPlans(this.#storage, this.today);
    if (!this.plans.some((entry) => entry.id === this.currentId)) this.currentId = null;
  }

  /** Back to the start screen. */
  close(): void {
    this.currentId = null;
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

  /** Ticks or unticks a task. */
  setTask(taskId: string, done: boolean): void {
    this.#updateCurrent((entry) => {
      const others = entry.checks.filter((id) => id !== taskId);
      return { ...entry, checks: done ? [...others, taskId] : others };
    });
  }

  /** Records a vendor's progress. */
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

  /** Deletes one plan and writes immediately, since deleting is a deliberate act. */
  remove(id: string): void {
    if (this.currentId === id) this.currentId = null;
    this.#save(this.plans.filter((entry) => entry.id !== id));
    this.#writer.flush();
  }

  /** Deletes every saved plan from this browser. */
  clearAll(): void {
    this.currentId = null;
    this.#save([]);
    this.#writer.flush();
  }

  /** Writes any pending change now (called when the page is hidden). */
  flush(): void {
    this.#writer.flush();
  }
}
