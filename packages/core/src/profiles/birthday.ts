/** Birthday profile. Every figure is an editorial planning estimate for India, not a quote. */
import type { Profile } from '../types.ts';
import { BIRTHDAY_TASKS, BIRTHDAY_VENDORS } from './birthday-catalogue.ts';
import { deepFreeze } from '../freeze.ts';
import { slot } from '../templates.ts';

/** Deep-frozen at load, so every plan shares one immutable table. */
export const BIRTHDAY: Profile = deepFreeze<Profile>({
  type: 'birthday',
  label: 'Birthday',
  turnout: 0.9,
  floors: { metro: 800, tier2: 500, town: 300 },
  minLeadDays: 14,
  categories: [
    { id: 'venue', label: 'Venue', weight: 20 },
    { id: 'food', label: 'Food and cake', weight: 35 },
    { id: 'decor', label: 'Decor and balloons', weight: 12 },
    { id: 'entertainment', label: 'Entertainment', weight: 13 },
    { id: 'photography', label: 'Photography', weight: 5 },
    { id: 'invitations', label: 'Invitations', weight: 1 },
    { id: 'return-gifts', label: 'Return gifts', weight: 4 },
    { id: 'bar', label: 'Bar', weight: 0 },
  ],
  styles: [
    {
      id: 'kids',
      label: "Children's party",
      startTime: '16:00',
      walkIn: 1,
      deltas: [
        { category: 'entertainment', points: 5 },
        { category: 'return-gifts', points: 2 },
      ],
      runSheet: [
        slot(-120, 90, 'Balloon and theme decor set-up', 'Decorator'),
        slot(-30, 30, 'Entertainer sets up', 'Entertainer'),
        slot(0, 30, 'Children arrive; welcome activity', 'Host family'),
        slot(30, 60, 'Magic show or party games', 'Entertainer'),
        slot(90, 30, 'Cake cutting and song', 'Host family'),
        slot(120, 45, 'Snacks and dinner', 'Caterer'),
        slot(165, 15, 'Return gifts and goodbyes', 'Host family'),
      ],
    },
    {
      id: 'milestone',
      label: 'Milestone birthday',
      startTime: '19:00',
      walkIn: 1,
      deltas: [
        { category: 'venue', points: 3 },
        { category: 'photography', points: 2 },
        { category: 'bar', points: 3 },
      ],
      runSheet: [
        slot(-120, 90, 'Decor and stage set-up', 'Decorator'),
        slot(-30, 30, 'Sound check', 'DJ'),
        slot(0, 45, 'Guests arrive; welcome drinks', 'Host family'),
        slot(45, 30, 'Memories slideshow and toasts', 'Family'),
        slot(75, 15, 'Cake cutting', 'Guest of honour'),
        slot(90, 90, 'Dinner', 'Caterer'),
        slot(120, 120, 'Music and dancing', 'DJ'),
      ],
    },
    {
      id: 'adult',
      label: 'Adult party',
      startTime: '20:00',
      walkIn: 1,
      deltas: [
        { category: 'bar', points: 6 },
        { category: 'decor', points: -2 },
      ],
      runSheet: [
        slot(-90, 60, 'Decor and music set-up', 'Decorator'),
        slot(0, 60, 'Guests arrive; drinks and starters', 'Host'),
        slot(60, 15, 'Cake cutting', 'Host'),
        slot(75, 120, 'Music and dancing', 'DJ'),
        slot(120, 90, 'Dinner', 'Caterer'),
        slot(225, 30, 'Wind down; cabs home', 'Host'),
      ],
    },
  ],
  functions: [],
  tasks: BIRTHDAY_TASKS,
  vendors: BIRTHDAY_VENDORS,
});
