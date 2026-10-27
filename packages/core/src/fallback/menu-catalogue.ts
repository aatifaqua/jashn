/**
 * Curated menu suggestions for the offline ideas. Each dish is tagged with the strictest diet
 * it suits, so filtering by the declared constraints is a single field comparison.
 */
import type { Applicability } from '../profile-types.ts';
import type { EventType, IdeaItem } from '../types.ts';

/** Seasons as in design section 6.1; months may belong to two of them. */
export type Season = 'peak' | 'monsoon' | 'summer';

/** Optional tags that narrow where a catalogue entry fits; an absent tag matches anything. */
export interface Tags {
  readonly types?: readonly EventType[];
  readonly when?: Applicability;
  readonly seasons?: readonly Season[];
}

/** jain ⊂ veg: a Jain dish has no meat, egg, roots or bulbs; veg has no meat or egg. */
export type Diet = 'jain' | 'veg' | 'egg' | 'meat';

/** Where a dish sits in the meal; the fallback picks one per course. */
export type Course = 'drink' | 'starter' | 'main' | 'dessert';

/** A dish with its diet, course and, for drinks, whether it contains alcohol. */
export interface Dish extends IdeaItem, Tags {
  readonly diet: Diet;
  readonly course: Course;
  readonly alcohol?: true;
}

/** Frozen at load; ordered so the first fitting entry of a course is the best default. */
export const DISHES: readonly Dish[] = Object.freeze([
  {
    title: 'Aam panna cooler',
    detail: 'Raw mango, roasted cumin and mint, chilled for warm afternoons.',
    diet: 'jain',
    course: 'drink',
    seasons: ['summer'],
  },
  {
    title: 'Kulhad masala chai',
    detail: 'Chai brewed with cardamom and cinnamon, poured into clay cups.',
    diet: 'jain',
    course: 'drink',
    seasons: ['peak', 'monsoon'],
  },
  {
    title: 'Signature cocktail hour',
    detail: 'Two short cocktails named after the couple, served at sunset.',
    diet: 'veg',
    course: 'drink',
    alcohol: true,
    types: ['wedding'],
    when: { styles: ['destination'] },
  },
  {
    title: 'Wine and craft beer bar',
    detail: 'A small curated bar with a bartender who checks ages.',
    diet: 'veg',
    course: 'drink',
    alcohol: true,
    types: ['birthday'],
    when: { styles: ['adult', 'milestone'] },
  },
  {
    title: 'Rose and cardamom sherbet',
    detail: 'Chilled rose sherbet with a hint of cardamom, served at the welcome.',
    diet: 'jain',
    course: 'drink',
  },
  {
    title: 'Sweet corn bhel cups',
    detail: 'Corn, puffed rice, pomegranate and lime, served in leaf cones.',
    diet: 'jain',
    course: 'starter',
    types: ['community', 'birthday'],
  },
  {
    title: 'Mini paneer sliders',
    detail: 'Soft buns with paneer patties that small hands can hold.',
    diet: 'veg',
    course: 'starter',
    types: ['birthday'],
    when: { styles: ['kids'] },
  },
  {
    title: 'Egg puffs',
    detail: 'Flaky bakery puffs, a teatime favourite.',
    diet: 'egg',
    course: 'starter',
    types: ['birthday', 'community'],
  },
  {
    title: 'Chicken seekh kebabs',
    detail: 'Minced chicken kebabs off the grill with mint chutney.',
    diet: 'meat',
    course: 'starter',
    types: ['wedding', 'birthday'],
  },
  {
    title: 'Chaat counter',
    detail: 'Aloo tikki, papdi chaat and pani puri made to order.',
    diet: 'veg',
    course: 'starter',
  },
  {
    title: 'Dhokla and khandvi platter',
    detail: 'Steamed gram-flour bites tempered with mustard seeds and curry leaves.',
    diet: 'jain',
    course: 'starter',
  },
  {
    title: 'Mutton dum biryani',
    detail: 'Slow-cooked biryani layered with saffron rice, served with raita.',
    diet: 'meat',
    course: 'main',
    types: ['wedding'],
  },
  {
    title: 'Coastal fish curry',
    detail: 'Kokum fish curry with steamed rice, a nod to the seaside.',
    diet: 'meat',
    course: 'main',
    types: ['wedding'],
    when: { styles: ['destination'] },
  },
  {
    title: 'Live pasta counter',
    detail: 'Penne tossed to order in a tomato or white sauce.',
    diet: 'veg',
    course: 'main',
    types: ['birthday'],
  },
  {
    title: 'Khichdi and kadhi',
    detail: 'One-pot moong khichdi with kadhi; quick to serve to a big crowd.',
    diet: 'jain',
    course: 'main',
    types: ['community'],
  },
  {
    title: 'Pav bhaji',
    detail: 'Buttery bhaji with toasted pav, a crowd favourite.',
    diet: 'veg',
    course: 'main',
    types: ['community', 'birthday'],
  },
  {
    title: 'Dal makhani and tandoori breads',
    detail: 'Slow-cooked black dal with butter naan and laccha paratha.',
    diet: 'veg',
    course: 'main',
  },
  {
    title: 'Gatte ki sabzi with jeera rice',
    detail: 'Rajasthani gram-flour dumplings in a yoghurt gravy.',
    diet: 'jain',
    course: 'main',
  },
  {
    title: 'Jain thali',
    detail: 'Paneer in tomato-cashew gravy, raw banana sabzi, dal and phulka.',
    diet: 'jain',
    course: 'main',
  },
  {
    title: 'Kulfi cart',
    detail: 'Malai and pista kulfi sliced to order from a cart.',
    diet: 'jain',
    course: 'dessert',
    seasons: ['summer'],
  },
  {
    title: 'Gajar halwa',
    detail: 'Winter carrot halwa slow-cooked with milk and nuts.',
    diet: 'veg',
    course: 'dessert',
    seasons: ['peak'],
  },
  {
    title: 'Eggless celebration cake',
    detail: 'A cake baked eggless so every guest can share a slice.',
    diet: 'jain',
    course: 'dessert',
    types: ['birthday'],
  },
  {
    title: 'Jalebi with rabdi',
    detail: 'Hot jalebis with chilled rabdi, made in front of guests.',
    diet: 'jain',
    course: 'dessert',
    types: ['community', 'wedding'],
  },
  {
    title: 'Gulab jamun and shrikhand',
    detail: 'Warm gulab jamun beside saffron shrikhand.',
    diet: 'jain',
    course: 'dessert',
  },
]);
