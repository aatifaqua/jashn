/** Post-generation guards: any issue makes the server serve the fallback. */
import { inventedDates, planDays } from './date-mentions.ts';
import { ASSIST_LIMITS } from './fields.ts';
import type { Ideas } from './engine-types.ts';
import type { Constraint, Plan, PlanPatch } from './types.ts';

/** Upper bounds, in characters, for each kind of generated text. */
export const GUARD_LIMITS = Object.freeze({
  title: 80,
  detail: 300,
  themeName: 60,
  paletteWord: 30,
  why: 300,
  invitation: 700,
  reply: ASSIST_LIMITS.turn,
  draft: 1800,
});

/** Meat and fish, including the Indian dish words English menus use (murgh, gosht, keema). */
const MEAT =
  'meat meatball chicken mutton lamb goat beef pork ham bacon sausage salami pepperoni steak ' +
  'veal venison turkey duck fish prawn shrimp crab lobster squid calamari oyster mussel clam ' +
  'anchovy tuna salmon seafood gelatin gelatine keema kheema murg murgh gosht machli machhli ' +
  'macchi jhinga jheenga nalli nihari haleem paya kaleji boti tangdi bheja rogan ' +
  'pomfret surmai rohu hilsa ilish bangda bombil kingfish shellfish catfish crabmeat';
const EGG = 'egg omelette omelet meringue anda ande';
const ROOTS =
  'onion garlic potato carrot radish beetroot beet turnip ginger yam shallot leek mushroom ' +
  'honey pyaz pyaaz piyaz lehsun lahsun aloo aalu gajar mooli adrak shakarkandi arbi chukandar ' +
  'jimikand suran batata kanda alu aaloo lasun lassan pyaj';
const PORK = 'pork ham bacon lard pepperoni salami prosciutto gelatin gelatine';
const ALCOHOL =
  'alcohol alcoholic wine beer whisky whiskey vodka rum gin tequila champagne prosecco cocktail ' +
  'sangria liquor brandy scotch martini margarita mojito daaru daru sharab sharaab toddy feni';

/**
 * Whole Unicode words with an optional plural. Only a hyphen joins "free" or "less", so
 * "egg-free" passes while "fish, less oil" is still caught.
 */
function wordPattern(...lists: string[]): RegExp {
  const words = lists.join(' ').split(' ').join('|');
  return new RegExp(
    `(?<![\\p{L}\\p{M}])(?<!(?:non|zero|virgin|non-alcoholic|alcohol-free|zero-proof)[- ])` +
      `(?:${words})(?:e?s)?` +
      `(?![\\p{L}\\p{M}])(?!-(?:free|less)(?![\\p{L}]))`,
    'giu',
  );
}

const DIET_RULES: readonly { readonly constraint: Constraint; readonly pattern: RegExp }[] =
  Object.freeze([
    { constraint: 'vegetarian', pattern: wordPattern(MEAT, EGG) },
    { constraint: 'jain', pattern: wordPattern(MEAT, EGG, ROOTS) },
    { constraint: 'halal', pattern: wordPattern(PORK, ALCOHOL) },
    { constraint: 'alcohol-free', pattern: wordPattern(ALCOHOL) },
  ]);

