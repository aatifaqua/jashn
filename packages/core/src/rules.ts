/**
 * The contextual rules table (design 6.2). A rule fires on facts from the context and input
 * and carries a reason naming the input that triggered it; later stages read the effects of
 * the fired rules, so every adjustment in the plan can explain itself.
 */
import { SAFETY_THRESHOLDS } from './attendance.ts';
import { deepFreeze } from './profiles/freeze.ts';
import { slot } from './profiles/slot.ts';
import { NEED_RULES } from './rules-needs.ts';
import { countWord, formatCount, formatDay, weekdayName } from './text.ts';
import type { EventContext, EventInput, Reason, Rule, RuleEffects } from './types.ts';

/** A rule that fired for one plan, with its reason already worded for this input. */
export interface FiredRule {
  readonly id: string;
  readonly reason: Reason;
  readonly effects: RuleEffects;
}

/** Lead time that puts a task before today whenever an event is short notice (max minimum). */
const ALREADY_DUE = 90;
const SUMMER_HEAT_UNTIL = 17 * 60;
const CHECK_LOCAL = '(check local rules)';

const on = (ctx: EventContext): string => formatDay(ctx.eventDay);

/** Rules on season, calendar and lead time, in the order of the design's rules table. */
const CALENDAR_RULES: readonly Rule[] = [
  {
    id: 'peak-season',
    when: (ctx, input) => input.type === 'wedding' && ctx.season.peakWedding,
    reason: (ctx) => ({
      code: 'peak-season',
      text: `Your date, ${on(ctx)}, is in peak wedding season (November to February).`,
    }),
    effects: {
      leadFactor: { vendorIds: ['venue', 'caterer', 'photographer'], factor: 1.25 },
      notices: [
        {
          code: 'peak-prices',
          text: 'Prices run higher in peak season; ask for off-peak or weekday rates.',
        },
      ],
    },
  },
  {
    id: 'monsoon-outdoor',
    when: (ctx) => ctx.season.monsoon && ctx.flags.outdoor,
    reason: (ctx, input) => ({
      code: 'monsoon-outdoor',
      text: `Your ${input.setting} event on ${on(ctx)} falls in the monsoon (June to September).`,
    }),
    effects: {
      tasks: [
        { id: 'rain-cover', title: 'Book rain cover or a backup hall', leadDays: 30, minLead: 3 },
      ],
      // Community events pay for cover from infrastructure, the others from decor; no profile
      // has both categories, so exactly one line gains the four points.
      budget: [
        { kind: 'add', category: 'infrastructure', points: 4 },
        { kind: 'add', category: 'decor', points: 4 },
      ],
      slots: [slot(-240, 15, 'Rain check: confirm cover or move to the backup hall', 'Organiser')],
    },
  },
  {
    id: 'summer-outdoor',
    when: (ctx, input) =>
      ctx.season.summer && input.setting === 'outdoor' && ctx.startMinutes < SUMMER_HEAT_UNTIL,
    reason: (ctx, input) => ({
      code: 'summer-outdoor',
      text: `Your outdoor event starts at ${input.startTime} on ${on(ctx)}, in the summer heat.`,
    }),
    effects: {
      tasks: [
        {
          id: 'shade-water',
          title: 'Arrange shade, fans and a drinking-water station',
          leadDays: 14,
          minLead: 2,
        },
      ],
      slots: [slot(60, 15, 'Hydration round: water and ORS for guests and staff', 'Volunteer')],
    },
  },
  {
    id: 'weekday',
    when: (ctx) => ctx.midweek,
    reason: (ctx) => ({
      code: 'weekday',
      text: `${on(ctx)} is a ${weekdayName(ctx.eventDay)}; venues are often cheaper midweek.`,
    }),
    effects: {
      notices: [{ code: 'weekday-rate', text: 'Ask each venue for its weekday rate.' }],
    },
  },
  {
    id: 'short-notice',
    when: (ctx) => ctx.flags.shortNotice,
    reason: (ctx, input) => ({
      code: 'short-notice',
      text: `Only ${countWord(ctx.daysToGo, 'day', 'days')} to go for this ${input.type}, so bookings are compressed.`,
    }),
    effects: {
      tasks: [{ id: 'lock-venue', title: 'Lock the venue today', leadDays: ALREADY_DUE }],
      pinTasks: ['lock-venue'],
      notices: [
        {
          code: 'compressed',
          text: 'Short notice: book the venue first, then the caterer, then everything else.',
        },
      ],
    },
  },
];

