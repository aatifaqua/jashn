/**
 * User-facing words for the closed id lists. Each map is typed as a complete Record over its
 * id list, so adding an id to the core without a label here fails the type check.
 */
import {
  occasion,
  type CityTier,
  type Constraint,
  type EventType,
  type Phase,
  type Setting,
  type TaskStatus,
  type Verdict,
  type VendorStatus,
  type EventInput,
} from '@jashn/core';
import type { IconName } from './icons.ts';

/** Event type cards on the form. */
export const TYPE_LABELS: Readonly<Record<EventType, { label: string; hint: string }>> = {
  wedding: { label: 'Wedding', hint: 'One day or several functions' },
  birthday: { label: 'Birthday', hint: 'Kids, milestone or adult party' },
  community: { label: 'Community event', hint: 'Mela, fundraiser, meetup or clean-up' },
};

/** City size choices. */
export const TIER_LABELS: Readonly<Record<CityTier, string>> = {
  metro: 'Metro city',
  tier2: 'Tier-2 city',
  town: 'Town or village',
};

/** Setting choices. */
export const SETTING_LABELS: Readonly<Record<Setting, string>> = {
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  mixed: 'Indoor and outdoor',
};

/** Needs the user can declare. */
export const CONSTRAINT_LABELS: Readonly<Record<Constraint, string>> = {
  vegetarian: 'Vegetarian food',
  jain: 'Jain food',
  halal: 'Halal food',
  'alcohol-free': 'No alcohol',
  'kid-friendly': 'Kid-friendly',
  'step-free': 'Step-free access',
  'eco-friendly': 'Eco-friendly',
  'budget-strict': 'Strict budget',
};

/** Timeline phase headings. */
export const PHASE_LABELS: Readonly<Record<Phase, string>> = {
  'do-now': 'Do now',
  'months-out': 'Months out',
  'weeks-out': 'Weeks out',
  'final-fortnight': 'Final fortnight',
  'day-of': 'Day of',
  after: 'After the event',
};

/** Vendor progress choices. */
export const VENDOR_STATUS_LABELS: Readonly<Record<VendorStatus, string>> = {
  'to-contact': 'To contact',
  quoted: 'Quoted',
  booked: 'Booked',
  paid: 'Paid',
};

/** How a verdict reads: an icon and a word, so the status never depends on colour alone. */
export const VERDICTS: Readonly<Record<Verdict, { word: string; icon: IconName; text: string }>> = {
  comfortable: {
    word: 'Comfortable',
    icon: 'check',
    text: 'The budget covers a good version of this event with room to spare.',
  },
  tight: {
    word: 'Tight',
    icon: 'alert',
    text: 'The budget covers a modest version; choose priorities carefully.',
  },
  unrealistic: {
    word: 'Unrealistic',
    icon: 'stop',
    text: 'The budget is below a modest cost for this headcount; see Ways to save on the Budget tab.',
  },
};

/** Task status badges; upcoming tasks carry no badge. */
export const TASK_BADGES: Readonly<Partial<Record<TaskStatus, { word: string; icon: IconName }>>> =
  {
    late: { word: 'Late', icon: 'clock' },
    'at-risk': { word: 'At risk', icon: 'alert' },
    done: { word: 'Done', icon: 'check' },
  };

/** A plan's heading, e.g. "Traditional wedding in Lucknow". */
export function eventTitle(input: Pick<EventInput, 'type' | 'style' | 'city'>): string {
  const what = occasion(input);
  const name = what.charAt(0).toUpperCase() + what.slice(1);
  return input.city === '' ? name : `${name} in ${input.city}`;
}
