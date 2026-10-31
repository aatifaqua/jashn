/**
 * Offline ideas: one generic set per event type, used when Gemini is unavailable.
 * It honours the declared needs: Jain and vegetarian filter dishes, halal marks meat as
 * certified, eco-friendly swaps plastic-heavy items, and alcohol appears only when the plan
 * funds a bar.
 */
import type { IdeaItem, Ideas } from '../engine-types.ts';
import type { BudgetLine, Constraint, EventInput, EventType } from '../types.ts';
import { occasion, withArticle } from '../text.ts';

/** An idea with an optional plastic-free alternative for eco-friendly events. */
interface Idea extends IdeaItem {
  readonly eco?: IdeaItem;
}

interface Dish extends IdeaItem {
  readonly diet: 'jain' | 'veg' | 'meat';
  readonly alcohol?: true;
}

type IdeaSet = Pick<Ideas, 'theme'> & {
  readonly decor: readonly Idea[];
  readonly activities: readonly Idea[];
  readonly touch: Idea;
  readonly menu: readonly Dish[];
  readonly closing: string;
};

/** Served in place of an alcoholic drink when alcohol is ruled out or the plan has no bar. */
const MOCKTAIL: Dish = {
  title: 'Signature mocktail',
  detail: 'One house drink of fresh fruit and mint.',
  diet: 'jain',
};

const IDEAS: Readonly<Record<EventType, IdeaSet>> = Object.freeze({
  wedding: {
    theme: {
      name: 'Marigold Classic',
      palette: ['marigold', 'maroon', 'ivory'],
      why: 'Warm, traditional colours that suit every function.',
    },
    decor: [
      { title: 'Marigold entrance', detail: 'Strings of fresh marigold over the main entrance.' },
      { title: 'Diya-lit aisle', detail: 'Brass diyas lining the walk to the stage.' },
      { title: 'Floral stage', detail: 'Fresh flowers framing the stage for the photographs.' },
    ],
    activities: [
      { title: 'Family dance', detail: 'Each side of the family performs one short song.' },
      { title: 'Blessings wall', detail: 'Guests leave handwritten wishes for the couple.' },
      { title: 'Antakshari round', detail: 'A song game between the two families after dinner.' },
    ],
    touch: { title: 'Handwritten welcome', detail: 'A short note for each guest at check-in.' },
    menu: [
      { title: 'Rose sharbat', detail: 'Chilled rose cooler at the welcome.', diet: 'jain' },
      {
        title: 'Signature cocktail',
        detail: 'One house drink at the bar.',
        diet: 'veg',
        alcohol: true,
      },
      {
        title: 'Mutton biryani',
        detail: 'Slow-cooked rice layered with spiced mutton.',
        diet: 'meat',
      },
      { title: 'Dal and jeera rice', detail: 'Yellow dal tempered with cumin.', diet: 'jain' },
      { title: 'Jalebi with rabri', detail: 'Hot jalebi served with chilled rabri.', diet: 'jain' },
    ],
    closing: 'Your presence and blessings will make the day complete.',
  },
  birthday: {
    theme: {
      name: 'Confetti Pop',
      palette: ['sunshine yellow', 'coral', 'teal'],
      why: 'Bright, playful colours that photograph well.',
    },
    decor: [
      {
        title: 'Balloon arch',
        detail: 'A balloon arch behind the cake table.',
        eco: { title: 'Paper fan wall', detail: 'Reusable paper fans behind the cake table.' },
      },
      { title: 'Photo corner', detail: 'A backdrop with props for group photos.' },
      { title: 'Flower centrepieces', detail: 'Small jars of fresh flowers on every table.' },
    ],
    activities: [
      { title: 'Memory jar', detail: 'Guests write a favourite memory to read out later.' },
      { title: 'Party games', detail: 'Two short games with small prizes.' },
      { title: 'Dance break', detail: 'A short playlist of the favourite songs of the day.' },
    ],
    touch: {
      title: 'Return gifts',
      detail: 'A small wrapped gift for every guest.',
      eco: { title: 'Seed kit gifts', detail: 'A seed kit in a cloth pouch for every guest.' },
    },
    menu: [
      { title: 'Fresh lime soda', detail: 'Sweet or salted, made to order.', diet: 'jain' },
      { title: 'Chicken sliders', detail: 'Mini buns with grilled chicken.', diet: 'meat' },
      { title: 'Corn chaat', detail: 'Sweet corn with lemon and spices.', diet: 'jain' },
      { title: 'Chocolate cake', detail: 'A rich chocolate cake, baked eggless.', diet: 'jain' },
    ],
    closing: 'Come ready to celebrate!',
  },
  community: {
    theme: {
      name: 'Festival Lights',
      palette: ['saffron', 'deep blue', 'gold'],
      why: 'Festive colours that read well by day and under lights.',
    },
    decor: [
      { title: 'String lights', detail: 'Warm lights along the main walkway.' },
      { title: 'Rangoli welcome', detail: 'A large rangoli at the entrance made by volunteers.' },
      { title: 'Cloth bunting', detail: 'Reusable cloth flags strung over the stalls.' },
    ],
    activities: [
      { title: 'Talent stage', detail: 'Open slots for local performers of every age.' },
      { title: 'Kids corner', detail: 'Drawing and simple games in a supervised area.' },
      { title: 'Group sing-along', detail: 'Festival songs everyone knows, to close the day.' },
    ],
    touch: { title: 'Volunteer thank-you', detail: 'Call every volunteer on stage at the close.' },
    menu: [
      { title: 'Masala chaas', detail: 'Spiced buttermilk served chilled.', diet: 'jain' },
      {
        title: 'Vegetable pulao',
        detail: 'Mildly spiced rice with seasonal vegetables.',
        diet: 'veg',
      },
      { title: 'Chana chaat', detail: 'Chickpeas with tamarind and pomegranate.', diet: 'jain' },
      { title: 'Boondi laddoo', detail: 'A festival sweet, easy to serve.', diet: 'jain' },
    ],
    closing: 'Everyone is welcome; bring family, friends and neighbours.',
  },
});

