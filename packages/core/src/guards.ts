/**
 * Post-generation guards (design sections 7 and 9). Generated text is checked after schema
 * validation; any issue makes the server serve the deterministic fallback instead. Word tables
 * and regexes are compiled once at module scope so a check is a few linear scans.
 */
import { asciiDigits, inventedDates, planDays } from './date-mentions.ts';
import { ASSIST_LIMITS } from './fields.ts';
import type { Constraint, Ideas, Plan, PlanPatch } from './types.ts';

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

/** Meat and fish, in English, Hindi transliteration and Devanagari. */
const MEAT =
  'meat meatball chicken mutton lamb goat beef pork ham bacon sausage salami pepperoni steak ' +
  'veal venison turkey duck fish prawn shrimp crab lobster squid calamari oyster mussel clam ' +
  'anchovy tuna salmon seafood gelatin gelatine keema kheema murg murgh gosht machli machhli ' +
  'macchi jhinga jheenga nalli nihari haleem paya kaleji boti tangdi bheja rogan ' +
  'मुर्ग मुर्गा मुर्गी चिकन मटन गोश्त मछली झींगा कीमा';
const EGG = 'egg omelette omelet meringue anda ande अंडा अंडे ऑमलेट';
/** Roots, bulbs and fungi a Jain menu leaves out, plus honey. */
const ROOTS =
  'onion garlic potato carrot radish beetroot beet turnip ginger yam shallot leek mushroom ' +
  'honey pyaz pyaaz piyaz lehsun lahsun aloo aalu gajar mooli adrak shakarkandi arbi chukandar ' +
  'jimikand suran प्याज लहसुन आलू गाजर मूली अदरक शकरकंद अरबी चुकंदर';
const PORK = 'pork ham bacon lard pepperoni salami prosciutto gelatin gelatine';
const ALCOHOL =
  'alcohol alcoholic wine beer whisky whiskey vodka rum gin tequila champagne prosecco cocktail ' +
  'sangria liquor brandy scotch martini margarita mojito daaru daru sharab sharaab toddy feni ' +
  'शराब दारू बीयर वाइन व्हिस्की';

/**
 * Whole words only (Unicode letters and marks count as word characters, so Devanagari works),
 * with an optional English plural. "Non-alcoholic", "virgin mojito", "egg-free" and "eggless"
 * are not conflicts; only a hyphen joins "free" or "less", so "fish, less oil" is still caught.
 */
function wordPattern(...lists: string[]): RegExp {
  const words = lists.join(' ').split(' ').join('|');
  return new RegExp(
    `(?<![\\p{L}\\p{M}])(?<!(?:non|zero|virgin)[- ])(?:${words})(?:e?s)?` +
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
  /(₹|\brs\.?|\binr|रु\.?)?\s*(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|k|thousand|लाख|करोड़|हज़ार|हजार)?(?![\p{L}\p{M}])\s*(rupees|रुपये|रुपए)?/giu;
const UNITS = Object.freeze({
  lakh: 1e5,
  lac: 1e5,
  लाख: 1e5,
  crore: 1e7,
  cr: 1e7,
  करोड़: 1e7,
  k: 1e3,
  thousand: 1e3,
  हज़ार: 1e3,
  हजार: 1e3,
});

/** A word in generated text that conflicts with a declared dietary constraint. */
export interface DietConflict {
  readonly constraint: Constraint;
  readonly word: string;
}

/** Which check failed. */
export type GuardCode = 'diet' | 'link' | 'length' | 'amount' | 'date';

/** One reason generated output was rejected; `where` names the field. */
export interface GuardIssue {
  readonly code: GuardCode;
  readonly where: string;
  readonly detail: string;
}

/**
 * Finds words that break the declared diet: meat, fish or egg under vegetarian or Jain; root
 * vegetables under Jain; pork or alcohol under halal; alcohol under alcohol-free. Negations
 * such as "no onion" are still reported, because a false alarm only costs a fallback while a
 * miss would put a forbidden dish on the menu.
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

/**
 * Every rupee figure the plan (and an optional proposed patch) states, rounded to whole
 * rupees. A reply may quote these; any other figure was invented.
 */
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

function unitOf(word: string | undefined): number {
  if (word === undefined) return 1;
  // AMOUNT only captures these words, optionally pluralised, so the stem is always a key.
  return UNITS[word.toLowerCase().replace(/s$/, '') as keyof typeof UNITS];
}

function matches(value: number, tolerance: number, allowed: ReadonlySet<number>): boolean {
  for (const amount of allowed) {
    if (Math.abs(amount - value) <= tolerance) return true;
  }
  return false;
}

/**
 * Rupee figures in the text that are not in `allowed`; Devanagari digits count as digits.
 * "₹8,00,000" must match exactly (to the rupee); a rounded figure such as "8.2 lakh" matches
 * any allowed amount it rounds from.
 */
export function inventedAmounts(text: string, allowed: ReadonlySet<number>): readonly number[] {
  const invented: number[] = [];
  for (const [, mark, digits, unitWord, rupees] of asciiDigits(text).matchAll(AMOUNT)) {
    // The digits group is never empty in a match; the check narrows its type.
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
 * Checks generated ideas: lengths, links, dietary conflicts in every field, and no rupee
 * figures or calendar dates at all, since ideas never carry prices and leave the date as a
 * placeholder (so saved or pre-generated ideas cannot go stale when the plan moves).
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
  ideas.theme.palette.forEach((word, i) => {
    fields.push([`theme.palette.${String(i)}`, word, GUARD_LIMITS.paletteWord]);
  });
  for (const key of ['decor', 'menu', 'activities'] as const) {
    ideas[key].forEach((item, i) => {
      fields.push([`${key}.${String(i)}.title`, item.title, title]);
      fields.push([`${key}.${String(i)}.detail`, item.detail, detail]);
    });
  }
  return fields.flatMap(([where, text, max]) => checkText(where, text, max, scope));
}

/**
 * Checks a vendor enquiry draft: length, links, and no rupee figure or date absent from the
 * plan. Diet words are not checked here because an enquiry legitimately says "no onion".
 */
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
 * Checks an assistant reply: length, links, and no rupee figure or date absent from the plan
 * or the proposed patch, so the assistant can never quote a price or a deadline the engine did
 * not compute, and a reply written for an older plan is rejected once its dates move.
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
