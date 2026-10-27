/**
 * Community event task and vendor catalogues (design 6.5, 6.6). Permission tasks come from the
 * public-gathering rule, not from here, because they depend on crowd size and setting. `after`
 * only names tasks that always apply, and each vendor's `appliesWhen` mirrors its task's.
 */
import type { StyleId, TaskTemplate, VendorTemplate } from '../types.ts';

/** Styles that need a stage, sound and catering; a clean-up drive needs none of them. */
const STAGED: readonly StyleId[] = ['festival', 'fundraiser', 'meetup'];

/** Every community task; the timeline keeps those whose `appliesWhen` matches the input. */
export const COMMUNITY_TASKS: readonly TaskTemplate[] = [
  { id: 'form-team', title: 'Form the organising team and set the budget', leadDays: 60 },
  {
    id: 'book-venue',
    title: 'Book the ground, park or hall',
    leadDays: 45,
    after: 'form-team',
    vendorId: 'venue',
    minLead: 14,
  },
  { id: 'sponsors', title: 'Approach sponsors and local businesses', leadDays: 45, minLead: 10 },
  {
    id: 'book-tent',
    title: 'Book the tent, stage, sound and lights',
    leadDays: 30,
    after: 'book-venue',
    vendorId: 'tent-sound',
    appliesWhen: { styles: STAGED },
    minLead: 7,
  },
  {
    id: 'book-caterer',
    title: 'Book food stalls or the caterer',
    leadDays: 30,
    vendorId: 'caterer',
    appliesWhen: { styles: STAGED },
    minLead: 7,
  },
  {
    id: 'book-performers',
    title: 'Book performers, speakers or a host',
    leadDays: 30,
    vendorId: 'entertainer',
    appliesWhen: { styles: STAGED },
    minLead: 7,
  },
  {
    id: 'donations',
    title: 'Set up online donations and a receipt process',
    leadDays: 21,
    appliesWhen: { styles: ['fundraiser'] },
    minLead: 5,
  },
  {
    id: 'book-sanitation',
    title: 'Book portable toilets, bins and a waste collector',
    leadDays: 21,
    vendorId: 'sanitation',
    minLead: 5,
  },
  { id: 'volunteers', title: 'Recruit volunteers and assign roles', leadDays: 21, minLead: 5 },
  {
    id: 'publicity',
    title: 'Start publicity: posters, social media and resident groups',
    leadDays: 21,
    minLead: 5,
  },
  {
    id: 'print-banners',
    title: 'Print banners and posters',
    leadDays: 14,
    vendorId: 'printer',
    appliesWhen: { noConstraint: ['eco-friendly'] },
    minLead: 4,
  },
  {
    id: 'volunteer-kit',
    title: 'Order volunteer T-shirts, badges, gloves and bags',
    leadDays: 14,
    minLead: 4,
  },
  {
    id: 'book-photographer',
    title: 'Ask a photographer or volunteer to cover the event',
    leadDays: 14,
    vendorId: 'photographer',
    minLead: 2,
  },
  {
    id: 'volunteer-food',
    title: 'Arrange water and breakfast for volunteers',
    leadDays: 7,
    appliesWhen: { styles: ['clean-up'] },
    minLead: 1,
  },
  {
    id: 'site-walk',
    title: 'Walk the site: entry, exits, power and drinking water',
    leadDays: 7,
    after: 'book-venue',
    minLead: 1,
  },
  {
    id: 'first-aid-kit',
    title: 'Stock the first-aid kit and note the nearest hospital',
    leadDays: 5,
    minLead: 1,
  },
  { id: 'briefing-notes', title: 'Write the volunteer briefing and run sheet', leadDays: 3 },
  { id: 'brief-volunteers', title: 'Run the volunteer briefing', leadDays: 0 },
  { id: 'clear-site', title: 'Clear the site and hand it back', leadDays: -1 },
  { id: 'publish-accounts', title: 'Publish the accounts and thank sponsors', leadDays: -7 },
  { id: 'share-outcome', title: 'Share photos and the outcome with the community', leadDays: -10 },
];

/** Every community vendor; the vendor list keeps those whose `appliesWhen` matches the input. */
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
