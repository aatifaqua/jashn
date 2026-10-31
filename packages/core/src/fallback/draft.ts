/** Deterministic vendor enquiry (the /api/draft fallback), in English. */
import type { Draft } from '../engine-types.ts';
import type { Constraint, Plan, VendorItem } from '../types.ts';
import { formatCount, formatLongDay, occasion, withArticle } from '../text.ts';

/** How each need reads in an enquiry; budget-strict is left out on purpose (see draftEnquiry). */
const NEEDS: Readonly<Record<Constraint, string>> = Object.freeze({
  vegetarian: 'vegetarian food only',
  jain: 'Jain food (no root vegetables, onion or garlic)',
  halal: 'halal food',
  'alcohol-free': 'no alcohol',
  'kid-friendly': 'children among the guests',
  'step-free': 'step-free access for guests who use wheelchairs',
  'eco-friendly': 'low waste and no single-use plastic',
  'budget-strict': '',
});

const SETTINGS = Object.freeze({
  indoor: 'The event is indoors.',
  outdoor: 'The event is outdoors.',
  mixed: 'The event is partly indoors and partly outdoors.',
});

/** Lower-cases a label for use mid-sentence, keeping acronyms such as "DJ". */
function noun(label: string): string {
  return /^[A-Z]{2}/.test(label) ? label : label.toLowerCase();
}

function capitalise(word: string): string {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

function factLines(plan: Plan): string[] {
  const { input } = plan;
  const where = input.city === '' ? '' : ` in ${input.city}`;
  const lines = [
    `We are planning ${withArticle(occasion(input))}${where} on ${formatLongDay(plan.today + plan.daysToGo)}, ` +
      `starting at ${input.startTime}, for about ${formatCount(plan.expected)} guests.`,
    SETTINGS[input.setting],
  ];
  if (input.functions.length > 0) {
    lines.push(`Functions: ${input.functions.map(capitalise).join(', ')}.`);
  }
  const needs = input.constraints.map((id) => NEEDS[id]).filter((text) => text !== '');
  if (needs.length > 0) lines.push(`Please note: ${needs.join('; ')}.`);
  return lines;
}

function questionLines(vendor: VendorItem): string[] {
  if (vendor.questions.length === 0) {
    return ['Could you please share your availability and a quote for these dates?'];
  }
  return [
    'Could you please share your availability and a quote, and tell us:',
    ...vendor.questions.map((question, i) => `${String(i + 1)}. ${question}`),
  ];
}

/** A vendor enquiry with no contact details; the budget is left out so the vendor quotes first. */
export function draftEnquiry(plan: Plan, vendor: VendorItem): Draft {
  const lines = [
    'Hello,',
    '',
    ...factLines(plan),
    '',
    `We are looking for ${withArticle(noun(vendor.label))}.`,
    ...questionLines(vendor),
    '',
    `We hope to confirm by ${formatLongDay(Math.max(vendor.bookBy, plan.today))}.`,
    '',
    'Thank you.',
  ];
  return { vendorId: vendor.id, text: lines.join('\n') };
}
