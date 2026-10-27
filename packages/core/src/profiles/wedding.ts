/**
 * Wedding profile: budget weights, styles, functions, run sheets, tasks and vendors. Every
 * figure is an editorial planning estimate for India, not a quote.
 */
import type { Profile } from '../types.ts';
import { deepFreeze } from './freeze.ts';
import { slot } from './slot.ts';
import { WEDDING_TASKS } from './wedding-tasks.ts';
import { WEDDING_VENDORS } from './wedding-vendors.ts';

/**
 * The wedding profile, deep-frozen at module load so every plan shares one immutable table.
 * Function run sheets are offsets from the event start time on that function's own day; the
 * ceremony has no function run sheet because the style's run sheet is the ceremony day.
 */
export const WEDDING: Profile = deepFreeze<Profile>({
  type: 'wedding',
  label: 'Wedding',
  turnout: 0.85,
  floors: { metro: 3000, tier2: 2000, town: 1200 },
  minLeadDays: 90,
  categories: [
    { id: 'venue', label: 'Venue', weight: 18 },
    { id: 'catering', label: 'Catering', weight: 30 },
    { id: 'decor', label: 'Decor and flowers', weight: 10 },
    { id: 'photography', label: 'Photography and video', weight: 8 },
    { id: 'attire', label: 'Attire and beauty', weight: 10 },
    { id: 'entertainment', label: 'Music and entertainment', weight: 5 },
    { id: 'invitations', label: 'Invitations', weight: 2 },
    { id: 'gifts', label: 'Gifts, favours and dakshina', weight: 3 },
    { id: 'travel', label: 'Travel and stay', weight: 4 },
    { id: 'bar', label: 'Bar', weight: 0 },
  ],
  styles: [
    {
      id: 'traditional',
      label: 'Traditional',
      startTime: '18:00',
      walkIn: 1,
      deltas: [
        { category: 'decor', points: 2 },
        { category: 'bar', points: 2 },
      ],
      runSheet: [
        slot(-240, 150, 'Bride and groom get ready', 'Makeup artist'),
        slot(-120, 60, 'Final check of mandap, stage and lights', 'Decorator'),
        slot(-60, 60, 'Baraat gathers and dances to the venue', "Groom's family"),
        slot(0, 30, 'Milni and welcome at the gate', 'Both families'),
        slot(30, 30, 'Jaimala on the stage', 'Couple'),
        slot(60, 150, 'Dinner service open', 'Caterer'),
        slot(120, 150, 'Wedding rituals at the mandap', 'Officiant'),
        slot(270, 30, 'Blessings and family photographs', 'Photographer'),
        slot(300, 30, 'Vidaai', "Bride's family"),
      ],
    },
    {
      id: 'intimate',
      label: 'Intimate',
      startTime: '11:00',
      walkIn: 1,
      deltas: [
        { category: 'catering', points: 4 },
        { category: 'decor', points: -2 },
        { category: 'bar', points: 1 },
      ],
      runSheet: [
        slot(-150, 120, 'Couple gets ready', 'Makeup artist'),
        slot(-45, 45, 'Close family arrives; welcome drinks', 'Host family'),
        slot(0, 90, 'Wedding rituals', 'Officiant'),
        slot(90, 30, 'Blessings and portraits', 'Photographer'),
        slot(120, 90, 'Lunch with family and friends', 'Caterer'),
        slot(210, 30, 'Toasts and thank-yous', 'Couple'),
      ],
    },
    {
      id: 'destination',
      label: 'Destination',
      startTime: '17:00',
      walkIn: 1,
      deltas: [
        { category: 'travel', points: 8 },
        { category: 'bar', points: 3 },
      ],
      runSheet: [
        slot(-300, 180, 'Bride and groom get ready', 'Makeup artist'),
        slot(-120, 60, 'Guest shuttles from the hotel to the venue', 'Travel coordinator'),
        slot(-60, 60, 'Baraat procession', "Groom's family"),
        slot(0, 30, 'Welcome and jaimala', 'Both families'),
        slot(30, 120, 'Wedding rituals', 'Officiant'),
        slot(150, 30, 'Sunset portraits', 'Photographer'),
        slot(180, 120, 'Dinner', 'Caterer'),
        slot(300, 60, 'Shuttles back to the hotel', 'Travel coordinator'),
      ],
    },
  ],
  functions: [
    {
      id: 'haldi',
      label: 'Haldi',
      guestShare: 0.4,
      runSheet: [
        slot(-480, 60, 'Set up haldi seating and marigold decor', 'Decorator'),
        slot(-420, 90, 'Haldi ceremony', 'Family'),
        slot(-330, 90, 'Lunch', 'Caterer'),
      ],
    },
    {
      id: 'mehndi',
      label: 'Mehndi',
      guestShare: 0.6,
      runSheet: [
        slot(-150, 30, 'Mehndi artists set up', 'Mehndi artist'),
        slot(-120, 180, 'Mehndi for the bride and guests', 'Mehndi artist'),
        slot(-60, 120, 'Music, games and snacks', 'Host family'),
        slot(60, 90, 'Dinner', 'Caterer'),
      ],
    },
    {
      id: 'sangeet',
      label: 'Sangeet',
      guestShare: 0.8,
      runSheet: [
        slot(-90, 60, 'Sound check and stage rehearsal', 'DJ'),
        slot(0, 30, 'Guests arrive; welcome drinks', 'Host family'),
        slot(30, 90, 'Family performances', 'Emcee'),
        slot(120, 60, 'Open dance floor', 'DJ'),
        slot(150, 90, 'Dinner', 'Caterer'),
      ],
    },
    { id: 'ceremony', label: 'Wedding ceremony', guestShare: 1, runSheet: [] },
    {
      id: 'reception',
      label: 'Reception',
      guestShare: 1,
      runSheet: [
        slot(-60, 60, 'Stage and lighting check', 'Decorator'),
        slot(0, 30, "Couple's entry", 'Emcee'),
        slot(30, 150, 'Guests greet the couple on stage', 'Photographer'),
        slot(60, 150, 'Dinner buffet', 'Caterer'),
        slot(210, 30, 'Send-off', 'Both families'),
      ],
    },
  ],
  tasks: WEDDING_TASKS,
  vendors: WEDDING_VENDORS,
});
