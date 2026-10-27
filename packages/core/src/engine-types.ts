/** Types for the decision engine's context and rules (6.1, 6.2) and for generated content (7). */
import type { CategoryPoints, SlotTemplate, TaskTemplate } from './profile-types.ts';
import type { EventInput, PlanPatch, Reason, Source, VendorId } from './types.ts';

/** Facts derived once per plan from the input and today (design section 6.1). */
export interface EventContext {
  readonly today: number;
  readonly eventDay: number;
  readonly daysToGo: number;
  /** 0 = Sunday … 6 = Saturday. */
  readonly weekday: number;
  /** Monday to Thursday, when venues are often cheaper. */
  readonly midweek: boolean;
  /** 1 = January … 12 = December. */
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
  /** Start time in minutes after midnight. */
  readonly startMinutes: number;
  readonly flags: {
    /** Setting is outdoor or mixed. */
    readonly outdoor: boolean;
    /** At least 200 expected. */
    readonly largeCrowd: boolean;
    /** Community event that is outdoor or expects at least 500. */
    readonly publicGathering: boolean;
    /** Fewer days to go than the type's minimum lead time. */
    readonly shortNotice: boolean;
  };
}

/** A budget change made by a rule; effects naming a category the profile lacks are ignored. */
export type BudgetEffect =
  | ({ readonly kind: 'add' } & CategoryPoints)
  | {
      readonly kind: 'move';
      readonly from: CategoryPoints['category'];
      readonly to: CategoryPoints['category'];
      /** Fraction of the source line moved, 0..1. */
      readonly fraction: number;
    }
  | { readonly kind: 'remove'; readonly category: CategoryPoints['category'] };

/** A question to add to a vendor's list. */
export interface VendorQuestion {
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
  /** Task ids the input says are already done. */
  readonly completeTasks?: readonly string[];
  /** Task ids promoted to the front of the top actions. */
  readonly pinTasks?: readonly string[];
  /** Show trims even when the verdict is comfortable. */
  readonly alwaysTrim?: boolean;
}

/** A contextual rule: when it applies, why, and what it changes (design section 6.2). */
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

/** Personalised ideas for the event (POST /api/ideas). */
export interface Ideas {
  readonly theme: {
    readonly name: string;
    readonly palette: readonly string[];
    readonly why: string;
  };
  /** Three decor ideas. */
  readonly decor: readonly IdeaItem[];
  /** Three to five menu items that respect the declared diet. */
  readonly menu: readonly IdeaItem[];
  /** Three activities. */
  readonly activities: readonly IdeaItem[];
  /** One guest-experience touch. */
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
