/**
 * Shapes of the per-event-type profile tables (design section 6). Profiles are frozen data
 * with no functions, so every catalogue entry is plain, serialisable and easy to tune.
 */
import type {
  CategoryId,
  CityTier,
  Constraint,
  EventType,
  FunctionId,
  Setting,
  StyleId,
  VendorId,
} from './types.ts';

/**
 * Declarative condition for a catalogue entry. Every listed key must match; an absent key
 * matches anything. Data rather than a predicate keeps profiles serialisable and testable.
 */
export interface Applicability {
  /** Input style is one of these. */
  readonly styles?: readonly StyleId[];
  /** At least one of these wedding functions is chosen. */
  readonly functions?: readonly FunctionId[];
  /** At least one of these constraints is declared. */
  readonly anyConstraint?: readonly Constraint[];
  /** None of these constraints is declared. */
  readonly noConstraint?: readonly Constraint[];
  /** Input setting is one of these. */
  readonly settings?: readonly Setting[];
}

/** A task in a profile catalogue, scheduled backwards from the event day. */
export interface TaskTemplate {
  readonly id: string;
  readonly title: string;
  /** Days before the event it should ideally be done; negative means after the event. */
  readonly leadDays: number;
  /** Task id that must be done first. */
  readonly after?: string;
  readonly vendorId?: VendorId;
  readonly appliesWhen?: Applicability;
  /** Latest number of days before the event the task can still realistically happen (default 0). */
  readonly minLead?: number;
}

/** A vendor in a profile catalogue. */
export interface VendorTemplate {
  readonly id: VendorId;
  readonly label: string;
  /** Budget category whose line pays this vendor. */
  readonly category: CategoryId;
  /** Id of the timeline task that books this vendor; its due day is the book-by date. */
  readonly taskId: string;
  /** Typical deposit as a fraction of the vendor's line, 0..1. */
  readonly depositShare: number;
  /**
   * Fraction of the budget line this vendor is paid, for a line that also buys other things
   * (the attire line pays for outfits as well as the make-up artist). Vendors without it split
   * what the others leave evenly; the shares on one line add up to at most 1.
   */
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

/** A style of event within a type. */
export interface StyleDef {
  readonly id: StyleId;
  readonly label: string;
  /** Default start time, HH:MM. */
  readonly startTime: string;
  /** Walk-in multiplier on expected headcount (community styles); 1 otherwise. */
  readonly walkIn: number;
  readonly deltas: readonly CategoryPoints[];
  readonly runSheet: readonly SlotTemplate[];
}

/** A wedding function. */
export interface FunctionDef {
  readonly id: FunctionId;
  readonly label: string;
  /** Share of expected guests who attend, used to split catering and decor. */
  readonly guestShare: number;
  /**
   * Customary start as minutes after midnight; the run sheet's offsets count from it on the
   * function's own day, so a haldi stays a morning event whatever time the ceremony starts.
   */
  readonly anchorMin: number;
  readonly runSheet: readonly SlotTemplate[];
}

/** A budget category with its base weight in percentage points. */
export interface CategoryDef {
  readonly id: CategoryId;
  readonly label: string;
  readonly weight: number;
}

/** Everything the engine needs to know about one event type. */
export interface Profile {
  readonly type: EventType;
  readonly label: string;
  readonly styles: readonly StyleDef[];
  /** Wedding functions; empty for other types. */
  readonly functions: readonly FunctionDef[];
  /** Base weights summing to 90; the remaining 10 is contingency. Also the priority choices. */
  readonly categories: readonly CategoryDef[];
  /** Fraction of invited guests expected to attend before the walk-in factor. */
  readonly turnout: number;
  /** Modest cost floor in rupees per expected guest, by city tier. */
  readonly floors: Readonly<Record<CityTier, number>>;
  /** Below this many days to go the plan switches to short-notice mode. */
  readonly minLeadDays: number;
  readonly tasks: readonly TaskTemplate[];
  readonly vendors: readonly VendorTemplate[];
}
