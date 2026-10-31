import { describe, expect, it } from 'vitest';
import { guardDraft } from '../guards.ts';
import { TODAY } from '../test-fixtures.ts';
import type { StyleId, VendorItem } from '../types.ts';
import { draftEnquiry } from './draft.ts';
import { samplePlan } from './plan.fixture.ts';

const DJ: VendorItem = {
  id: 'dj',
  label: 'DJ',
  category: 'entertainment',
  bookBy: TODAY - 5,
  booked: false,
  depositShare: 0.2,
  questions: [],
  reasons: [],
};

describe('draftEnquiry', () => {
  it('lists the event facts and the vendor questions, without the budget', () => {
    const plan = samplePlan({}, { constraints: ['jain', 'step-free', 'budget-strict'] });
    const vendor = plan.vendors[0];
    if (vendor === undefined) throw new Error('fixture has a vendor');
    const draft = draftEnquiry(plan, vendor);
    expect(draft.vendorId).toBe('caterer');
    expect(draft.text).toBe(
      [
        'Hello,',
        '',
        'We are planning a traditional wedding in Lucknow on Saturday, 20 February 2027, ' +
          'starting at 18:00, for about 255 guests.',
        'The event is indoors.',
        'Functions: Ceremony, Mehndi, Reception.',
        'Please note: Jain food (no root vegetables, onion or garlic); ' +
          'step-free access for guests who use wheelchairs.',
        '',
        'We are looking for a caterer.',
        'Could you please share your availability and a quote, and tell us:',
        '1. Can you cook a Jain menu?',
        '2. Do you provide service staff?',
        '',
        'We hope to confirm by Friday, 6 November 2026.',
        '',
        'Thank you.',
      ].join('\n'),
    );
    expect(guardDraft(draft.text, plan)).toEqual([]);
  });

  it('handles a vendor without questions, no city or needs, and a past book-by date', () => {
    const plan = samplePlan(
      {},
      {
        type: 'community',
        style: 'clean-up',
        functions: [],
        city: '',
        setting: 'mixed',
        constraints: [],
      },
    );
    const text = draftEnquiry(plan, DJ).text;
    expect(text).toContain('We are planning a community clean-up drive on Saturday');
    expect(text).toContain('The event is partly indoors and partly outdoors.');
    expect(text).not.toContain('Functions:');
    expect(text).not.toContain('Please note');
    expect(text).toContain('We are looking for a DJ.');
    expect(text).toContain('Could you please share your availability and a quote for these dates?');
    expect(text).toContain('We hope to confirm by Tuesday, 27 October 2026.');
  });

  it('names an event of an unknown style by its type', () => {
    const plan = samplePlan({}, { type: 'community', style: 'other' as StyleId, functions: [] });
    expect(draftEnquiry(plan, DJ).text).toContain('We are planning a community event in Lucknow');
  });

  it('uses "an" before a vowel', () => {
    const plan = samplePlan({}, { style: 'intimate' });
    expect(draftEnquiry(plan, { ...DJ, label: 'Officiant' }).text).toContain(
      'We are planning an intimate wedding',
    );
    expect(draftEnquiry(plan, { ...DJ, label: 'Officiant' }).text).toContain('an officiant');
  });
});
