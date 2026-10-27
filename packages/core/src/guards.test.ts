import { describe, expect, it } from 'vitest';
import { samplePlan } from './fallback/plan.fixture.ts';
import {
  GUARD_LIMITS,
  dietConflicts,
  guardDraft,
  guardIdeas,
  guardReply,
  hasLink,
  inventedAmounts,
  planAmounts,
} from './guards.ts';
import type { Constraint, Ideas } from './types.ts';

/** Text, the declared constraint, and whether the guard must flag it. */
const DIET_TABLE: readonly [string, Constraint, boolean][] = [
  ['Butter chicken with naan', 'vegetarian', true],
  ['Mutton rogan josh', 'vegetarian', true],
  ['Amritsari fish fry', 'vegetarian', true],
  ['Prawns in coconut curry', 'vegetarian', true],
  ['Egg puffs', 'vegetarian', true],
  ['Masala omelette station', 'vegetarian', true],
  ['Murgh malai tikka', 'vegetarian', true],
  ['Gosht korma', 'vegetarian', true],
  ['Machli fry', 'vegetarian', true],
  ['Anda bhurji', 'vegetarian', true],
  ['चिकन टिक्का', 'vegetarian', true],
  ['अंडा करी', 'vegetarian', true],
  ['Paneer tikka', 'vegetarian', false],
  ['Eggless cake', 'vegetarian', false],
  ['Egg-free mousse', 'vegetarian', false],
  ['Tandoori fish, less oil', 'vegetarian', true],
  ['Chicken less spicy', 'jain', true],
  ['Chickpea salad', 'vegetarian', false],
  ['Eggplant bharta', 'vegetarian', false],
  ['Hamper of sweets', 'vegetarian', false],
  ['Keema pav', 'jain', true],
  ['Onion pakoras', 'jain', true],
  ['Garlic naan', 'jain', true],
  ['Potatoes with cumin', 'jain', true],
  ['Aloo tikki chaat', 'jain', true],
  ['Gajar halwa', 'jain', true],
  ['Pyaaz kachori', 'jain', true],
  ['आलू पराठा', 'jain', true],
  ['Ginger lemonade', 'jain', true],
  ['Mushroom tikka', 'jain', true],
  ['Gatte ki sabzi', 'jain', false],
  ['Honeymoon suite decor', 'jain', false],
  ['Pork ribs', 'halal', true],
  ['Bacon-wrapped dates', 'halal', true],
  ['Wine pairing', 'halal', true],
  ['Chicken biryani', 'halal', false],
  ['Wine and cheese corner', 'alcohol-free', true],
  ['Craft beers on tap', 'alcohol-free', true],
  ['Whisky tasting', 'alcohol-free', true],
  ['Signature cocktails', 'alcohol-free', true],
  ['Daaru party', 'alcohol-free', true],
  ['शराब', 'alcohol-free', true],
  ['Non-alcoholic punch', 'alcohol-free', false],
  ['Virgin mojitos', 'alcohol-free', false],
  ['An alcohol-free bar', 'alcohol-free', false],
  ['Mocktail counter', 'alcohol-free', false],
  ['Ginger and rumali roti', 'alcohol-free', false],
];

describe('dietConflicts', () => {
  it.each(DIET_TABLE)('"%s" under %s → flagged %s', (text, constraint, flagged) => {
    expect(dietConflicts(text, [constraint]).length > 0).toBe(flagged);
  });

  it('only checks the declared constraints', () => {
    expect(dietConflicts('Butter chicken and wine', [])).toEqual([]);
    expect(dietConflicts('Butter chicken and wine', ['kid-friendly'])).toEqual([]);
  });

  it('reports each conflicting word with its constraint, lower-cased', () => {
    expect(dietConflicts('Chicken, then ONION soup', ['jain'])).toEqual([
      { constraint: 'jain', word: 'chicken' },
      { constraint: 'jain', word: 'onion' },
    ]);
  });

  it('is reusable across calls despite the global regex flag', () => {
    expect(dietConflicts('Fish', ['vegetarian'])).toHaveLength(1);
    expect(dietConflicts('Fish', ['vegetarian'])).toHaveLength(1);
  });
});

describe('hasLink', () => {
  it.each([
    'Book at https://example.com',
    'see www.example.org',
    'mail us: someone@example.in',
    'visit shaadi.com today',
    'javascript:alert(1)',
  ])('flags %s', (text) => {
    expect(hasLink(text)).toBe(true);
  });

  it.each([
    'Key data: 250 guests',
    'Rs. 800 per plate',
    'St. Mary’s hall',
    'Dinner at 8.30 pm',
    'e.g. marigolds',
  ])('allows %s', (text) => {
    expect(hasLink(text)).toBe(false);
  });
});

describe('planAmounts', () => {
  it('collects every figure the plan states, rounded to whole rupees', () => {
    const amounts = planAmounts(samplePlan());
    for (const value of [2_500_000, 250_000, 9804, 3400, 500_000, 900_000, 400_000]) {
      expect(amounts.has(value)).toBe(true);
    }
    for (const value of [200_000, 300_000, 50_000, 675_000, 225_000, 150_000]) {
      expect(amounts.has(value)).toBe(true);
    }
  });

  it('adds the budget of a proposed patch', () => {
    expect(planAmounts(samplePlan(), { budget: 800_000 }).has(800_000)).toBe(true);
    expect(planAmounts(samplePlan(), { invited: 10 }).has(800_000)).toBe(false);
  });
});

