import { describe, expect, it } from 'vitest';
import { guardIdeas } from '../guards.ts';
import { CONSTRAINTS, EVENT_TYPES, SETTINGS, STYLE_IDS } from '../ids.ts';
import { sampleInput } from '../test-fixtures.ts';
import type { Constraint, EventInput } from '../types.ts';
import { ideasOffline } from './ideas.ts';

const DIETS: readonly (readonly Constraint[])[] = [
  [],
  ['vegetarian'],
  ['jain'],
  ['halal'],
  ['alcohol-free'],
  ['halal', 'vegetarian'],
  [...CONSTRAINTS],
];
/** One date in each season and one outside all of them. */
const DATES = ['2027-01-16', '2027-05-15', '2027-07-17', '2027-10-16'];

function everyInput(): EventInput[] {
  return EVENT_TYPES.flatMap((type) =>
    STYLE_IDS[type].flatMap((style) =>
      SETTINGS.flatMap((setting) =>
        DATES.flatMap((date) =>
          DIETS.map((constraints) =>
            sampleInput({
              type,
              style,
              setting,
              date,
              constraints,
              functions: type === 'wedding' ? ['ceremony', 'mehndi', 'sangeet'] : [],
            }),
          ),
        ),
      ),
    ),
  );
}

describe('ideasOffline', () => {
  it('always returns a full, guard-clean set of ideas', () => {
    for (const input of everyInput()) {
      const ideas = ideasOffline(input);
      expect(guardIdeas(ideas, input.constraints)).toEqual([]);
      expect(ideas.decor).toHaveLength(3);
      expect(ideas.activities).toHaveLength(3);
      expect(ideas.menu.length).toBeGreaterThanOrEqual(3);
      expect(ideas.menu.length).toBeLessThanOrEqual(5);
      expect(ideas.theme.palette.length).toBeGreaterThanOrEqual(3);
      expect(ideas.theme.name).not.toBe('');
    }
  });

  it('is deterministic', () => {
    expect(ideasOffline(sampleInput())).toEqual(ideasOffline(sampleInput()));
  });

  it('suits the style, functions and season', () => {
    const winter = ideasOffline(sampleInput());
    expect(winter.theme.name).toBe('Winter Diyas');
    expect(winter.activities.map((item) => item.title)).toContain('Mehndi with live dholak');
    expect(winter.menu.map((item) => item.title)).toContain('Gajar halwa');
    const monsoon = ideasOffline(sampleInput({ date: '2027-07-17', setting: 'outdoor' }));
    expect(monsoon.theme.name).toBe('Monsoon Jasmine');
    expect(monsoon.decor[0]?.title).toBe('Rain-ready canopy');
    const kids = ideasOffline(
      sampleInput({ type: 'birthday', style: 'kids', functions: [], priorities: [] }),
    );
    expect(kids.theme.name).toBe('Jungle Safari');
    expect(kids.touch.title).toBe('Pick-your-own return gift');
  });

  it('respects the diet', () => {
    const jain = ideasOffline(sampleInput({ constraints: ['jain'] }));
    expect(jain.menu.map((item) => item.title)).not.toContain('Gajar halwa');
    const destination = sampleInput({ style: 'destination' });
    expect(ideasOffline(destination).menu[0]?.title).toBe('Signature cocktail hour');
    const halal = ideasOffline({ ...destination, constraints: ['halal'] });
    expect(halal.menu.map((item) => item.title)).not.toContain('Signature cocktail hour');
    expect(halal.menu.find((item) => item.title === 'Coastal fish curry')?.detail).toMatch(
      /halal-certified/,
    );
  });

  it('personalises the theme and invitation with the city, date and needs', () => {
    const ideas = ideasOffline(
      sampleInput({ style: 'intimate', constraints: ['kid-friendly', 'eco-friendly'] }),
    );
    expect(ideas.theme.why).toMatch(/Chosen for an intimate wedding in Lucknow\.$/);
    expect(ideas.invitation).toBe(
      'We warmly invite you to our intimate wedding in Lucknow on Saturday, 20 February 2027, ' +
        'starting at 18:00. Your presence and blessings will make the day complete. ' +
        'Children are very welcome. Please skip plastic gift wrap. ' +
        'Kindly let us know if you can join us.',
    );
  });

  it('falls back to defaults for unvalidated input', () => {
    const ideas = ideasOffline(
      sampleInput({ type: 'birthday', style: 'unknown', date: 'soon', city: '', functions: [] }),
    );
    expect(ideas.theme.name).toBe('Festive Classic');
    expect(ideas.theme.why).toMatch(/Chosen for a birthday\.$/);
    expect(ideas.touch.title).toBe('Handwritten welcome');
    expect(ideas.invitation).toMatch(/^We warmly invite you to our birthday, starting at 18:00\./);
  });
});
