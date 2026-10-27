/**
 * Curated decor, activities and guest touches for the offline ideas. Entries are
 * frozen at load and tagged declaratively; within equal fit, earlier entries win.
 */
import type { IdeaItem } from '../types.ts';
import type { Tags } from './menu-catalogue.ts';

/** A decor, activity or touch idea with its tags. */
export type IdeaEntry = IdeaItem & Tags;

/** Decor ideas. */
export const DECOR: readonly IdeaEntry[] = Object.freeze([
  {
    title: 'Rain-ready canopy',
    detail: 'Waterproof canopy draped in light fabric so the setting survives a shower.',
    seasons: ['monsoon'],
    when: { settings: ['outdoor', 'mixed'] },
  },
  {
    title: 'Potted plants, not cut flowers',
    detail: 'Rent or gift potted plants that live on after the day.',
    when: { anyConstraint: ['eco-friendly'] },
  },
  {
    title: 'Clear, wide aisles',
    detail: 'Keep main paths wide and level, with seating near the entrance.',
    when: { anyConstraint: ['step-free'] },
  },
  {
    title: 'Marigold and mango-leaf torans',
    detail: 'Fresh torans over every doorway, the traditional welcome.',
    types: ['wedding', 'community'],
    when: { styles: ['traditional', 'festival'] },
  },
  { title: 'Fairy-light canopy', detail: 'Warm string lights overhead for a soft evening glow.' },
  {
    title: 'Pastel mandap by the view',
    detail: 'Light drapes and local flowers framing the landscape.',
    when: { styles: ['destination'] },
  },
  {
    title: 'Balloon arch in theme colours',
    detail: 'A bright arch at the entrance that doubles as a photo spot.',
    types: ['birthday'],
    when: { styles: ['kids'], noConstraint: ['eco-friendly'] },
  },
  {
    title: 'Photo timeline wall',
    detail: 'Pictures from every decade pinned along a ribbon.',
    when: { styles: ['milestone'] },
  },
  {
    title: 'Bunting and clay diyas',
    detail: 'Fabric bunting overhead and diyas along the paths.',
    when: { styles: ['festival', 'fundraiser'] },
  },
  {
    title: 'Upcycled sari banner',
    detail: 'A welcome banner stitched from old saris by volunteers.',
    types: ['community'],
  },
  {
    title: 'Brass urli with floating flowers',
    detail: 'A wide brass bowl of water and petals at the entrance.',
  },
  {
    title: 'Seasonal flower centrepieces',
    detail: 'Low arrangements of local flowers so guests can see each other.',
  },
  {
    title: 'Rangoli at the entrance',
    detail: 'A rangoli in the theme colours, made the morning of the event.',
  },
]);

/** Activities. */
export const ACTIVITIES: readonly IdeaEntry[] = Object.freeze([
  {
    title: "Kids' craft corner",
    detail: 'A supervised table with crayons, stickers and paper crowns.',
    when: { anyConstraint: ['kid-friendly'] },
  },
  {
    title: 'Mehndi with live dholak',
    detail: 'Folk songs on the dholak while the mehndi artists work.',
    when: { functions: ['mehndi'] },
  },
  {
    title: 'Sangeet family performances',
    detail: 'Each side of the family prepares one short dance.',
    when: { functions: ['sangeet'] },
  },
  {
    title: 'Sunset photo walk',
    detail: 'Fifteen minutes for the couple and family at golden hour.',
    when: { styles: ['destination'], noConstraint: ['step-free'] },
  },
  {
    title: 'Couple trivia',
    detail: 'Guests guess the answers to questions about the couple.',
    when: { styles: ['intimate', 'destination'] },
  },
  {
    title: 'Treasure hunt with picture clues',
    detail: 'Clues drawn as pictures, so children who cannot read can play.',
    when: { styles: ['kids'] },
  },
  {
    title: 'Magic show',
    detail: 'A thirty-minute show with plenty of volunteers from the audience.',
    when: { styles: ['kids'] },
  },
  {
    title: 'Memory lane slideshow',
    detail: 'Photos and short messages from friends across the years.',
    when: { styles: ['milestone'] },
  },
  {
    title: 'Karaoke hour',
    detail: 'Bollywood classics with lyrics on screen.',
    types: ['birthday'],
  },
  {
    title: 'Rangoli competition',
    detail: 'Teams of neighbours; the youngest and oldest guests pick the winner.',
    when: { styles: ['festival'] },
  },
  {
    title: 'Pledge wall',
    detail: 'Guests write what they will give or do on a big board.',
    when: { styles: ['fundraiser'] },
  },
  {
    title: 'Skill-share circles',
    detail: 'Small groups where each person teaches one thing in five minutes.',
    when: { styles: ['meetup'] },
  },
  {
    title: 'Team zones with leaders',
    detail: 'Split the area into zones, each with a leader and a sorting station.',
    when: { styles: ['clean-up'] },
  },
  {
    title: 'Before-and-after photo board',
    detail: 'Photograph each zone before and after to share the result.',
    when: { styles: ['clean-up'] },
  },
  { title: 'Antakshari', detail: 'The classic song game, played across two teams.' },
  { title: 'Photo booth with props', detail: 'A simple backdrop, a ring light and a props box.' },
  { title: 'Blessings jar', detail: 'Guests write wishes on cards to be read later.' },
]);

/** Guest-experience touches; one is chosen. */
export const TOUCHES: readonly IdeaEntry[] = Object.freeze([
  {
    title: 'Accessible welcome',
    detail: 'Reserved seats near the stage and a helper at the entrance.',
    when: { anyConstraint: ['step-free'] },
  },
  {
    title: 'Shade and water points',
    detail: 'Shaded seating and refill stations every few metres.',
    seasons: ['summer'],
    when: { settings: ['outdoor', 'mixed'] },
  },
  {
    title: 'Umbrella stand at the entrance',
    detail: 'Spare umbrellas and a towel basket for arriving guests.',
    seasons: ['monsoon'],
  },
  {
    title: 'Seed-paper thank-you cards',
    detail: 'Cards that guests can plant at home.',
    when: { anyConstraint: ['eco-friendly'] },
  },
  {
    title: 'Pick-your-own return gift',
    detail: 'Children choose one gift from a table as they leave.',
    when: { styles: ['kids'] },
  },
  {
    title: 'Volunteer welcome desk',
    detail: 'A clearly marked desk for directions, first aid and lost items.',
    types: ['community'],
  },
  {
    title: 'Comfort kit',
    detail: 'Safety pins, wet wipes and footwear care at the washrooms.',
    types: ['wedding'],
  },
]);

/** Used when no touch is targeted at the event. */
export const DEFAULT_TOUCH: IdeaEntry = Object.freeze({
  title: 'Handwritten welcome',
  detail: 'A short note of thanks on every table.',
});
