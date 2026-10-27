/**
 * Offline ideas (design section 7, /api/ideas fallback): picks from the curated catalogue by
 * event type, style, functions, needs, setting and season. Menus always respect the declared
 * diet: Jain and vegetarian filter dishes, halal and alcohol-free drop alcohol, and halal
 * marks meat dishes for a certified kitchen.
 */
import { applies } from '../applies.ts';
import { seasonOf } from '../context.ts';
import { fromIso, month } from '../days.ts';
import type { Constraint, EventInput, IdeaItem, Ideas } from '../types.ts';
import { formatLongDay, occasion, withArticle } from '../text.ts';
import { ACTIVITIES, DECOR, DEFAULT_TOUCH, TOUCHES, type IdeaEntry } from './ideas-catalogue.ts';
import { DISHES, type Course, type Dish, type Season, type Tags } from './menu-catalogue.ts';
import { DEFAULT_THEME, THEMES } from './themes.ts';

/** Courses in serving order. */
const COURSES: readonly Course[] = Object.freeze(['drink', 'starter', 'main', 'dessert']);

const CLOSINGS = Object.freeze({
  wedding: 'Your presence and blessings will make the day complete.',
  birthday: 'Come ready to celebrate!',
  community: 'Everyone is welcome; bring family, friends and neighbours.',
});

/** The catalogue's season tags for a calendar month, from the context's season definition. */
function seasonsOf(monthNumber: number): readonly Season[] {
  const { peakWedding, monsoon, summer } = seasonOf(monthNumber);
  const tagged: readonly [boolean, Season][] = [
    [peakWedding, 'peak'],
    [monsoon, 'monsoon'],
    [summer, 'summer'],
  ];
  return tagged.filter(([on]) => on).map(([, season]) => season);
}

function fits(entry: Tags, input: EventInput, seasons: readonly Season[]): boolean {
  return (
    (entry.types === undefined || entry.types.includes(input.type)) &&
    (entry.seasons === undefined || entry.seasons.some((season) => seasons.includes(season))) &&
    applies(entry.when, input)
  );
}

/** How narrowly an entry is targeted; a better-targeted fit beats a generic one. */
function specificity(entry: Tags): number {
  const when = entry.when === undefined ? 0 : Object.keys(entry.when).length;
  return when + (entry.types === undefined ? 0 : 1) + (entry.seasons === undefined ? 0 : 1);
}

/**
 * The `count` best-fitting entries, most specific first. Array sort is stable, so catalogue
 * order breaks ties and the result is deterministic.
 */
function pick<T extends Tags>(
  list: readonly T[],
  count: number,
  matches: (entry: T) => boolean,
): T[] {
  return list
    .filter(matches)
    .sort((a, b) => specificity(b) - specificity(a))
    .slice(0, count);
}

function dietAllows(dish: Dish, constraints: readonly Constraint[]): boolean {
  const has = (id: Constraint): boolean => constraints.includes(id);
  if (dish.alcohol === true && (has('alcohol-free') || has('halal'))) return false;
  if (has('jain')) return dish.diet === 'jain';
  return !has('vegetarian') || dish.diet === 'veg' || dish.diet === 'jain';
}

function toItem({ title, detail }: IdeaEntry | Dish): IdeaItem {
  return { title, detail };
}

function menu(input: EventInput, seasons: readonly Season[]): IdeaItem[] {
  const halal = input.constraints.includes('halal');
  const usable = pick(
    DISHES,
    DISHES.length,
    (dish) => fits(dish, input, seasons) && dietAllows(dish, input.constraints),
  );
  // One dish per course and two mains, taken best-first in a single pass.
  const left: Record<Course, number> = { drink: 1, starter: 1, main: 2, dessert: 1 };
  const chosen = usable.filter((dish) => {
    left[dish.course] -= 1;
    return left[dish.course] >= 0;
  });
  chosen.sort((a, b) => COURSES.indexOf(a.course) - COURSES.indexOf(b.course));
  return chosen.map((dish) =>
    halal && dish.diet === 'meat'
      ? { title: dish.title, detail: `${dish.detail} From a halal-certified kitchen.` }
      : toItem(dish),
  );
}

function invitation(input: EventInput): string {
  const day = fromIso(input.date);
  const when = day === null ? '' : ` on ${formatLongDay(day)}`;
  const where = input.city === '' ? '' : ` in ${input.city}`;
  const extras = [
    input.constraints.includes('kid-friendly') ? 'Children are very welcome.' : '',
    input.constraints.includes('eco-friendly') ? 'Please skip plastic gift wrap.' : '',
  ].filter((line) => line !== '');
  return [
    `We warmly invite you to our ${occasion(input)}${where}${when}, starting at ${input.startTime}.`,
    CLOSINGS[input.type],
    ...extras,
    'Kindly let us know if you can join us.',
  ].join(' ');
}

/**
 * Builds a complete Ideas object from the catalogue alone: a theme, three decor ideas, three
 * to five dishes that respect the diet, three activities, one guest touch and an invitation.
 */
export function ideasOffline(input: EventInput): Ideas {
  const day = fromIso(input.date);
  const seasons = day === null ? [] : seasonsOf(month(day));
  const matches = (entry: Tags): boolean => fits(entry, input, seasons);
  const theme = pick(THEMES, 1, matches)[0] ?? DEFAULT_THEME;
  const touch = pick(TOUCHES, 1, matches)[0] ?? DEFAULT_TOUCH;
  const where = input.city === '' ? '' : ` in ${input.city}`;
  return {
    theme: {
      name: theme.name,
      palette: theme.palette,
      why: `${theme.why} Chosen for ${withArticle(occasion(input))}${where}.`,
    },
    decor: pick(DECOR, 3, matches).map(toItem),
    menu: menu(input, seasons),
    activities: pick(ACTIVITIES, 3, matches).map(toItem),
    touch: toItem(touch),
    invitation: invitation(input),
  };
}
