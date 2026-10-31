/**
 * Wedding tasks; lead days are editorial estimates for a busy season. `after` only
 * names a task that always applies, so a dependency never points at a missing task.
 */
import type { TaskTemplate } from '../types.ts';
import { task } from '../templates.ts';

/** Every wedding task; the timeline keeps those whose `appliesWhen` matches. */
export const WEDDING_TASKS: readonly TaskTemplate[] = [
  task('set-budget', 'Agree the budget and guest estimate with both families', 180),
  task('book-officiant', 'Confirm the officiant and the muhurat or date', 160, {
    vendorId: 'officiant',
    minLead: 14,
  }),
  task('book-venue', 'Book the venue', 150, {
    after: 'set-budget',
    vendorId: 'venue',
    minLead: 21,
  }),
  task('book-caterer', 'Book the caterer after a tasting', 120, {
    after: 'book-venue',
    vendorId: 'caterer',
    minLead: 10,
  }),
  task('book-photographer', 'Book the photographer and videographer', 120, {
    vendorId: 'photographer',
    minLead: 14,
  }),
  task('book-decorator', 'Book the decorator and agree the mandap and stage design', 100, {
    after: 'book-venue',
    vendorId: 'decorator',
    minLead: 10,
  }),
  task('plan-travel', 'Book flights and transfers for the family', 100, {
    appliesWhen: { styles: ['destination'] },
    minLead: 21,
  }),
  task('book-makeup', 'Book the bridal makeup artist and a trial', 90, {
    vendorId: 'makeup-artist',
    minLead: 7,
  }),
  task('shop-attire', 'Shop for the bridal and groom outfits', 90, { minLead: 21 }),
  task('guest-list', 'Finalise the guest list with addresses', 75, { minLead: 14 }),
  task('book-dj', 'Book the DJ or band, with a dhol for the baraat', 75, {
    vendorId: 'dj',
    appliesWhen: { functions: ['sangeet', 'reception'] },
    minLead: 7,
  }),
  task('book-mehndi', 'Book the mehndi artist', 60, {
    vendorId: 'mehndi-artist',
    appliesWhen: { functions: ['mehndi'] },
    minLead: 5,
  }),
  task('order-invites', 'Order printed invitation cards', 60, {
    vendorId: 'printer',
    appliesWhen: { noConstraint: ['eco-friendly'] },
    minLead: 20,
  }),
  task('book-tent', 'Book the tent, lighting and sound for the open-air area', 60, {
    vendorId: 'tent-sound',
    appliesWhen: { settings: ['outdoor', 'mixed'] },
    minLead: 7,
  }),
  task('room-block', 'Block rooms for out-of-town guests', 60, { minLead: 14 }),
  task('book-bartender', 'Book the bar service and check the liquor licence', 45, {
    vendorId: 'bartender',
    appliesWhen: { noConstraint: ['alcohol-free', 'halal'] },
    minLead: 7,
  }),
  task('send-invites', 'Send invitations to every guest', 45, { after: 'guest-list', minLead: 14 }),
  task('sangeet-practice', 'Plan and rehearse the sangeet performances', 30, {
    appliesWhen: { functions: ['sangeet'] },
    minLead: 3,
  }),
  task('gifts', 'Buy and pack gifts and favours for guests', 21, { minLead: 3 }),
  task('final-fitting', 'Final fittings for every outfit', 14, { after: 'shop-attire' }),
  task('confirm-count', 'Collect RSVPs and confirm the final count with the caterer', 10, {
    after: 'send-invites',
    minLead: 3,
  }),
  task('seating', 'Plan seating, with elders close to the stage', 7, { minLead: 1 }),
  task('haldi-supplies', 'Buy turmeric, marigolds and old clothes for the haldi', 4, {
    appliesWhen: { functions: ['haldi'] },
    minLead: 1,
  }),
  task('cash-envelopes', 'Prepare envelopes for vendor balances and shagun', 2),
  task('day-kit', 'Pack a day-of kit: pins, medicines, chargers, snacks', 1),
  task('brief-coordinator', 'Give the run sheet and vendor contacts to a coordinator', 0),
  task('settle-balances', 'Settle the remaining vendor balances', -2),
  task('return-rentals', 'Return rented outfits, jewellery and decor', -3),
  task('thank-you', 'Send thank-you messages to guests and helpers', -7),
  task('collect-album', 'Collect the photos, film and album', -45),
];
