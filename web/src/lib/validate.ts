/**
 * Structural readers for untrusted data that reaches the browser: saved plans from
 * localStorage and generated content from the API or the demo file. Each reader returns a
 * typed value or null; nothing is trusted because of where it came from.
 */
import {
  VENDOR_STATUSES,
  guardDraft,
  guardIdeas,
  guardReply,
  validatePatch,
  type AssistReply,
  type Constraint,
  type Draft,
  type IdeaItem,
  type Ideas,
  type Plan,
  type Source,
  type VendorStatus,
} from '@jashn/core';

/** Saved and generated ids: lowercase words joined by hyphens, as the core produces them. */
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** A plain object (not null, not an array). */
export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** An id as the core writes them (task, vendor and plan ids). */
export function isId(value: unknown): value is string {
  return typeof value === 'string' && ID.test(value);
}

/** Where generated content came from. */
export function isSource(value: unknown): value is Source {
  return value === 'gemini' || value === 'fallback';
}

/** One of the vendor progress states. */
export function isVendorStatus(value: unknown): value is VendorStatus {
  return (VENDOR_STATUSES as readonly unknown[]).includes(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isItem(value: unknown): value is IdeaItem {
  return isRecord(value) && isText(value.title) && isText(value.detail);
}

function isItems(value: unknown, min: number, max: number): value is readonly IdeaItem[] {
  return Array.isArray(value) && value.length >= min && value.length <= max && value.every(isItem);
}

function isTheme(value: unknown): value is Ideas['theme'] {
  return (
    isRecord(value) &&
    isText(value.name) &&
    isText(value.why) &&
    Array.isArray(value.palette) &&
    value.palette.length <= 6 &&
    value.palette.every(isText)
  );
}

/** The shape of personalised ideas (design section 7), with the counts the API promises. */
export function isIdeas(value: unknown): value is Ideas {
  return (
    isRecord(value) &&
    isTheme(value.theme) &&
    isItems(value.decor, 1, 5) &&
    isItems(value.menu, 1, 6) &&
    isItems(value.activities, 1, 5) &&
    isItem(value.touch) &&
    isText(value.invitation)
  );
}

/** Copies only the known fields, so extra keys in untrusted data never reach the page. */
function pickIdeas(ideas: Ideas): Ideas {
  const item = ({ title, detail }: IdeaItem): IdeaItem => ({ title, detail });
  return {
    theme: { name: ideas.theme.name, palette: [...ideas.theme.palette], why: ideas.theme.why },
    decor: ideas.decor.map(item),
    menu: ideas.menu.map(item),
    activities: ideas.activities.map(item),
    touch: item(ideas.touch),
    invitation: ideas.invitation,
  };
}

/**
 * Ideas that are well formed and pass the dietary, link and length guards for these needs,
 * or null. Guards run again on read because a stored or served idea set may predate a change
 * of needs.
 */
export function readIdeas(value: unknown, constraints: readonly Constraint[]): Ideas | null {
  if (!isIdeas(value)) return null;
  return guardIdeas(value, constraints).length === 0 ? pickIdeas(value) : null;
}

/**
 * An assistant reply checked against the plan, or null. A proposed patch must pass the same
 * validation as the form, and the reply may not quote a rupee figure the plan (or the patched
 * plan's inputs) does not contain, so a model can neither smuggle in a bad change nor invent
 * a price.
 */
export function readReply(value: unknown, plan: Plan): AssistReply | null {
  if (!isRecord(value) || !isText(value.reply)) return null;
  const reply = value.reply;
  if (value.patch === undefined || value.patch === null) {
    return guardReply(reply, plan).length === 0 ? { reply } : null;
  }
  const result = validatePatch(value.patch, plan.input, plan.today);
  if (!result.ok || guardReply(reply, plan, result.patch).length > 0) return null;
  return { reply, patch: result.patch };
}

/** An enquiry draft for this vendor that passes the draft guards, or null. */
export function readDraft(value: unknown, plan: Plan, vendorId: string): Draft | null {
  if (!isRecord(value) || !isText(value.text) || value.vendorId !== vendorId) return null;
  return guardDraft(value.text, plan).length === 0 ? { vendorId, text: value.text } : null;
}