describe('inventedAmounts', () => {
  const allowed = new Set([2_500_000, 820_000, 9804, 1500]);

  it('accepts figures present in the plan in any common notation', () => {
    expect(inventedAmounts('Budget ₹25,00,000 and ₹9,804 per guest', allowed)).toEqual([]);
    expect(inventedAmounts('about 25 lakh, or 8.2 lakh', allowed)).toEqual([]);
    expect(inventedAmounts('Rs. 1500 deposit, INR 1,500, 1500 rupees', allowed)).toEqual([]);
    expect(inventedAmounts('2.5 crore? no: 0.25 crore', allowed)).toEqual([25_000_000]);
    expect(inventedAmounts('1.5k', allowed)).toEqual([]);
    expect(inventedAmounts('25 लाख', allowed)).toEqual([]);
  });

  it('flags figures absent from the plan', () => {
    expect(inventedAmounts('A DJ costs ₹40,000', allowed)).toEqual([40_000]);
    expect(inventedAmounts('Plan for 6 lakhs', allowed)).toEqual([600_000]);
    expect(inventedAmounts('2 Crores', allowed)).toEqual([20_000_000]);
    expect(inventedAmounts('₹9,806', allowed)).toEqual([9806]);
    expect(inventedAmounts('₹9,803 or ₹9,805', allowed)).toEqual([]);
  });

  it('ignores plain numbers such as counts, times and dates', () => {
    expect(inventedAmounts('250 guests at 18:00 on 2027-02-20, 10% off', allowed)).toEqual([]);
  });
});

function ideas(overrides: Partial<Ideas> = {}): Ideas {
  return {
    theme: { name: 'Marigold', palette: ['marigold', 'ivory'], why: 'Warm.' },
    decor: [{ title: 'Torans', detail: 'Fresh flowers.' }],
    menu: [{ title: 'Paneer tikka', detail: 'Smoky.' }],
    activities: [{ title: 'Antakshari', detail: 'Songs.' }],
    touch: { title: 'Welcome note', detail: 'On each table.' },
    invitation: 'Please join us.',
    ...overrides,
  };
}

describe('guardIdeas', () => {
  it('passes clean ideas', () => {
    expect(guardIdeas(ideas(), ['vegetarian', 'alcohol-free'])).toEqual([]);
  });

  it('names the field of each issue', () => {
    const issues = guardIdeas(
      ideas({
        menu: [{ title: 'Chicken tikka', detail: 'From www.example.com' }],
        theme: { name: 'x'.repeat(GUARD_LIMITS.themeName + 1), palette: ['wine'], why: '' },
        activities: [{ title: 'Quiz', detail: 'Prize of ₹5,000' }],
      }),
      ['vegetarian', 'alcohol-free'],
    );
    expect(issues.map(({ code, where }) => `${code}@${where}`)).toEqual([
      'length@theme.name',
      'diet@theme.palette.0',
      'diet@menu.0.title',
      'link@menu.0.detail',
      'amount@activities.0.detail',
    ]);
  });
});

describe('guardDraft', () => {
  it('allows plan figures and diet words, rejects invented figures and links', () => {
    const plan = samplePlan();
    expect(guardDraft('We need no onion or garlic. Deposit ₹2,25,000.', plan)).toEqual([]);
    expect(guardDraft('Typical rate ₹1,234 at www.x.com', plan).map((i) => i.code)).toEqual([
      'link',
      'amount',
    ]);
    expect(guardDraft(`www.x.com ${'x'.repeat(GUARD_LIMITS.draft)}`, plan)).toEqual([
      { code: 'length', where: 'draft', detail: 'longer than 1800 characters' },
    ]);
  });
});

describe('guardReply', () => {
  it('accepts the patch budget only when the patch proposes it', () => {
    const plan = samplePlan();
    expect(guardReply('Budget → ₹8,00,000', plan, { budget: 800_000 })).toEqual([]);
    expect(guardReply('Budget → ₹8,00,000', plan)[0]?.detail).toBe('₹800000 is not in the plan');
  });
});

describe('date guard', () => {
  it('lets replies and drafts repeat plan dates but not invent or keep stale ones', () => {
    const plan = samplePlan();
    expect(guardReply('Pay the caterer by 6 Nov 2026.', plan)).toEqual([]);
    expect(guardReply('Pay the caterer by 9 Nov please.', plan)).toEqual([
      { code: 'date', where: 'reply', detail: '"9 Nov" is not a date in the plan' },
    ]);
    expect(guardReply('Moved to 13 March 2027.', plan, { date: '2027-03-13' })).toEqual([]);
    expect(guardDraft('Event on 20 February 2027; can you confirm by 6 November?', plan)).toEqual(
      [],
    );
    expect(guardDraft('Event on 27 February 2027.', plan).map((issue) => issue.code)).toEqual([
      'date',
    ]);
  });

  it('reads Devanagari digits in amounts', () => {
    const plan = samplePlan();
    expect(guardReply('कैटरर को ₹२,२५,००० जमा करें', plan)).toEqual([]);
    expect(guardReply('कैटरर को ₹७७,७७७ दें', plan).map((issue) => issue.code)).toEqual(['amount']);
  });

  it('rejects any date in ideas, which leave the date as a placeholder', () => {
    const ideas = guardIdeas(
      {
        theme: { name: 'Marigold', palette: ['saffron'], why: 'Warm.' },
        decor: [],
        menu: [],
        activities: [],
        touch: { title: 'Welcome', detail: 'Rose water at the door.' },
        invitation: 'Join us on 20 February 2027 at [venue].',
      },
      [],
    );
    expect(ideas.map((issue) => issue.code)).toEqual(['date']);
  });
});
