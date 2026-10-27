import { describe, expect, it } from 'vitest';
import { eventTitle, textLang } from './labels.ts';

describe('labels', () => {
  it('titles an event with its city when it has one', () => {
    expect(eventTitle({ type: 'wedding', style: 'traditional', city: 'Lucknow' })).toBe(
      'Traditional wedding in Lucknow',
    );
    expect(eventTitle({ type: 'birthday', style: 'kids', city: '' })).toBe(
      "Children's birthday party",
    );
  });

  it('marks only Gemini text with the requested language', () => {
    expect(textLang('gemini', 'hi')).toBe('hi');
    expect(textLang('fallback', 'hi')).toBe('en');
    expect(textLang('gemini', 'en')).toBe('en');
  });
});
