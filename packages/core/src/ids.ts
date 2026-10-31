// Closed id lists; types.ts derives its types from them, so the two never drift apart.

/** The three kinds of event Jashn plans. */
export const EVENT_TYPES = ['wedding', 'birthday', 'community'] as const;

/** City tiers; they capture the main cost difference between places in India. */
export const CITY_TIERS = ['metro', 'tier2', 'town'] as const;

/** Where the event happens; outdoor and mixed settings trigger weather rules. */
export const SETTINGS = ['indoor', 'outdoor', 'mixed'] as const;

/** Needs the user can declare; each one changes the plan through a rule. */
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

/** Style ids per event type; each profile defines exactly these. */
export const STYLE_IDS = {
  wedding: ['traditional', 'intimate', 'destination'],
  birthday: ['kids', 'milestone', 'adult'],
  community: ['festival', 'fundraiser', 'meetup', 'clean-up'],
} as const;

/** Budget categories per type; `bar` has no base weight so the alcohol-free rule can drop it. */
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

/** Vendor ids shared by profiles and rules; add an id here before using it anywhere. */
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

/** Timeline phases in display order. */
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
