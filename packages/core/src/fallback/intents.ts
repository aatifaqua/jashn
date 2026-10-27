/**
 * Change requests the offline assistant understands, each parsed from one clause of the user's
 * message into a PlanPatch. Parsing is deterministic: relative dates are counted from the
 * plan's own `today`, never from the clock. All patterns are hoisted to module scope and are
 * free of nested quantifiers, so a 500-character message is parsed in linear time.
 */
import { toIso, weekday } from '../days.ts';
import { roundRupees } from '../money.ts';
import type { EventInput, Plan, PlanPatch } from '../types.ts';

const DOWN =
  /\b(?:cut|reduce|lower|decrease|trim|drop|fewer|less|minus|shrink|remove|subtract|take\s+off)\b/;
const UP = /\b(?:add|increase|raise|more|extra|plus|grow)\b/;
/** A stated target: "to 180", and "fewer than 200", which caps the figure rather than cuts by it. */
const TO_FIGURE = /\bto\s+(?:₹|rs\.?\s*)?\d|\b(?:fewer|less)\s+than\s+(?:₹|rs\.?\s*)?\d/;
/** The figure after "to", read when a clause gives both ends: "from 300 to 250". */
const TO_DIGITS = /\bto\s+(?:₹|rs\.?\s*)?(\d[\d,]*)/;
/** Verbs that ask for a change of date or setting; shared with the choice parsers. */
export const CHANGE = /\b(?:make|move|switch|change|shift|go|hold|have|set|turn|take|keep)\b/;
/** A relative figure ("by 20", "by ₹50,000") that needs a change word to mean anything. */
const RELATIVE_BY = /\bby\s+(?:₹|rs\.?\s*)?\d/;

const ISO_DATE = /\b(\d{4}-\d{2}-\d{2})\b/;
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const NAMED_DAY =
  /\b(?:next|this|coming)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/;
const WEEKDAY = /\b(?:a\s+)?weekday\b/;

const GUESTS =
  /(\d[\d,]*)\s*(?:more\s+|fewer\s+|less\s+|extra\s+)?(?:(?:guests?|people|persons?|pax|invitees?|mehmaan)\b|मेहमान)/;
/** The noun first: "guests 200", "headcount: 250". */
const GUESTS_AFTER = /\b(?:guests?|headcount|invitees?)\s*:?\s*(\d[\d,]*)/;
/** A guest target after the noun: "guests to 400", "guests from 300 to 250". */
const GUESTS_TO = /\b(?:guests?|headcount|invitees?|guest list)\b.*?\bto\s+(\d[\d,]*)(?![\d,.:-])/;
const GUESTS_BY =
  /\b(?:guests?|invitees?|headcount|guest list)\b.*?\bby\s+(\d[\d,]*)\b(?![\d.]*\s*(?:%|per))/;
const GUESTS_PERCENT =
  /\b(?:guests?|invitees?|headcount|guest list)\b.*?\bby\s+(\d+(?:\.\d+)?)\s*(?:%|percent|per\s*cent)|(\d+(?:\.\d+)?)\s*(?:%|percent|per\s*cent)\s+(?:more\s+|fewer\s+|less\s+|extra\s+)?(?:guests?|people|invitees?)\b/;
/** Guest phrases are removed before reading a budget figure, so "200 guests" is not money. */
const GUEST_PHRASES = new RegExp(GUESTS.source, 'g');

const BUDGET_CLAUSE =
  /\bbudget\b|बजट|₹|\brs\.?\s*\d|\binr\b|\d\s*(?:(?:lakhs?|lacs?|crores?|cr)\b|लाख|करोड़)/;
const PERCENT = /(\d+(?:\.\d+)?)\s*(?:%|percent\b|per\s*cent\b)/;
/** A figure and its unit; Devanagari units need no \b, which only sees ASCII word characters. */
const MONEY =
  /(\d[\d,]*(?:\.\d+)?)\s*(?:(lakhs?|lacs?|crores?|cr|k|thousand)\b|(लाख|करोड़|हज़ार|हजार))?/;
