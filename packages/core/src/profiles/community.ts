/**
 * Community event profile: budget weights, styles with walk-in factors, run sheets, tasks and
 * vendors. Every figure is an editorial planning estimate for India, not a quote.
 */
import type { Profile } from '../types.ts';
import { COMMUNITY_TASKS, COMMUNITY_VENDORS } from './community-catalogue.ts';
import { deepFreeze } from './freeze.ts';
import { slot } from './slot.ts';

/**
 * The community profile, deep-frozen at module load. Every style's run sheet carries the
 * design's fixed frame: set-up three hours before, volunteer briefing, opening, programme,
 * close and clean-up.
 */
export const COMMUNITY: Profile = deepFreeze<Profile>({
  type: 'community',
  label: 'Community event',
  turnout: 1,
  floors: { metro: 150, tier2: 100, town: 60 },
  minLeadDays: 30,
  categories: [
    { id: 'venue', label: 'Venue and permits', weight: 12 },
    { id: 'food', label: 'Food and refreshments', weight: 22 },
    { id: 'infrastructure', label: 'Tent, stage, sound and light', weight: 22 },
    { id: 'programme', label: 'Programme', weight: 10 },
    { id: 'publicity', label: 'Publicity', weight: 6 },
    { id: 'safety', label: 'Safety and first aid', weight: 8 },
    { id: 'sanitation', label: 'Sanitation and waste', weight: 6 },
    { id: 'volunteer-kit', label: 'Volunteer kit', weight: 4 },
  ],
  styles: [
    {
      id: 'festival',
      label: 'Festival or mela',
      startTime: '10:00',
      walkIn: 1.5,
      deltas: [
        { category: 'infrastructure', points: 3 },
        { category: 'programme', points: 2 },
      ],
      runSheet: [
        slot(-180, 120, 'Set-up: tent, stage, stalls and sound', 'Tent and sound crew'),
        slot(-60, 30, 'Volunteer briefing and safety walk-through', 'Volunteer lead'),
        slot(0, 30, 'Opening and welcome', 'Organiser'),
        slot(30, 300, 'Programme: performances, games and stalls', 'Programme lead'),
        slot(120, 240, 'Food and refreshment counters open', 'Caterer'),
        slot(330, 30, 'Close and thanks', 'Organiser'),
        slot(360, 120, 'Clean-up and waste segregation', 'Volunteers'),
      ],
    },
    {
      id: 'fundraiser',
      label: 'Fundraiser',
      startTime: '18:00',
      walkIn: 1.2,
      deltas: [{ category: 'publicity', points: 4 }],
      runSheet: [
        slot(-180, 120, 'Set-up: stage, seating and donation desk', 'Tent and sound crew'),
        slot(-60, 30, 'Volunteer briefing', 'Volunteer lead'),
        slot(0, 30, 'Guests arrive; registration', 'Volunteers'),
        slot(30, 15, 'Opening: why we are raising funds', 'Organiser'),
        slot(45, 90, 'Programme: performances and the appeal', 'Programme lead'),
        slot(135, 30, 'Pledges and auction', 'Organiser'),
        slot(165, 60, 'Dinner', 'Caterer'),
        slot(225, 15, 'Close and thanks', 'Organiser'),
        slot(240, 90, 'Clean-up', 'Volunteers'),
      ],
    },
    {
      id: 'meetup',
      label: 'Meetup',
      startTime: '11:00',
      walkIn: 1.1,
      deltas: [
        { category: 'venue', points: 4 },
        { category: 'food', points: 2 },
      ],
      runSheet: [
        slot(-180, 120, 'Set-up: seating, screen and sound', 'Tent and sound crew'),
        slot(-60, 30, 'Volunteer briefing', 'Volunteer lead'),
        slot(0, 15, 'Opening and welcome', 'Organiser'),
        slot(15, 120, 'Programme: talks and sessions', 'Programme lead'),
        slot(135, 60, 'Lunch and networking', 'Caterer'),
        slot(195, 15, 'Close and thanks', 'Organiser'),
        slot(210, 60, 'Clean-up', 'Volunteers'),
      ],
    },
    {
      id: 'clean-up',
      label: 'Clean-up drive',
      startTime: '08:00',
      walkIn: 1,
      deltas: [
        { category: 'sanitation', points: 6 },
        { category: 'volunteer-kit', points: 6 },
        { category: 'infrastructure', points: -12 },
        { category: 'programme', points: -6 },
      ],
      runSheet: [
        slot(-180, 120, 'Set-up: lay out gloves, bags and water at the base', 'Volunteer lead'),
        slot(-60, 30, 'Volunteer briefing and safety talk', 'Volunteer lead'),
        slot(0, 15, 'Opening and zone assignments', 'Organiser'),
        slot(15, 150, 'Programme: clean-up in zones', 'Zone leads'),
        slot(165, 30, 'Weigh and segregate the waste', 'Volunteers'),
        slot(195, 15, 'Close, group photo and thanks', 'Organiser'),
        slot(210, 45, 'Clean-up: hand over waste and return kits', 'Volunteers'),
      ],
    },
  ],
  functions: [],
  tasks: COMMUNITY_TASKS,
  vendors: COMMUNITY_VENDORS,
});
