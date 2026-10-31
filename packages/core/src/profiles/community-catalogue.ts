/**
 * Community catalogues (design 6.5, 6.6). Permission tasks come from the public-gathering rule.
 * `after` only names tasks that always apply; each vendor's `appliesWhen` mirrors its task's.
 */
import type { StyleId, TaskTemplate, VendorTemplate } from '../types.ts';
import { task } from '../templates.ts';

/** Styles that need a stage, sound and catering; a clean-up drive needs none of them. */
const STAGED: readonly StyleId[] = ['festival', 'fundraiser', 'meetup'];

/** Every community task; the timeline keeps those whose `appliesWhen` matches. */
export const COMMUNITY_TASKS: readonly TaskTemplate[] = [
  task('form-team', 'Form the organising team and set the budget', 60),
  task('book-venue', 'Book the ground, park or hall', 45, {
    after: 'form-team',
    vendorId: 'venue',
    minLead: 14,
  }),
  task('sponsors', 'Approach sponsors and local businesses', 45, { minLead: 10 }),
  task('book-tent', 'Book the tent, stage, sound and lights', 30, {
    after: 'book-venue',
    vendorId: 'tent-sound',
    appliesWhen: { styles: STAGED },
    minLead: 7,
  }),
  task('book-caterer', 'Book food stalls or the caterer', 30, {
    vendorId: 'caterer',
    appliesWhen: { styles: STAGED },
    minLead: 7,
  }),
  task('book-performers', 'Book performers, speakers or a host', 30, {
    vendorId: 'entertainer',
    appliesWhen: { styles: STAGED },
    minLead: 7,
  }),
  task('donations', 'Set up online donations and a receipt process', 21, {
    appliesWhen: { styles: ['fundraiser'] },
    minLead: 5,
  }),
  task('book-sanitation', 'Book portable toilets, bins and a waste collector', 21, {
    vendorId: 'sanitation',
    minLead: 5,
  }),
  task('volunteers', 'Recruit volunteers and assign roles', 21, { minLead: 5 }),
  task('publicity', 'Start publicity: posters, social media and resident groups', 21, {
    minLead: 5,
  }),
  task('print-banners', 'Print banners and posters', 14, {
    vendorId: 'printer',
    appliesWhen: { noConstraint: ['eco-friendly'] },
    minLead: 4,
  }),
  task('volunteer-kit', 'Order volunteer T-shirts, badges, gloves and bags', 14, { minLead: 4 }),
  task('book-photographer', 'Ask a photographer or volunteer to cover the event', 14, {
    vendorId: 'photographer',
    minLead: 2,
  }),
  task('volunteer-food', 'Arrange water and breakfast for volunteers', 7, {
    appliesWhen: { styles: ['clean-up'] },
    minLead: 1,
  }),
  task('site-walk', 'Walk the site: entry, exits, power and drinking water', 7, {
    after: 'book-venue',
    minLead: 1,
  }),
  task('first-aid-kit', 'Stock the first-aid kit and note the nearest hospital', 5, { minLead: 1 }),
  task('briefing-notes', 'Write the volunteer briefing and run sheet', 3),
  task('brief-volunteers', 'Run the volunteer briefing', 0),
  task('clear-site', 'Clear the site and hand it back', -1),
  task('publish-accounts', 'Publish the accounts and thank sponsors', -7),
  task('share-outcome', 'Share photos and the outcome with the community', -10),
];

/** Every community vendor; the list keeps those whose `appliesWhen` matches. */
export const COMMUNITY_VENDORS: readonly VendorTemplate[] = [
  {
    id: 'venue',
    label: 'Ground, park or community hall',
    category: 'venue',
    taskId: 'book-venue',
    depositShare: 0.3,
    questions: [
      'Who grants use of the ground, and what fee or deposit applies?',
      'What are the permitted hours and the sound limit?',
      'Is there drinking water, power and a clear emergency exit?',
    ],
  },
  {
    id: 'tent-sound',
    label: 'Tent, stage, sound and lights',
    category: 'infrastructure',
    taskId: 'book-tent',
    depositShare: 0.2,
    appliesWhen: { styles: STAGED },
    questions: [
      'Is the tent fabric fire-retardant, and do you supply extinguishers?',
      'Do you bring a generator, and is fuel included?',
      'How long do set-up and take-down take?',
    ],
  },
  {
    id: 'caterer',
    label: 'Food stalls or caterer',
    category: 'food',
    taskId: 'book-caterer',
    depositShare: 0.25,
    appliesWhen: { styles: STAGED },
    questions: [
      'What is the per-plate or per-stall rate?',
      'Do you hold an FSSAI food licence?',
      'Can you serve in disposable-free plates and cups?',
    ],
  },
  {
    id: 'entertainer',
    label: 'Performers, speakers or host',
    category: 'programme',
    taskId: 'book-performers',
    depositShare: 0.2,
    appliesWhen: { styles: STAGED },
    questions: [
      'How long is the act, and what stage space and sound do you need?',
      'Is your fee waived or reduced for a community cause?',
    ],
  },
  {
    id: 'sanitation',
    label: 'Portable toilets and waste collection',
    category: 'sanitation',
    taskId: 'book-sanitation',
    depositShare: 0.2,
    questions: [
      'How many toilets do you recommend for our expected crowd?',
      'Do you collect segregated wet and dry waste?',
      'When do you deliver and pick up?',
    ],
  },
  {
    id: 'printer',
    label: 'Banner and poster printer',
    category: 'publicity',
    taskId: 'print-banners',
    depositShare: 0.2,
    appliesWhen: { noConstraint: ['eco-friendly'] },
    questions: ['Can you print on cloth or recycled stock?', 'How quickly can you deliver?'],
  },
  {
    id: 'photographer',
    label: 'Photographer',
    category: 'publicity',
    taskId: 'book-photographer',
    depositShare: 0.3,
    questions: [
      'Can you cover the opening and the main programme?',
      'Can we use the photos freely for publicity?',
    ],
  },
];