function dietAllows(dish: Dish, constraints: readonly Constraint[]): boolean {
  if (constraints.includes('jain')) return dish.diet === 'jain';
  return !constraints.includes('vegetarian') || dish.diet !== 'meat';
}

/** Alcohol needs a funded bar line, and is never served when alcohol-free or halal is declared. */
function barFunded(budget: readonly BudgetLine[], constraints: readonly Constraint[]): boolean {
  if (constraints.includes('alcohol-free') || constraints.includes('halal')) return false;
  return budget.some((line) => line.category === 'bar' && line.amount > 0);
}

function menu(
  dishes: readonly Dish[],
  constraints: readonly Constraint[],
  bar: boolean,
): IdeaItem[] {
  const halal = constraints.includes('halal');
  return dishes
    .map((dish) => (dish.alcohol === true && !bar ? MOCKTAIL : dish))
    .filter((dish) => dietAllows(dish, constraints))
    .map(({ title, detail, diet }) => ({
      title,
      detail: halal && diet === 'meat' ? `${detail} From a halal-certified kitchen.` : detail,
    }));
}

function toItem({ title, detail, eco }: Idea, green: boolean): IdeaItem {
  return green && eco !== undefined ? eco : { title, detail };
}

/** Invitation with [names], [date] and [venue] placeholders, so saved wording never goes stale. */
function invitation(input: EventInput, closing: string, where: string): string {
  const has = (id: Constraint): boolean => input.constraints.includes(id);
  return [
    `[Names] warmly invite you to our ${occasion(input)}${where} on [date] at [venue], starting at ${input.startTime}.`,
    closing,
    has('kid-friendly') ? 'Children are very welcome.' : '',
    has('eco-friendly') ? 'Please skip plastic gift wrap.' : '',
    'Kindly let us know if you can join us.',
  ]
    .filter((line) => line !== '')
    .join(' ');
}

/**
 * A complete Ideas object for the event type, with the three decor ideas and three activities
 * the API schema requires. `budget` is the plan's lines: with no funded bar, no drink is alcoholic.
 */
export function ideasOffline(input: EventInput, budget: readonly BudgetLine[] = []): Ideas {
  const set = IDEAS[input.type];
  const where = input.city === '' ? '' : ` in ${input.city}`;
  const green = input.constraints.includes('eco-friendly');
  return {
    theme: {
      ...set.theme,
      why: `${set.theme.why} Chosen for ${withArticle(occasion(input))}${where}.`,
    },
    decor: set.decor.map((idea) => toItem(idea, green)),
    menu: menu(set.menu, input.constraints, barFunded(budget, input.constraints)),
    activities: set.activities.map((idea) => toItem(idea, green)),
    touch: toItem(set.touch, green),
    invitation: invitation(input, set.closing, where),
  };
}
