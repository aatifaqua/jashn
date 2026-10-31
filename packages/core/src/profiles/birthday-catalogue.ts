/**
 * Birthday catalogues (design 6.5, 6.6), for parties planned one to six weeks ahead. `after` only
 * names tasks that always apply; each vendor's `appliesWhen` mirrors its booking task's.
 */
import type { TaskTemplate, VendorTemplate } from '../types.ts';
import { task } from '../templates.ts';

/** Every birthday task; the timeline keeps those whose `appliesWhen` matches. */
export const BIRTHDAY_TASKS: readonly TaskTemplate[] = [
  task('set-budget', 'Set the budget and the guest list', 35),
  task('book-venue', 'Book the venue or party hall', 30, {
    after: 'set-budget',
    vendorId: 'venue',
    minLead: 5,
  }),
  task('book-caterer', 'Book the caterer or restaurant', 21, {
    after: 'book-venue',
    vendorId: 'caterer',
    minLead: 3,
  }),
  task('book-entertainer', 'Book the entertainer (magician, puppet show or games host)', 21, {
    vendorId: 'entertainer',
    appliesWhen: { styles: ['kids'] },
    minLead: 4,
  }),
  task('book-dj', 'Book the DJ or a live act', 21, {
    vendorId: 'dj',
    appliesWhen: { styles: ['milestone', 'adult'] },
    minLead: 3,
  }),
  task('book-photographer', 'Book a photographer', 21, { vendorId: 'photographer', minLead: 3 }),
  task('book-decorator', 'Book the balloon and theme decorator', 14, {
    vendorId: 'decorator',
    minLead: 3,
  }),
  task('send-invites', 'Send invitations', 14, { after: 'set-budget', minLead: 5 }),
  task('book-bartender', 'Book a bartender and check the liquor licence', 14, {
    vendorId: 'bartender',
    appliesWhen: { styles: ['milestone', 'adult'], noConstraint: ['alcohol-free', 'halal'] },
    minLead: 3,
  }),
  task('memories', 'Collect old photos for a memories slideshow', 14, {
    appliesWhen: { styles: ['milestone'] },
    minLead: 2,
  }),
  task('order-cake', 'Order the cake and confirm the message on it', 7, {
    vendorId: 'baker',
    minLead: 2,
  }),
  task('return-gifts', 'Buy and pack return gifts', 7, {
    appliesWhen: { styles: ['kids'] },
    minLead: 1,
  }),
  task('plan-games', 'Plan games and small prizes for the children', 7, {
    appliesWhen: { styles: ['kids'] },
  }),
  task('confirm-count', 'Confirm RSVPs and the final count with the caterer', 4, {
    after: 'send-invites',
    minLead: 1,
  }),
  task('supplies', 'Buy candles, plates, napkins and party supplies', 3),
  task('playlist', 'Make the music playlist', 3),
  task('set-up', 'Set up the decor and receive the cake', 0),
  task('settle-balances', 'Return rented items and settle balances', -1),
  task('thank-you', 'Send thank-you messages and photos', -3),
];

/** Every birthday vendor; the list keeps those whose `appliesWhen` matches. */
export const BIRTHDAY_VENDORS: readonly VendorTemplate[] = [
  {
    id: 'venue',
    label: 'Venue or party hall',
    category: 'venue',
    taskId: 'book-venue',
    depositShare: 0.3,
    questions: [
      'Is the hall free on the date, and for how many hours?',
      'Can we bring our own cake and decorator?',
      'Is there a minimum spend or a fixed package per head?',
    ],
  },
  {
    id: 'caterer',
    label: 'Caterer or restaurant',
    category: 'food',
    taskId: 'book-caterer',
    depositShare: 0.25,
    questions: [
      'What is the per-head rate for snacks and dinner, including GST?',
      'Do you have a separate menu for children?',
      'What is the minimum order, and the last day to change the count?',
    ],
  },
  {
    id: 'photographer',
    label: 'Photographer',
    category: 'photography',
    taskId: 'book-photographer',
    depositShare: 0.3,
    questions: [
      'How many hours and edited photos does the package include?',
      'When will we receive the photos?',
    ],
  },
  {
    id: 'decorator',
    label: 'Balloon and theme decorator',
    category: 'decor',
    taskId: 'book-decorator',
    depositShare: 0.3,
    questions: [
      'Can you share photos of this theme from earlier parties?',
      'How long does set-up take, and do you clear up afterwards?',
      'Are the balloons latex or foil, and can you avoid plastic confetti?',
    ],
  },
  {
    id: 'entertainer',
    label: 'Entertainer (magician, puppeteer or games host)',
    category: 'entertainment',
    taskId: 'book-entertainer',
    depositShare: 0.2,
    appliesWhen: { styles: ['kids'] },
    questions: [
      'What age group is the act designed for?',
      'How long is the show, and what space and sound do you need?',
      'Do you bring your own props and prizes?',
    ],
  },
  {
    id: 'dj',
    label: 'DJ or live act',
    category: 'entertainment',
    taskId: 'book-dj',
    depositShare: 0.2,
    appliesWhen: { styles: ['milestone', 'adult'] },
    questions: [
      'Do you bring sound and lights for the room size?',
      'Will you play a list we send?',
      'What is the overtime rate?',
    ],
  },
  {
    id: 'baker',
    label: 'Cake baker',
    category: 'food',
    taskId: 'order-cake',
    depositShare: 0.2,
    lineShare: 0.15,
    questions: [
      'What size of cake serves our guest count?',
      'Do you deliver, and at what time?',
      'Can the design match the party theme?',
    ],
  },
  {
    id: 'bartender',
    label: 'Bartender',
    category: 'bar',
    taskId: 'book-bartender',
    depositShare: 0.2,
    appliesWhen: { styles: ['milestone', 'adult'], noConstraint: ['alcohol-free', 'halal'] },
    questions: [
      'Do you arrange the one-day liquor licence?',
      'Is the bar priced per head or per bottle?',
      'Can you add a mocktail menu for guests who do not drink?',
    ],
  },
];
