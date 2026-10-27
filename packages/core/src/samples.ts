/**
 * The three sample events offered on the start screen and used by the demo content and the
 * scenario tests. Dates are placed relative to today (the first Saturday after a fixed lead
 * time), so a sample always validates and always lands on the same weekday.
 */
import { toIso, weekday } from './days.ts';
import { deepFreeze } from './profiles/freeze.ts';
import type { EventInput } from './types.ts';

/** Sample ids in the order the start screen shows them. */
export const SAMPLE_IDS = ['lucknow-wedding', 'kids-birthday', 'diwali-mela'] as const;

/** One of the three samples. */
export type SampleId = (typeof SAMPLE_IDS)[number];

const SATURDAY = 6;

interface SampleDef {
  readonly label: string;
  /** The event falls on the first Saturday at least this many days after today. */
  readonly leadDays: number;
  readonly input: Omit<EventInput, 'date'>;
}

/**
 * Each sample shows off a different part of the engine: a multi-function wedding with a
 * tight budget, a booked kids' party, and a short-notice outdoor mela that needs
 * permissions, volunteers and a waste plan.
 */
const SAMPLES: Readonly<Record<SampleId, SampleDef>> = deepFreeze({
  'lucknow-wedding': {
    label: 'Lucknow wedding',
    leadDays: 120,
    input: {
      type: 'wedding',
      style: 'traditional',
      functions: ['ceremony', 'mehndi', 'reception', 'sangeet'],
      startTime: '19:00',
      city: 'Lucknow',
      tier: 'tier2',
      setting: 'mixed',
      venueBooked: false,
      invited: 350,
      budget: 1_600_000,
      priorities: ['catering', 'photography'],
      constraints: ['step-free', 'vegetarian'],
      note: 'Grandparents travel from Kanpur; keep the evenings short for them.',
    },
  },
  'kids-birthday': {
    label: '7th birthday',
    leadDays: 21,
    input: {
      type: 'birthday',
      style: 'kids',
      functions: [],
      startTime: '16:00',
      city: 'Pune',
      tier: 'metro',
      setting: 'indoor',
      venueBooked: true,
      invited: 40,
      budget: 60_000,
      priorities: ['entertainment'],
      constraints: ['kid-friendly', 'vegetarian'],
      note: 'Turning seven and loves space and rockets.',
    },
  },
  'diwali-mela': {
    label: 'Diwali mela',
    leadDays: 21,
    input: {
      type: 'community',
      style: 'festival',
      functions: [],
      startTime: '17:00',
      city: 'Indore',
      tier: 'tier2',
      setting: 'outdoor',
      venueBooked: false,
      invited: 600,
      budget: 120_000,
      priorities: ['safety'],
      constraints: ['alcohol-free', 'eco-friendly', 'step-free'],
      note: 'Residents association mela with food stalls and a rangoli contest.',
    },
  },
});

/**
 * Prompts the assistant panel suggests. They live here, beside the samples, because the
 * pre-generated demo answers are keyed by these exact strings in the web app and the script
 * that writes them. None changes the date, since sample dates move with today.
 */
export const SUGGESTED_PROMPTS = Object.freeze([
  'What is late?',
  'How can I save money?',
  'What should I book first?',
  'When are payments due?',
  'Cut guests by 20',
] as const);

/** The start-screen label of a sample, e.g. "Lucknow wedding". */
export function sampleLabel(id: SampleId): string {
  return SAMPLES[id].label;
}

/** The sample's input dated relative to `today`, ready for validateInput and buildPlan. */
export function sampleEvent(id: SampleId, today: number): EventInput {
  const { leadDays, input } = SAMPLES[id];
  const earliest = today + leadDays;
  const date = earliest + ((SATURDAY - weekday(earliest) + 7) % 7);
  return { ...input, date: toIso(date) };
}