/** Rules on crowd size and bookings already made. */
const CROWD_RULES: readonly Rule[] = [
  {
    id: 'large-crowd',
    when: (ctx) => ctx.flags.largeCrowd,
    reason: (ctx) => ({
      code: 'large-crowd',
      text: `About ${formatCount(ctx.expected)} guests are expected (${formatCount(SAFETY_THRESHOLDS.largeCrowd)} or more).`,
    }),
    effects: {
      tasks: [
        {
          id: 'first-aid',
          title: 'Set up a first-aid station with a trained person',
          leadDays: 7,
          minLead: 1,
        },
      ],
    },
  },
  {
    id: 'ambulance',
    when: (ctx) => ctx.expected >= SAFETY_THRESHOLDS.ambulance,
    reason: (ctx) => ({
      code: 'ambulance',
      text: `About ${formatCount(ctx.expected)} people are expected (${formatCount(SAFETY_THRESHOLDS.ambulance)} or more).`,
    }),
    effects: {
      tasks: [
        { id: 'ambulance', title: 'Arrange an ambulance on standby', leadDays: 14, minLead: 2 },
      ],
    },
  },
  {
    id: 'public-gathering',
    when: (ctx) => ctx.flags.publicGathering,
    reason: (ctx, input) => ({
      code: 'public-gathering',
      text: `A ${input.setting} community event for about ${formatCount(ctx.expected)} people needs permissions; rules vary by city.`,
    }),
    effects: {
      tasks: [
        {
          id: 'permit-police',
          title: `Inform the local police and request permission ${CHECK_LOCAL}`,
          leadDays: 30,
          minLead: 7,
        },
        {
          id: 'permit-municipal',
          title: `Get municipal permission for the site ${CHECK_LOCAL}`,
          leadDays: 30,
          minLead: 7,
        },
        {
          id: 'permit-loudspeaker',
          title: `Apply for loudspeaker permission ${CHECK_LOCAL}`,
          leadDays: 21,
          minLead: 5,
        },
        {
          id: 'permit-fire',
          title: `Get fire-safety clearance for tents ${CHECK_LOCAL}`,
          leadDays: 21,
          minLead: 5,
          appliesWhen: { settings: ['outdoor', 'mixed'] },
        },
      ],
    },
  },
  {
    id: 'venue-booked',
    when: (_ctx, input) => input.venueBooked,
    reason: () => ({ code: 'venue-booked', text: 'You said the venue is already booked.' }),
    effects: { completeTasks: ['book-venue', 'lock-venue'] },
  },
];

/**
 * Every rule in table order, deep-frozen at module load so no plan can alter another's rules.
 * Order matters only for budget effects, which apply in this sequence.
 */
export const RULES: readonly Rule[] = deepFreeze([
  ...CALENDAR_RULES,
  ...NEED_RULES,
  ...CROWD_RULES,
]);

/**
 * The rules that apply to this input, each with its reason worded for it. One pass over the
 * table; later stages read effects from this list instead of re-testing conditions.
 */
export function fireRules(ctx: EventContext, input: EventInput): FiredRule[] {
  const fired: FiredRule[] = [];
  for (const rule of RULES) {
    if (rule.when(ctx, input)) {
      fired.push({ id: rule.id, reason: rule.reason(ctx, input), effects: rule.effects });
    }
  }
  return fired;
}
