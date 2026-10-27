/**
 * Contextual rules driven by the needs the user declares (design 6.2: step-free, diets,
 * alcohol-free, kid-friendly, eco-friendly, budget-strict). Each reason names the need.
 */
import { slot } from './profiles/slot.ts';
import type { Constraint, EventInput, Reason, Rule } from './types.ts';

const has =
  (need: Constraint) =>
  (_ctx: unknown, input: EventInput): boolean =>
    input.constraints.includes(need);

const said = (code: string, text: string) => (): Reason => ({ code, text });

/** Rules for declared needs, in the order of the design's rules table. */
export const NEED_RULES: readonly Rule[] = [
  {
    id: 'step-free',
    when: has('step-free'),
    reason: said('step-free', 'You asked for step-free access, so the venue is checked for it.'),
    effects: {
      questions: [
        { vendorId: 'venue', text: 'Is there a ramp or level entry from the parking?' },
        { vendorId: 'venue', text: 'Is there a lift to every floor we will use?' },
        { vendorId: 'venue', text: 'Is there an accessible toilet?' },
      ],
      tasks: [
        {
          id: 'accessible-seating',
          title: 'Reserve accessible seating near the entrance and the stage',
          leadDays: 7,
          minLead: 1,
        },
      ],
      slots: [slot(-30, 60, 'Accessibility helper at the entrance', 'Volunteer')],
    },
  },
  {
    id: 'jain',
    when: has('jain'),
    reason: said('jain', 'You asked for Jain food: no root vegetables, meat or egg.'),
    effects: {
      questions: [
        {
          vendorId: 'caterer',
          text: 'Can you cook Jain food with no onion, garlic, potato or other root vegetables?',
        },
        { vendorId: 'caterer', text: 'Will Jain dishes be cooked in separate vessels?' },
        { vendorId: 'baker', text: 'Can the cake be eggless and free of gelatin?' },
      ],
    },
  },
  {
    id: 'vegetarian',
    when: has('vegetarian'),
    reason: said('vegetarian', 'You asked for vegetarian food: no meat, fish or egg.'),
    effects: {
      questions: [
        { vendorId: 'caterer', text: 'Is every dish free of meat, fish and egg?' },
        { vendorId: 'baker', text: 'Is the cake eggless?' },
      ],
    },
  },
  {
    id: 'halal',
    when: has('halal'),
    reason: said('halal', 'You asked for halal food, so the caterer is asked to certify it.'),
    effects: {
      questions: [
        { vendorId: 'caterer', text: 'Is the meat halal, and can you show the certificate?' },
        { vendorId: 'caterer', text: 'Are halal dishes prepared separately from others?' },
      ],
    },
  },
  {
    id: 'alcohol-free',
    when: has('alcohol-free'),
    reason: said('alcohol-free', 'You asked for an alcohol-free event, so there is no bar.'),
    effects: {
      budget: [{ kind: 'remove', category: 'bar' }],
      removeVendors: ['bartender'],
      notices: [
        { code: 'mocktails', text: 'Plan a mocktail and fresh-juice counter in place of a bar.' },
      ],
    },
  },
  {
    id: 'kid-friendly',
    when: has('kid-friendly'),
    reason: said('kid-friendly', 'You asked for a kid-friendly event.'),
    effects: {
      tasks: [
        { id: 'kids-corner', title: "Set up a supervised kids' corner", leadDays: 7, minLead: 1 },
      ],
      // Only one of these categories exists in any profile, so exactly one line gains.
      budget: [
        { kind: 'add', category: 'entertainment', points: 2 },
        { kind: 'add', category: 'programme', points: 2 },
      ],
    },
  },
  {
    id: 'eco-friendly',
    when: has('eco-friendly'),
    reason: said('eco-friendly', 'You asked for an eco-friendly event: e-invites, less waste.'),
    effects: {
      budget: [{ kind: 'move', from: 'invitations', to: 'decor', fraction: 0.8 }],
      questions: [
        {
          vendorId: 'caterer',
          text: 'Can you serve without single-use plastic, on steel, leaf or areca plates?',
        },
        { vendorId: 'decorator', text: 'Can you avoid single-use plastic and thermocol?' },
      ],
      tasks: [
        {
          id: 'waste-segregation',
          title: 'Set up separate bins for wet, dry and recyclable waste',
          leadDays: 3,
        },
      ],
      notices: [{ code: 'e-invites', text: 'Send e-invites; printed cards are left out.' }],
    },
  },
  {
    id: 'budget-strict',
    when: has('budget-strict'),
    reason: said('budget-strict', 'You said the budget is strict, so more is held in reserve.'),
    effects: { contingency: 0.15, alwaysTrim: true },
  },
];
