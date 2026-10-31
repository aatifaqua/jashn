/** Types for the engine's context and rules, and for generated content. */
import type {
  CategoryId,
  CategoryPoints,
  EventInput,
  PlanPatch,
  Reason,
  SlotTemplate,
  Source,
  TaskTemplate,
  VendorId,
} from './types.ts';

/** Facts derived once per plan from the input and today. */
export interface EventContext {
  readonly today: number;
  readonly eventDay: number;
  readonly daysToGo: number;
  readonly weekday: number;
  /** Monday to Thursday, when venues are often cheaper. */
  readonly midweek: boolean;
  readonly month: number;
  readonly season: {
    /** November to February. */
    readonly peakWedding: boolean;
    /** June to September. */
    readonly monsoon: boolean;
    /** April to June. */
    readonly summer: boolean;
  };
  /** Calendar days the event spans; above 1 only for multi-function weddings. */
  readonly spanDays: number;
  readonly expected: number;
  readonly startMinutes: number;
  readonly flags: {
    readonly outdoor: boolean;
    /** At least 200 expected. */
    readonly largeCrowd: boolean;
    /** Community event that is outdoor or expects at least 500. */
    readonly publicGathering: boolean;
    readonly shortNotice: boolean;
  };
}

/** A budget change made by a rule; effects naming a category the profile lacks are ignored. */
export type BudgetEffect =
  | ({ readonly kind: 'add' } & CategoryPoints)
  | {
      /** Adds the points to the first of `categories` the profile has, and to no other. */
      readonly kind: 'add-first';
      readonly categories: readonly CategoryId[];
      readonly points: number;
    }
  | {
      readonly kind: 'move';
      readonly from: CategoryId;
      readonly to: CategoryId;
      /** Fraction of the source line moved, 0..1. */
      readonly fraction: number;
    }
  | { readonly kind: 'remove'; readonly category: CategoryId };

interface VendorQuestion {
  readonly vendorId: VendorId;
  readonly text: string;
}

/** What a rule changes when it fires; every effect carries the rule's reason. */
export interface RuleEffects {
  readonly tasks?: readonly TaskTemplate[];
  readonly questions?: readonly VendorQuestion[];
  readonly budget?: readonly BudgetEffect[];
  readonly removeVendors?: readonly VendorId[];
  readonly slots?: readonly SlotTemplate[];
  readonly notices?: readonly Reason[];
  /** Multiplies lead days of the booking tasks of these vendors. */
  readonly leadFactor?: { readonly vendorIds: readonly VendorId[]; readonly factor: number };
  /** Contingency as a fraction of the budget, replacing the default 0.10. */
  readonly contingency?: number;
  readonly completeTasks?: readonly string[];
  readonly pinTasks?: readonly string[];
  readonly alwaysTrim?: boolean;
}

/** A contextual rule: when it applies, why, and what it changes. */
export interface Rule {
  readonly id: string;
  readonly when: (ctx: EventContext, input: EventInput) => boolean;
  /** The reason shown to the user, naming the input that triggered the rule. */
  readonly reason: (ctx: EventContext, input: EventInput) => Reason;
  readonly effects: RuleEffects;
}

/** A short titled suggestion in generated ideas. */
export interface IdeaItem {
  readonly title: string;
  readonly detail: string;
}

/** Personalised ideas for the event, from Gemini or the offline set. */
export interface Ideas {
  readonly theme: {
    readonly name: string;
    readonly palette: readonly string[];
    readonly why: string;
  };
  readonly decor: readonly IdeaItem[];
  /** Three to five menu items that respect the declared diet. */
  readonly menu: readonly IdeaItem[];
  readonly activities: readonly IdeaItem[];
  readonly touch: IdeaItem;
  readonly invitation: string;
}

/** One earlier turn of the assistant conversation. */
export interface AssistTurn {
  readonly role: 'user' | 'assistant';
  readonly text: string;
}

/** The assistant's answer, optionally proposing a validated change to the input. */
export interface AssistReply {
  readonly reply: string;
  readonly patch?: PlanPatch;
}

/** A vendor enquiry message the user copies and sends themselves. */
export interface Draft {
  readonly vendorId: string;
  readonly text: string;
}

/** A generated result labelled with where it came from. */
export type Sourced<T> = T & { readonly source: Source };