const LINK =
  /(?:\b[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\b(?:javascript|data|mailto|tel):(?!\s)|[\w.+-]+@[\w-]+\.[a-z]{2,}|\b[a-z0-9-]+\.(?:com|in|org|net|io|co|app|dev|xyz|info|biz|me|ly|gl)\b)/i;

/** A rupee figure: a currency mark before it, or a unit or the word rupees after it. */
const AMOUNT =
  /(₹|\brs\.?|\binr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|lks?|l|crores?|cr|k|thousand)?(?![\p{L}\p{M}])\s*(rupees)?/giu;
const UNITS: ReadonlyMap<string, number> = new Map([
  ['lakh', 1e5],
  ['lac', 1e5],
  ['l', 1e5],
  ['lk', 1e5],
  ['crore', 1e7],
  ['cr', 1e7],
  ['k', 1e3],
  ['thousand', 1e3],
]);

interface DietConflict {
  readonly constraint: Constraint;
  readonly word: string;
}

type GuardCode = 'diet' | 'link' | 'length' | 'amount' | 'date';

interface GuardIssue {
  readonly code: GuardCode;
  readonly where: string;
  readonly detail: string;
}

/**
 * Words that break the declared diet. Negations such as "no onion" are still reported: a false
 * alarm only costs a fallback, a miss would put a forbidden dish on the menu.
 */
export function dietConflicts(
  text: string,
  constraints: readonly Constraint[],
): readonly DietConflict[] {
  const found: DietConflict[] = [];
  for (const { constraint, pattern } of DIET_RULES) {
    if (!constraints.includes(constraint)) continue;
    for (const match of text.matchAll(pattern)) {
      found.push({ constraint, word: match[0].toLowerCase() });
    }
  }
  return found;
}

/** True when the text contains a URL, a bare domain, a script or mail link, or an email. */
export function hasLink(text: string): boolean {
  return LINK.test(text);
}

/** Every rupee figure the plan (and an optional patch) states; any other figure was invented. */
export function planAmounts(plan: Plan, patch?: PlanPatch): ReadonlySet<number> {
  const amounts = new Set<number>();
  const add = (amount: number): void => {
    amounts.add(Math.round(amount));
  };
  add(plan.input.budget);
  add(plan.contingency);
  add(plan.feasibility.perGuest);
  add(plan.feasibility.floor);
  for (const line of plan.budget) {
    add(line.amount);
    line.perFunction?.forEach((part) => {
      add(part.amount);
    });
  }
  plan.feasibility.trims.forEach((trim) => {
    add(trim.saves);
  });
  plan.payments.forEach((payment) => {
    add(payment.amount);
  });
  if (patch?.budget !== undefined) add(patch.budget);
  return amounts;
}

/** The multiplier of a unit word the AMOUNT pattern matched; a bare figure counts in rupees. */
function unitOf(word: string | undefined): number {
  const unit = word === undefined ? undefined : UNITS.get(word.toLowerCase().replace(/s$/, ''));
  return unit ?? 1;
}

function matches(value: number, tolerance: number, allowed: ReadonlySet<number>): boolean {
  for (const amount of allowed) {
    if (Math.abs(amount - value) <= tolerance) return true;
  }
  return false;
}

/** Rupee figures not in `allowed`; "8.2 lakh" matches any allowed amount it rounds from. */
export function inventedAmounts(text: string, allowed: ReadonlySet<number>): readonly number[] {
  const invented: number[] = [];
  for (const [, mark, digits, unitWord, rupees] of text.matchAll(AMOUNT)) {
    if (digits === undefined || (mark ?? unitWord ?? rupees) === undefined) continue;
    const unit = unitOf(unitWord);
    const decimals = digits.split('.')[1]?.length ?? 0;
    // Plain rupees may be one off from rounding; "8.2 lakh" covers half its last digit.
    const tolerance = unit === 1 ? 1 : (unit / 10 ** decimals) * 0.5;
    const value = Number(digits.replace(/,/g, '')) * unit;
    if (!matches(value, tolerance, allowed)) invented.push(value);
  }
  return invented;
}

interface Scope {
  readonly constraints: readonly Constraint[];
  readonly amounts: ReadonlySet<number>;
  /** Day numbers the text may mention; any other calendar date is reported. */
  readonly days: ReadonlySet<number>;
  readonly diet: boolean;
}

/** Checks one field; an over-long field fails at once, which also bounds the pattern scans. */
function checkText(where: string, text: string, max: number, scope: Scope): GuardIssue[] {
  if (text.length > max) {
    return [{ code: 'length', where, detail: `longer than ${String(max)} characters` }];
  }
  const issues: GuardIssue[] = [];
  if (hasLink(text)) issues.push({ code: 'link', where, detail: 'contains a link' });
  if (scope.diet) {
    for (const { constraint, word } of dietConflicts(text, scope.constraints)) {
      issues.push({ code: 'diet', where, detail: `"${word}" conflicts with ${constraint}` });
    }
  }
  for (const value of inventedAmounts(text, scope.amounts)) {
    issues.push({ code: 'amount', where, detail: `₹${String(value)} is not in the plan` });
  }
  for (const written of inventedDates(text, scope.days)) {
    issues.push({ code: 'date', where, detail: `"${written}" is not a date in the plan` });
  }
  return issues;
}

/**
 * Checks generated ideas. No rupee figures or dates at all, so saved or pre-generated ideas
 * cannot go stale when the plan moves.
 */
export function guardIdeas(ideas: Ideas, constraints: readonly Constraint[]): GuardIssue[] {
  const scope: Scope = { constraints, amounts: new Set(), days: new Set(), diet: true };
  const { title, detail } = GUARD_LIMITS;
  const fields: [string, string, number][] = [
    ['theme.name', ideas.theme.name, GUARD_LIMITS.themeName],
    ['theme.why', ideas.theme.why, GUARD_LIMITS.why],
    ['invitation', ideas.invitation, GUARD_LIMITS.invitation],
    ['touch.title', ideas.touch.title, title],
    ['touch.detail', ideas.touch.detail, detail],
  ];
  for (const key of ['decor', 'menu', 'activities'] as const) {
    ideas[key].forEach((item, i) => {
      fields.push([`${key}.${String(i)}.title`, item.title, title]);
      fields.push([`${key}.${String(i)}.detail`, item.detail, detail]);
    });
  }
  // Palette words are colours ("champagne", "wine", "salmon"), never food, so diet is skipped.
  const colours = { ...scope, diet: false };
  const palette = ideas.theme.palette.flatMap((word, i) =>
    checkText(`theme.palette.${String(i)}`, word, GUARD_LIMITS.paletteWord, colours),
  );
  return [
    ...fields.flatMap(([where, text, max]) => checkText(where, text, max, scope)),
    ...palette,
  ];
}

/** Checks an enquiry draft; diet words are skipped because an enquiry may say "no onion". */
export function guardDraft(text: string, plan: Plan): GuardIssue[] {
  const scope: Scope = {
    constraints: [],
    amounts: planAmounts(plan),
    days: planDays(plan),
    diet: false,
  };
  return checkText('draft', text, GUARD_LIMITS.draft, scope);
}

/**
 * Checks an assistant reply, so it can never quote a price or deadline the engine did not
 * compute for this plan (or the proposed patch).
 */
export function guardReply(reply: string, plan: Plan, patch?: PlanPatch): GuardIssue[] {
  const scope: Scope = {
    constraints: [],
    amounts: planAmounts(plan, patch),
    days: planDays(plan, patch),
    diet: false,
  };
  return checkText('reply', reply, GUARD_LIMITS.reply, scope);
}
