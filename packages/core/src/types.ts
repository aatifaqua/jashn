/**
 * Domain types shared by the core, the server and the web app. Calendar dates are integer day
 * numbers (days since 1970-01-01) so scheduling is plain integer arithmetic; see days.ts.
 */
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
/** Metro, tier-2 city, or town/village. */
export type CityTier = (typeof CITY_TIERS)[number];
/** Indoor, outdoor or mixed. */
export type Setting = (typeof SETTINGS)[number];
/** One of the eight declared needs. */
export type Constraint = (typeof CONSTRAINTS)[number];
/** A wedding function such as mehndi or sangeet. */
export type FunctionId = (typeof WEDDING_FUNCTIONS)[number];
/** Any style id of any event type. */
export type StyleId = (typeof STYLE_IDS)[EventType][number];
/** Any budget category id of any event type. */
export type CategoryId = (typeof CATEGORY_IDS)[EventType][number];
/** A vendor id known to the profiles and rules. */
export type VendorId = (typeof VENDOR_IDS)[number];
/** Timeline phase, in display order. */
export type Phase = (typeof PHASES)[number];
/** Vendor progress tracked by the user. */
export type VendorStatus = (typeof VENDOR_STATUSES)[number];
/** Budget feasibility verdict. */
export type Verdict = 'comfortable' | 'tight' | 'unrealistic';
/** Timeline status; `done` marks work the input says is already finished (venue booked). */
export type TaskStatus = 'upcoming' | 'late' | 'at-risk' | 'done';
/** Where a generated result came from; the UI labels every generated item with it. */
export type Source = 'gemini' | 'fallback';

/** Everything the user tells Jashn about the event (design section 5). */
export interface EventInput {
  readonly type: EventType;
  /** Style id from the type's profile. */
  readonly style: string;
  /** Wedding functions; always empty for other types. */
  readonly functions: readonly string[];
  /** ISO calendar date, YYYY-MM-DD. */
  readonly date: string;
  /** Local wall-clock start, HH:MM. */
  readonly startTime: string;
  /** Used only to personalise ideas. */
  readonly city: string;
  readonly tier: CityTier;
  readonly setting: Setting;
  readonly venueBooked: boolean;
  /** Invited guests, a whole number. */
  readonly invited: number;
  /** Whole rupees. */
  readonly budget: number;
  /** At most two budget category ids. */
  readonly priorities: readonly string[];
  readonly constraints: readonly Constraint[];
  /** Free text, at most 300 characters; treated as data, never as instructions. */
  readonly note: string;
}

/** A field of EventInput. */
export type InputField = keyof EventInput;
/** A field a PlanPatch may change. */
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

/** One validation problem, shown inline beside the field and in the error summary. */
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

/** Why a derived item exists; every number, task and notice carries at least one. */
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
  /** The input says this vendor is already booked (today the venue only); its deposit is paid. */
  readonly booked: boolean;
  /** Deposit as a fraction of the vendor's budget line, 0..1. */
  readonly depositShare: number;
  /** Fraction of its budget line the vendor is paid, when the line also buys other things. */
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
  /** Volunteers needed; zero for weddings and birthdays. */
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

/** A before/after pair in a plan diff. */
export interface Change<T> {
  readonly before: T;
  readonly after: T;
}

/** User-facing differences between two plans, shown before a patch is applied. */
export interface PlanDiff {
  readonly expected: Change<number>;
  readonly verdict: Change<Verdict>;
  /** Only the lines whose amount changed; a missing side is zero. */
  readonly budget: readonly (Change<number> & { readonly category: string })[];
  readonly newlyLate: readonly Task[];
}

export type * from './profile-types.ts';
export type * from './engine-types.ts';