/** A smaller part right after a figure: the "50 thousand" in "5 lakh 50 thousand". */
const MONEY_TAIL = /^\s*(\d[\d,]*)\s*(?:(k|thousand)\b|(हज़ार|हजार))/;
/** Dates and clock times are removed before reading a budget figure, so "19:00" is not money. */
const NOT_MONEY = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b|\b\d{1,2}:\d{2}\b/g;
/** Keyed by the first letter of the unit MONEY captured: lakh/lac, crore/cr, k, thousand. */
const UNITS = Object.freeze({ l: 1e5, c: 1e7, k: 1e3, t: 1e3 });
/** Devanagari units, keyed by the whole word in NFC (the nukta as a separate mark). */
const HINDI_UNITS: Readonly<Record<string, number>> = Object.freeze({
  लाख: 1e5,
  करोड़: 1e7,
  हज़ार: 1e3,
  हजार: 1e3,
});

const START =
  /\b(?:start|starts|starting|begin|begins)(?:\s+time)?\s+(?:at\s+|from\s+|to\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/;

/**
 * Parses one lower-cased clause; returns only the fields it mentions. `base` is the input with
 * the earlier clauses' changes applied, so "add jain and remove alcohol" keeps both.
 */
export type ClauseParser = (clause: string, plan: Plan, base: EventInput) => PlanPatch;

function figure(digits: string): number {
  return Number(digits.replace(/,/g, ''));
}

/** The change word of a clause ("cut", "add"), if it has one. */
function directionWord(clause: string): string | undefined {
  return DOWN.exec(clause)?.[0] ?? UP.exec(clause)?.[0];
}

/**
 * The clause the figure parsers read, and the change word later clauses may borrow. A clause
 * with "by N" but no change word of its own ("… and guests by 20") borrows the previous one,
 * so a relative change is never read as an absolute target. Any other figure is read exactly
 * as written.
 */
export function figureClause(
  clause: string,
  previous: string,
): { readonly clause: string; readonly word: string } {
  const own = directionWord(clause);
  if (own !== undefined) return { clause, word: own };
  const borrow = previous !== '' && RELATIVE_BY.test(clause);
  return { clause: borrow ? `${previous} ${clause}` : clause, word: previous };
}

/** True when the text carries a change word of its own ("cut", "add", "move", …). */
export function hasChangeWord(text: string): boolean {
  return DOWN.test(text) || UP.test(text) || CHANGE.test(text);
}

/** -1 for "cut/reduce", +1 for "add/increase", 0 when the clause states a target ("to 180"). */
function direction(clause: string): -1 | 0 | 1 {
  if (TO_FIGURE.test(clause)) return 0;
  if (DOWN.test(clause)) return -1;
  return UP.test(clause) ? 1 : 0;
}

/** "move to 2026-12-12", "next Saturday" (the first Saturday after today), "to a weekday". */
export const parseDate: ClauseParser = (clause, plan) => {
  const iso = ISO_DATE.exec(clause)?.[1];
  if (iso !== undefined) return { date: iso };
  const named = NAMED_DAY.exec(clause)?.[1];
  if (named !== undefined) {
    const offset = ((DAY_NAMES.indexOf(named) - weekday(plan.today) + 6) % 7) + 1;
    return { date: toIso(plan.today + offset) };
  }
  return WEEKDAY.test(clause) && CHANGE.test(clause) ? { date: toIso(nearestMidweek(plan)) } : {};
};

/**
 * The Monday-to-Thursday day nearest the event day: the Thursday before when it is at least
 * as close and not in the past, otherwise the Monday after. A midweek event day is kept.
 */
function nearestMidweek(plan: Plan): number {
  const eventDay = plan.today + plan.daysToGo;
  const day = weekday(eventDay);
  if (day >= 1 && day <= 4) return eventDay;
  const back = (day + 3) % 7;
  const forward = (8 - day) % 7;
  return back <= forward && eventDay - back >= plan.today ? eventDay - back : eventDay + forward;
}

/**
 * The guest figure of a clause: "from 300 to 250" reads the target after "to"; otherwise the
 * number before the noun ("200 guests"), after it ("guests 200") or after "by".
 */
function guestDigits(clause: string): string | undefined {
  return (
    GUESTS_TO.exec(clause)?.[1] ??
    GUESTS.exec(clause)?.[1] ??
    GUESTS_AFTER.exec(clause)?.[1] ??
    GUESTS_BY.exec(clause)?.[1]
  );
}

/** "cut to 180 guests", "add 20 guests", "reduce guests by 50", "add 10% more guests". */
export const parseGuests: ClauseParser = (clause, _plan, base) => {
  const sign = direction(clause);
  const percentMatch = GUESTS_PERCENT.exec(clause);
  const percent = percentMatch?.[1] ?? percentMatch?.[2];
  if (percent !== undefined) {
    if (sign === 0) return {};
    return { invited: Math.round(base.invited * (1 + (sign * Number(percent)) / 100)) };
  }
  const digits = guestDigits(clause);
  if (digits === undefined) return {};
  const count = figure(digits);
  return { invited: sign === 0 ? count : base.invited + sign * count };
};

/** The multiplier of a unit word MONEY captured; 1 when there is none. */
function unitOf(word: string | undefined): number {
  if (word === undefined) return 1;
  return HINDI_UNITS[word] ?? UNITS[word.charAt(0) as keyof typeof UNITS];
}

/**
 * The first rupee figure in the text with its unit, plus a part that follows it ("5 lakh 50
 * thousand" is 5,50,000); null when there is no figure.
 */
function amountIn(text: string): number | null {
  const money = MONEY.exec(text);
  if (money === null) return null;
  // MONEY starts with the figure, so parseFloat reads it and stops at the unit.
  const lead = Number.parseFloat(money[0].replace(/,/g, '')) * unitOf(money[2] ?? money[3]);
  const tail = MONEY_TAIL.exec(text.slice(money.index + money[0].length));
  const rest = tail === null ? 0 : figure(String(tail[1])) * unitOf(tail[2] ?? tail[3]);
  return Math.round(lead + rest);
}

/** "budget 8 lakh", "₹8,00,000", "reduce budget by 10%", "increase the budget by 50k". */
export const parseBudget: ClauseParser = (clause, _plan, base) => {
  if (!BUDGET_CLAUSE.test(clause)) return {};
  const sign = direction(clause);
  const percent = PERCENT.exec(clause)?.[1];
  if (percent !== undefined) {
    if (sign === 0) return {};
    const scaled = base.budget * (1 + (sign * Number(percent)) / 100);
    return { budget: roundRupees(scaled) };
  }
  // "from 25 lakh to 20 lakh" states its target after "to".
  const to = sign === 0 ? TO_DIGITS.exec(clause) : null;
  const from = to === null ? clause : clause.slice(to.index);
  const amount = amountIn(from.replace(GUEST_PHRASES, ' ').replace(NOT_MONEY, ' '));
  if (amount === null) return {};
  return { budget: sign === 0 ? amount : base.budget + sign * amount };
};

/** "start at 7pm", "begin at 19:30", "change the start time to 18:30". */
export const parseStart: ClauseParser = (clause) => {
  const match = START.exec(clause);
  if (match === null) return {};
  const [, hours, minutes = '00', meridiem] = match;
  // An out-of-range hour such as 25 is kept so validation rejects it with its own message.
  let hour = Number(hours);
  if (meridiem !== undefined) hour = (hour % 12) + (meridiem === 'pm' ? 12 : 0);
  return { startTime: `${String(hour).padStart(2, '0')}:${minutes}` };
};
