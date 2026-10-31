/** Domain types. Calendar dates are integer day numbers (days since 1970-01-01); see days.ts. */
import type {
  CATEGORY_IDS,
  CITY_TIERS,
  CONSTRAINTS,
  EVENT_TYPES,
  PATCH_FIELDS,
  PHASES,
  SETTINGS,
  STYLE_IDS,
  VENDOR_IDS,
  VENDOR_STATUSES,
  WEDDING_FUNCTIONS,
} from './ids.ts';

/** Wedding, birthday or community event. */
export type EventType = (typeof EVENT_TYPES)[number];
/** Metro, tier-2 city, or town or village. */
export type CityTier = (typeof CITY_TIERS)[number];
/** Indoor, outdoor or mixed. */
export type Setting = (typeof SETTINGS)[number];
/** One of the eight declared needs. */
export type Constraint = (typeof CONSTRAINTS)[number];
/** A wedding function such as mehndi or sangeet. */
export type FunctionId = (typeof WEDDING_FUNCTIONS)[number];
/** Any style id of any event type. */
export type StyleId = (typeof STYLE_IDS)[EventType][number];
/** A budget category id of any event type. */
export type CategoryId = (typeof CATEGORY_IDS)[EventType][number];
/** A vendor id known to the profiles and rules. */
export type VendorId = (typeof VENDOR_IDS)[number];
/** Timeline phase, in display order. */
export type Phase = (typeof PHASES)[number];
/** Vendor progress tracked by the user. */
export type VendorStatus = (typeof VENDOR_STATUSES)[number];
/** Budget feasibility verdict. */
export type Verdict = 'comfortable' | 'tight' | 'unrealistic';
/** Timeline status; `done` marks work the input says is finished (venue booked). */
export type TaskStatus = 'upcoming' | 'late' | 'at-risk' | 'done';
/** Where a generated result came from; the UI labels every generated item with it. */
export type Source = 'gemini' | 'fallback';

/** Everything the user tells Jashn about the event. */
export interface EventInput {
  readonly type: EventType;
  /** A style of this event type. */
  readonly style: StyleId;
  /** Weddings only; always includes the ceremony. */
  readonly functions: readonly FunctionId[];
  /** ISO calendar date, YYYY-MM-DD. */
  readonly date: string;
  readonly startTime: string;
  readonly city: string;
  readonly tier: CityTier;
  readonly setting: Setting;
  readonly venueBooked: boolean;
  readonly invited: number;
  readonly budget: number;
  /** At most two budget categories of this event type. */
  readonly priorities: readonly CategoryId[];
  readonly constraints: readonly Constraint[];
  /** Free text, at most 300 characters; treated as data, never as instructions. */
  readonly note: string;
}

/**
 * An input read from untrusted data before its value rules run: the choice fields are still
 * free text, which validateInput checks against the event type's ids.
 */
export type DraftInput = Omit<EventInput, 'style' | 'functions' | 'priorities'> & {
  readonly style: string;
  readonly functions: readonly string[];
  readonly priorities: readonly string[];
};

/** A field of EventInput. */
export type InputField = keyof EventInput;
/** A field an assistant patch may change. */
export type PatchField = (typeof PATCH_FIELDS)[number];
/** A proposed change to the input; previewed with diffPlans and applied only on confirmation. */
export type PlanPatch = Partial<Pick<EventInput, PatchField>>;

/** Machine-readable reason a field failed validation. */
export type ErrorCode =
  | 'required'
  | 'invalid'
  | 'format'
  | 'too-long'
  | 'too-many'
  | 'too-small'
  | 'too-large'
  | 'not-whole'
  | 'past'
  | 'too-far';

/** One validation problem, shown beside the field and in the error summary. */
export interface FieldError {
  /** The offending field, or `patch` when a patch object itself is malformed. */
  readonly field: InputField | 'patch';
  readonly code: ErrorCode;
  readonly message: string;
}

/** Outcome of validating untrusted input. */
export type InputResult =
  | { readonly ok: true; readonly value: EventInput }
  | { readonly ok: false; readonly errors: readonly FieldError[] };

/** Outcome of validating an untrusted patch against a base input. */
export type PatchResult =
  | { readonly ok: true; readonly patch: PlanPatch; readonly value: EventInput }
  | { readonly ok: false; readonly errors: readonly FieldError[] };

/** Why a derived item exists; every number, task and notice carries one. */
export interface Reason {
  readonly code: string;
  readonly text: string;
}

/** A budget line; `perFunction` splits catering and decor across wedding functions. */
export interface BudgetLine {
  readonly category: string;
  readonly amount: number;
  /** Fraction of the whole budget, 0..1. */
  readonly share: number;
  readonly reasons: readonly Reason[];
  readonly perFunction?: readonly FunctionAmount[];
}

/** A wedding function's slice of a budget line. */
export interface FunctionAmount {
  readonly functionId: string;
  readonly amount: number;
}

/** A suggested saving; trims never apply themselves. */
export interface Trim {
  readonly id: string;
  readonly label: string;
  readonly saves: number;
  readonly reasons: readonly Reason[];
}

/** Whether the budget can carry the expected headcount. */
export interface Feasibility {
  readonly verdict: Verdict;
  readonly perGuest: number;
  readonly floor: number;
  readonly trims: readonly Trim[];
}

