import { describe, expect, it } from 'vitest';
import { guardIdeas } from '../guards.ts';
import { CONSTRAINTS, EVENT_TYPES, SETTINGS, STYLE_IDS } from '../ids.ts';
import { sampleInput } from '../test-fixtures.ts';
import type { BudgetLine, Constraint, EventInput } from '../types.ts';
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

function everyInput(): EventInput[] {
  return EVENT_TYPES.flatMap((type) =>
    STYLE_IDS[type].flatMap((style) =>
      SETTINGS.flatMap((setting) =>
        DIETS.map((constraints) =>
          sampleInput({
            type,
            style,
            setting,
            constraints,
            functions: type === 'wedding' ? ['ceremony', 'mehndi', 'sangeet'] : [],
          }),
        ),
      ),
    ),
  );
}

const BAR: readonly BudgetLine[] = [{ category: 'bar', amount: 50_000, share: 0.02, reasons: [] }];
const DRY: readonly BudgetLine[] = [{ category: 'bar', amount: 0, share: 0, reasons: [] }];

describe('ideasOffline', () => {
  it('always returns a full, guard-clean set of ideas', () => {
    for (const input of everyInput()) {
      const ideas = ideasOffline(input, BAR);
      expect(guardIdeas(ideas, input.constraints)).toEqual([]);
      // The API schema requires exactly three of each, for live and offline ideas alike.
      expect(ideas.decor).toHaveLength(3);
      expect(ideas.activities).toHaveLength(3);
      expect(ideas.menu.length).toBeGreaterThanOrEqual(3);
      expect(ideas.menu.length).toBeLessThanOrEqual(5);
      expect(ideas.theme.palette.length).toBeGreaterThanOrEqual(3);
      expect(ideas.theme.name).not.toBe('');
    }
  });

  it('suits the event type', () => {
    expect(ideasOffline(sampleInput()).theme.name).toBe('Marigold Classic');
    const kids = sampleInput({ type: 'birthday', style: 'kids', functions: [], priorities: [] });
    expect(ideasOffline(kids).theme.name).toBe('Confetti Pop');
  });

  it('respects the diet and serves alcohol only from a funded bar', () => {
    const titles = (constraints: readonly Constraint[], budget = BAR): string[] =>
      ideasOffline(sampleInput({ constraints }), budget).menu.map((item) => item.title);
    expect(titles([])).toEqual(expect.arrayContaining(['Signature cocktail', 'Mutton biryani']));
    expect(titles(['vegetarian'])).not.toContain('Mutton biryani');
    expect(titles(['vegetarian'])).toContain('Signature cocktail');
    for (const [constraints, budget] of [
      [['alcohol-free'], BAR],
      [[], DRY],
      [[], []],
    ] as const) {
      const menu = titles(constraints, budget);
      expect(menu).not.toContain('Signature cocktail');
      expect(menu).toContain('Signature mocktail');
    }
    expect(titles(['jain'])).toEqual(['Rose sharbat', 'Dal and jeera rice', 'Jalebi with rabri']);
    expect(titles(['jain'], DRY)).toContain('Signature mocktail');
    const halal = ideasOffline(sampleInput({ constraints: ['halal'] }), BAR).menu;
    expect(halal.map((item) => item.title)).not.toContain('Signature cocktail');
    expect(halal.find((item) => item.title === 'Mutton biryani')?.detail).toMatch(
      /halal-certified/,
    );
  });

  it('swaps plastic-heavy ideas and asks guests to skip gift wrap when eco-friendly', () => {
    const kids = { type: 'birthday', style: 'kids', functions: [], priorities: [] } as const;
    const plain = ideasOffline(sampleInput(kids));
    const eco = ideasOffline(sampleInput({ ...kids, constraints: ['eco-friendly'] }));
    const text = (ideas: typeof plain): string => JSON.stringify(ideas).toLowerCase();
    expect(text(plain)).toMatch(/balloon/);
    expect(plain.touch.detail).toMatch(/wrapped/);
    expect(text(eco)).not.toMatch(/balloon|wrapped|plastic(?! gift wrap)/);
    expect(eco.decor).toHaveLength(3);
    expect(eco.invitation).toMatch(/Please skip plastic gift wrap\./);
    expect(plain.invitation).not.toMatch(/gift wrap/);
  });

  it('personalises the theme and invitation with the city and needs, leaving the date as a placeholder', () => {
    const ideas = ideasOffline(sampleInput({ style: 'intimate', constraints: ['kid-friendly'] }));
    expect(ideas.theme.why).toMatch(/Chosen for an intimate wedding in Lucknow\.$/);
    expect(ideas.invitation).toBe(
      '[Names] warmly invite you to our intimate wedding in Lucknow on [date] at [venue], ' +
        'starting at 18:00. Your presence and blessings will make the day complete. ' +
        'Children are very welcome. Kindly let us know if you can join us.',
    );
  });

  it('leaves the city out when there is none', () => {
    const ideas = ideasOffline(
      sampleInput({ type: 'community', style: 'unknown', city: '', functions: [] }),
    );
    expect(ideas.theme.why).toMatch(/Chosen for a community event\.$/);
    expect(ideas.invitation).toMatch(
      /^\[Names\] warmly invite you to our community event on \[date\] at \[venue\], starting at 18:00\./,
    );
  });
});
