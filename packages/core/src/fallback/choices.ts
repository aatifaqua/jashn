/**
 * Offline parsers for changes to the event's choices: needs ("add jain", "remove alcohol"),
 * setting ("make it outdoor") and wedding functions ("drop the haldi"). Patterns are hoisted
 * to module scope and tables are frozen.
 */
import { CHANGE, type ClauseParser } from './intents.ts';
import type { Constraint } from '../types.ts';

const REMOVE =
  /\b(?:remove|drop|no|not|don't|dont|without|cancel|skip|stop|exclude|avoid|ban)\b|\bno\s+longer\b/;
const ADD =
  /\b(?:add|make|include|need|needs|want|go|switch|set|keep|turn|allow|serve)\b|\b(?:we|it)\s+(?:are|is)\b/;
/**
 * Adding a function adds a whole day, so it needs an explicit verb: "make the haldi outdoor"
 * changes the setting and must not add a haldi.
 */
const ADD_FUNCTION = /\b(?:add|include|need|needs|want|hold)\b/;

const ANY_VERB = new RegExp(`${REMOVE.source}|${ADD.source}|${CHANGE.source}`);

/**
 * The instruction verb of a clause, if any. A clause without one ("… and kid-friendly")
 * borrows the previous clause's verb, so "make it eco-friendly and kid-friendly" adds both.
 */
export function leadVerb(clause: string): string | undefined {
  return ANY_VERB.exec(clause)?.[0];
}

/** -1 to remove, +1 to add, 0 when the clause asks rather than instructs. */
function polarity(clause: string, add: RegExp = ADD): -1 | 0 | 1 {
  if (REMOVE.test(clause)) return -1;
  return add.test(clause) ? 1 : 0;
}

/**
 * Words for each need. `inverted` marks words that name the thing a need excludes: "remove
 * alcohol" adds alcohol-free and "make it non-veg" removes vegetarian.
 */
const TERMS: readonly {
  readonly id: Constraint;
  readonly pattern: RegExp;
  readonly inverted?: RegExp;
}[] = Object.freeze([
  {
    id: 'vegetarian',
    pattern: /(?<!non[- ]?)\bveg(?:etarian)?\b|\bshakahari\b/,
    inverted: /\bnon[- ]?veg(?:etarian)?\b/,
  },
  { id: 'jain', pattern: /\bjain\b/ },
  { id: 'halal', pattern: /\bhalal\b/ },
  {
    id: 'alcohol-free',
    pattern: /\balcohol[- ]free\b|\bdry\s+(?:event|wedding|party)\b/,
    inverted: /\b(?:alcohol|liquor|booze|daaru|daru|sharab)\b(?![- ]free)/,
  },
  { id: 'kid-friendly', pattern: /\b(?:kid|child)[- ]friendly\b|\bkids\b|\bchildren\b/ },
  { id: 'step-free', pattern: /\bstep[- ]free\b|\bwheelchairs?\b|\baccessib(?:le|ility)\b/ },
  {
    id: 'eco-friendly',
    pattern: /\beco(?:[- ]friendly)?\b|\bsustainab\w*|\bplastic[- ]free\b|\bzero[- ]waste\b/,
  },
  {
    id: 'budget-strict',
    pattern:
      /\bbudget[- ]strict\b|\bstrict(?:ly)?\s+(?:on\s+)?budget\b|\bbudget\s+(?:is\s+)?strict\b/,
  },
]);

/** The direction of one need in a clause: +1 add, -1 remove, 0 not mentioned or only asked. */
function needDirection(clause: string, term: (typeof TERMS)[number], sign: -1 | 0 | 1): number {
  if (term.pattern.test(clause)) return sign;
  return term.inverted?.test(clause) === true ? -sign : 0;
}

/** "add jain", "remove alcohol", "make it non-veg", "we need step-free access". */
export const parseNeeds: ClauseParser = (clause, _plan, base) => {
  const sign = polarity(clause);
  if (sign === 0) return {};
  const needs = new Set(base.constraints);
  let changed = false;
  for (const term of TERMS) {
    const change = needDirection(clause, term, sign);
    if (change === 0) continue;
    changed ||= needs.has(term.id) !== change > 0;
    if (change > 0) needs.add(term.id);
    else needs.delete(term.id);
  }
  return changed ? { constraints: [...needs] } : {};
};

const MIXED = /\bmixed\b|\bindoors?\s+and\s+outdoors?\b|\boutdoors?\s+and\s+indoors?\b/;
const OUTDOOR = /\boutdoors?\b|\boutside\b|\bopen[- ]air\b|\blawns?\b/;
const INDOOR = /\bindoors?\b|\binside\b|\bbanquet\b/;

/** "make it outdoor", "move indoors", "switch to mixed". */
export const parseSetting: ClauseParser = (clause) => {
  if (!CHANGE.test(clause)) return {};
  if (MIXED.test(clause)) return { setting: 'mixed' };
  if (OUTDOOR.test(clause)) return { setting: 'outdoor' };
  return INDOOR.test(clause) ? { setting: 'indoor' } : {};
};

const FUNCTION_WORDS = /\b(?:haldi|mehndi|mehendi|sangeet|ceremony|reception)\b/g;

/** "add a sangeet", "drop the haldi"; weddings only. Removing the ceremony fails validation. */
export const parseFunctions: ClauseParser = (clause, _plan, base) => {
  const sign = polarity(clause, ADD_FUNCTION);
  if (base.type !== 'wedding' || sign === 0) return {};
  const chosen = new Set(base.functions);
  let changed = false;
  for (const [word] of clause.matchAll(FUNCTION_WORDS)) {
    const id = word === 'mehendi' ? 'mehndi' : word;
    changed ||= chosen.has(id) !== sign > 0;
    if (sign > 0) chosen.add(id);
    else chosen.delete(id);
  }
  return changed ? { functions: [...chosen] } : {};
};
