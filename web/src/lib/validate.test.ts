import { ideasOffline } from '@jashn/core';
import { describe, expect, it } from 'vitest';
import { planFor, sampleInput } from '../test-fixtures.ts';
import {
  isId,
  isIdeas,
  isLanguage,
  isRecord,
  isSource,
  isVendorStatus,
  readDraft,
  readIdeas,
  readReply,
} from './validate.ts';

const input = sampleInput();
const ideas = ideasOffline(input);

describe('primitive guards', () => {
  it('accepts only the closed values', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isId('book-venue')).toBe(true);
    expect(isId('Book venue')).toBe(false);
    expect(isId(7)).toBe(false);
    expect(isSource('gemini')).toBe(true);
    expect(isSource('model')).toBe(false);
    expect(isLanguage('hi')).toBe(true);
    expect(isLanguage('fr')).toBe(false);
    expect(isVendorStatus('quoted')).toBe(true);
    expect(isVendorStatus('cancelled')).toBe(false);
  });
});

describe('readIdeas', () => {
  it('accepts a well-formed idea set and copies only known fields', () => {
    const read = readIdeas({ ...ideas, extra: '<script>' }, input.constraints);
    expect(read).toEqual(ideas);
    expect(read).not.toHaveProperty('extra');
  });

  it('rejects malformed shapes', () => {
    expect(isIdeas(null)).toBe(false);
    expect(isIdeas({ ...ideas, decor: [] })).toBe(false);
    expect(isIdeas({ ...ideas, touch: { title: '', detail: 'x' } })).toBe(false);
    expect(isIdeas({ ...ideas, theme: { ...ideas.theme, palette: 'gold' } })).toBe(false);
    expect(isIdeas({ ...ideas, invitation: 42 })).toBe(false);
  });

  it('rejects ideas that break a declared diet', () => {
    const meaty = { ...ideas, menu: [{ title: 'Mutton biryani', detail: 'Slow-cooked mutton.' }] };
    expect(readIdeas(meaty, ['vegetarian'])).toBeNull();
    expect(readIdeas(meaty, [])).not.toBeNull();
  });
});

describe('readReply', () => {
  const plan = planFor();

  it('accepts a plain reply and a valid patch', () => {
    expect(readReply({ reply: 'Nothing is late.' }, plan)).toEqual({ reply: 'Nothing is late.' });
    expect(readReply({ reply: 'Fewer guests.', patch: { invited: 300 } }, plan)).toEqual({
      reply: 'Fewer guests.',
      patch: { invited: 300 },
    });
  });

  it('rejects a patch the form would reject, and invented prices', () => {
    expect(readReply({ reply: 'Sure.', patch: { invited: 0 } }, plan)).toBeNull();
    expect(readReply({ reply: 'Sure.', patch: { type: 'birthday' } }, plan)).toBeNull();
    expect(readReply({ reply: 'The venue costs ₹9,99,999.' }, plan)).toBeNull();
    expect(readReply({ reply: '' }, plan)).toBeNull();
    expect(readReply('text', plan)).toBeNull();
  });
});

describe('readDraft', () => {
  const plan = planFor();

  it('accepts a guarded draft for the same vendor only', () => {
    expect(readDraft({ vendorId: 'venue', text: 'Hello' }, plan, 'venue')).toEqual({
      vendorId: 'venue',
      text: 'Hello',
    });
    expect(readDraft({ vendorId: 'dj', text: 'Hello' }, plan, 'venue')).toBeNull();
    expect(
      readDraft({ vendorId: 'venue', text: 'See https://x.example' }, plan, 'venue'),
    ).toBeNull();
  });
});
