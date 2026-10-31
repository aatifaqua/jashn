import { describe, expect, it } from 'vitest';
import { eventTitle, perGuestText } from './labels.ts';

describe('labels', () => {
  it('titles an event with its city when it has one', () => {
    expect(eventTitle({ type: 'wedding', style: 'traditional', city: 'Lucknow' })).toBe(
      'Traditional wedding in Lucknow',
    );
    expect(eventTitle({ type: 'birthday', style: 'kids', city: '' })).toBe(
      "Children's birthday party",
    );
  });

  it('states the per-guest figure against the modest floor', () => {
    expect(perGuestText({ perGuest: 9804, floor: 3400 })).toBe(
      'About ₹9,804 per expected guest; a modest version needs about ₹3,400.',
    );
  });
});