/** A dated task on the timeline. */
export interface Task {
  readonly id: string;
  readonly title: string;
  readonly due: number;
  readonly idealDue: number;
  readonly phase: Phase;
  readonly status: TaskStatus;
  readonly vendorId?: string;
  readonly reasons: readonly Reason[];
}

/** A vendor to contact, with its book-by date and questions to ask. */
export interface VendorItem {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly bookBy: number;
  /** The input says it is already booked (the venue only), so its deposit is paid. */
  readonly booked: boolean;
  readonly depositShare: number;
  readonly lineShare?: number;
  readonly questions: readonly string[];
  readonly reasons: readonly Reason[];
}

/** A scheduled vendor payment. */
export interface Payment {
  readonly vendorId: string;
  readonly kind: 'deposit' | 'balance';
  readonly due: number;
  readonly amount: number;
}

/** One slot on the day-of run sheet; times are local HH:MM. */
export interface RunSheetSlot {
  readonly day: number;
  readonly start: string;
  readonly end: string;
  readonly title: string;
  readonly owner: string;
}

/** The complete deterministic plan for one input on one day. */
export interface Plan {
  readonly input: EventInput;
  readonly today: number;
  readonly daysToGo: number;
  readonly expected: number;
  readonly volunteers: number;
  readonly budget: readonly BudgetLine[];
  readonly contingency: number;
  readonly feasibility: Feasibility;
  readonly tasks: readonly Task[];
  readonly vendors: readonly VendorItem[];
  readonly payments: readonly Payment[];
  readonly runSheet: readonly RunSheetSlot[];
  readonly topActions: readonly Task[];
  readonly notices: readonly Reason[];
}

/** A before and after pair in a plan diff. */
export interface Change<T> {
  readonly before: T;
  readonly after: T;
}

/** Differences between two plans, previewed before a patch is applied. */
export interface PlanDiff {
  readonly expected: Change<number>;
  readonly verdict: Change<Verdict>;
  /** Only changed lines; a missing side is zero. */
  readonly budget: readonly (Change<number> & { readonly category: string })[];
  readonly newlyLate: readonly Task[];
}

/** Catalogue entry condition: every listed key must match, an absent key matches anything. */
export interface Applicability {
  readonly styles?: readonly StyleId[];
  readonly functions?: readonly FunctionId[];
  readonly anyConstraint?: readonly Constraint[];
  readonly noConstraint?: readonly Constraint[];
  readonly settings?: readonly Setting[];
}

/** A catalogue task, scheduled backwards from the event day. */
export interface TaskTemplate {
  readonly id: string;
  readonly title: string;
  /** Days before the event it should ideally be done; negative means after the event. */
  readonly leadDays: number;
  readonly after?: string;
  readonly vendorId?: VendorId;
  readonly appliesWhen?: Applicability;
  /** Latest number of days before the event the task can still realistically happen (default 0). */
  readonly minLead?: number;
}

/** A catalogue vendor; it appears when its `appliesWhen` matches. */
export interface VendorTemplate {
  readonly id: VendorId;
  readonly label: string;
  readonly category: CategoryId;
  /** Id of the timeline task that books this vendor; its due day is the book-by date. */
  readonly taskId: string;
  /** Typical deposit as a fraction of the vendor's line, 0..1. */
  readonly depositShare: number;
  /** Share of a line that also buys other things; vendors without it split the rest evenly. */
  readonly lineShare?: number;
  readonly questions: readonly string[];
  readonly appliesWhen?: Applicability;
}

/** A run-sheet slot relative to the start time. */
export interface SlotTemplate {
  /** Minutes from the start time; negative for set-up before it. */
  readonly offsetMin: number;
  readonly durationMin: number;
  readonly title: string;
  readonly owner: string;
}

/** A budget adjustment in percentage points of the whole budget. */
export interface CategoryPoints {
  readonly category: CategoryId;
  readonly points: number;
}

/** A style of event within a type, with its start time and run sheet. */
export interface StyleDef {
  readonly id: StyleId;
  readonly label: string;
  readonly startTime: string;
  /** Walk-in multiplier on expected headcount (community styles); 1 otherwise. */
  readonly walkIn: number;
  readonly deltas: readonly CategoryPoints[];
  readonly runSheet: readonly SlotTemplate[];
}

/** A wedding function, its share of guests and its own run sheet. */
export interface FunctionDef {
  readonly id: FunctionId;
  readonly label: string;
  /** Share of expected guests who attend, used to split catering and decor. */
  readonly guestShare: number;
  /** Minutes after midnight on the function's own day, so a haldi stays a morning event. */
  readonly anchorMin: number;
  readonly runSheet: readonly SlotTemplate[];
}

interface CategoryDef {
  readonly id: CategoryId;
  readonly label: string;
  readonly weight: number;
}

/** Everything the engine needs to know about one event type. */
export interface Profile {
  readonly type: EventType;
  readonly label: string;
  readonly styles: readonly StyleDef[];
  readonly functions: readonly FunctionDef[];
  /** Base weights sum to 90; the remaining 10 is contingency. */
  readonly categories: readonly CategoryDef[];
  readonly turnout: number;
  /** Modest cost floor in rupees per expected guest, by city tier. */
  readonly floors: Readonly<Record<CityTier, number>>;
  /** Below this many days to go the plan switches to short-notice mode. */
  readonly minLeadDays: number;
  readonly tasks: readonly TaskTemplate[];
  readonly vendors: readonly VendorTemplate[];
}
