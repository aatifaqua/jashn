/**
 * Closed id lists shared by the input validator, the profiles and the UI. The domain types in
 * types.ts are derived from these tuples, so a list and its type can never drift apart.
 */

/** The three kinds of event Jashn plans. */
export const EVENT_TYPES = ['wedding', 'birthday', 'community'] as const;

/** City tiers; they capture the main cost difference between places in India. */
export const CITY_TIERS = ['metro', 'tier2', 'town'] as const;

/** Where the event happens; outdoor and mixed settings trigger weather rules. */
export const SETTINGS = ['indoor', 'outdoor', 'mixed'] as const;

/** Needs the user can declare; each one changes the plan through a contextual rule. */
export const CONSTRAINTS = [
  'vegetarian',
  'jain',
  'halal',
  'alcohol-free',
  'kid-friendly',
  'step-free',
  'eco-friendly',
  'budget-strict',
] as const;

/** Wedding functions in the order they usually happen; the ceremony is always included. */
export const WEDDING_FUNCTIONS = ['haldi', 'mehndi', 'sangeet', 'ceremony', 'reception'] as const;

/** Style ids per event type; each profile defines exactly these styles. */
export const STYLE_IDS = {
  wedding: ['traditional', 'intimate', 'destination'],
  birthday: ['kids', 'milestone', 'adult'],
  community: ['festival', 'fundraiser', 'meetup', 'clean-up'],
} as const;

/**
 * Budget category ids per event type. These are also the choices offered as priorities.
 * `bar` has no base weight; it exists so styles can fund it and the alcohol-free rule can
 * remove it.
 */
export const CATEGORY_IDS = {
  wedding: [
    'venue',
    'catering',
    'decor',
    'photography',
    'attire',
    'entertainment',
    'invitations',
    'gifts',
    'travel',
    'bar',
  ],
  birthday: [
    'venue',
    'food',
    'decor',
    'entertainment',
    'photography',
    'invitations',
    'return-gifts',
    'bar',
  ],
  community: [
    'venue',
    'food',
    'infrastructure',
    'programme',
    'publicity',
    'safety',
    'sanitation',
    'volunteer-kit',
  ],
} as const;

/**
 * Vendor ids shared by the profiles (which define the vendors) and the rules (which add
 * questions to or remove vendors by id). Add an id here before using it anywhere.
 */
export const VENDOR_IDS = [
  'venue',
  'caterer',
  'decorator',
  'photographer',
  'makeup-artist',
  'mehndi-artist',
  'dj',
  'bartender',
  'officiant',
  'printer',
  'baker',
  'entertainer',
  'tent-sound',
  'sanitation',
] as const;

/** Timeline phases in display order (section 6.5 of the design). */
export const PHASES = [
  'do-now',
  'months-out',
  'weeks-out',
  'final-fortnight',
  'day-of',
  'after',
] as const;

/** Vendor progress the user tracks in the browser, in order. */
export const VENDOR_STATUSES = ['to-contact', 'quoted', 'booked', 'paid'] as const;

/** Fields an assistant or the user may change through a PlanPatch; the event type is fixed. */
export const PATCH_FIELDS = [
  'date',
  'startTime',
  'invited',
  'budget',
  'priorities',
  'constraints',
  'setting',
  'tier',
  'functions',
  'style',
] as const;
