/**
 * Birthday task and vendor catalogues (design 6.5, 6.6). Lead days suit parties planned one to
 * six weeks ahead. `after` only names tasks that always apply, and each vendor's
 * `appliesWhen` mirrors its booking task's.
 */
import type { TaskTemplate, VendorTemplate } from '../types.ts';

/** Every birthday task; the timeline keeps those whose `appliesWhen` matches the input. */
export const BIRTHDAY_TASKS: readonly TaskTemplate[] = [
  { id: 'set-budget', title: 'Set the budget and the guest list', leadDays: 35 },
  {
    id: 'book-venue',
    title: 'Book the venue or party hall',
    leadDays: 30,
    after: 'set-budget',
    vendorId: 'venue',
    minLead: 5,
  },
  {
    id: 'book-caterer',
    title: 'Book the caterer or restaurant',
    leadDays: 21,
    after: 'book-venue',
    vendorId: 'caterer',
    minLead: 3,
  },
  {
    id: 'book-entertainer',
    title: 'Book the entertainer (magician, puppet show or games host)',
    leadDays: 21,
    vendorId: 'entertainer',
    appliesWhen: { styles: ['kids'] },
    minLead: 4,
  },
  {
    id: 'book-dj',
    title: 'Book the DJ or a live act',
    leadDays: 21,
    vendorId: 'dj',
    appliesWhen: { styles: ['milestone', 'adult'] },
    minLead: 3,
  },
  {
    id: 'book-photographer',
    title: 'Book a photographer',
    leadDays: 21,
    vendorId: 'photographer',
    minLead: 3,
  },
  {
    id: 'book-decorator',
    title: 'Book the balloon and theme decorator',
    leadDays: 14,
    vendorId: 'decorator',
    minLead: 3,
  },
  {
    id: 'send-invites',
    title: 'Send invitations',
    leadDays: 14,
    after: 'set-budget',
    minLead: 5,
  },
  {
    id: 'book-bartender',
    title: 'Book a bartender and check the liquor licence',
    leadDays: 14,
    vendorId: 'bartender',
    appliesWhen: { styles: ['milestone', 'adult'], noConstraint: ['alcohol-free', 'halal'] },
    minLead: 3,
  },
  {
    id: 'memories',
    title: 'Collect old photos for a memories slideshow',
    leadDays: 14,
    appliesWhen: { styles: ['milestone'] },
    minLead: 2,
  },
  {
    id: 'order-cake',
    title: 'Order the cake and confirm the message on it',
    leadDays: 7,
    vendorId: 'baker',
    minLead: 2,
  },
  {
    id: 'return-gifts',
    title: 'Buy and pack return gifts',
    leadDays: 7,
    appliesWhen: { styles: ['kids'] },
    minLead: 1,
  },
  {
    id: 'plan-games',
    title: 'Plan games and small prizes for the children',
    leadDays: 7,
    appliesWhen: { styles: ['kids'] },
  },
  {
    id: 'confirm-count',
    title: 'Confirm RSVPs and the final count with the caterer',
    leadDays: 4,
    after: 'send-invites',
    minLead: 1,
  },
  { id: 'supplies', title: 'Buy candles, plates, napkins and party supplies', leadDays: 3 },
  { id: 'playlist', title: 'Make the music playlist', leadDays: 3 },
  { id: 'set-up', title: 'Set up the decor and receive the cake', leadDays: 0 },
  { id: 'settle-balances', title: 'Return rented items and settle balances', leadDays: -1 },
  { id: 'thank-you', title: 'Send thank-you messages and photos', leadDays: -3 },
];

/** Every birthday vendor; the vendor list keeps those whose `appliesWhen` matches the input. */
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
