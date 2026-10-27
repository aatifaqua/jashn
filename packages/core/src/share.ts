/**
 * Share links: the event description travels in the URL fragment, which browsers never send
 * to a server. The payload is a versioned positional JSON array, with closed-list choices
 * stored as indexes, encoded as base64url. Decoding treats the fragment as untrusted input and
 * runs it through the same validation as the form.
 */
import { CITY_TIERS, CONSTRAINTS, EVENT_TYPES, LANGUAGES, SETTINGS } from './ids.ts';
import { normaliseInput, validateInput } from './input.ts';
import type { EventInput } from './types.ts';

const VERSION = 1;
/** Far above any valid input's encoding; longer fragments are rejected before decoding. */
const MAX_FRAGMENT = 4096;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const ENCODER = new TextEncoder();
/** Fatal decoding rejects malformed UTF-8 instead of inventing replacement characters. */
const DECODER = new TextDecoder('utf-8', { fatal: true });

function toBase64Url(text: string): string {
  let binary = '';
  for (const byte of ENCODER.encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return DECODER.decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/**
 * Encodes an input as a compact URL-fragment payload (no leading "#"). The input is
 * normalised first so equal events always produce the same link.
 */
export function encodeShare(input: EventInput): string {
  const clean = normaliseInput(input);
  const compact = [
    VERSION,
    EVENT_TYPES.indexOf(clean.type),
    clean.style,
    clean.functions,
    clean.date,
    clean.startTime,
    clean.city,
    CITY_TIERS.indexOf(clean.tier),
    SETTINGS.indexOf(clean.setting),
    clean.venueBooked ? 1 : 0,
    clean.invited,
    clean.budget,
    clean.priorities,
    clean.constraints.map((id) => CONSTRAINTS.indexOf(id)),
    clean.note,
    LANGUAGES.indexOf(clean.language),
  ];
  return toBase64Url(JSON.stringify(compact));
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** The id at an index of a closed list, or undefined for anything else (validation reports it). */
function pick(list: readonly string[], index: unknown): string | undefined {
  return typeof index === 'number' ? list[index] : undefined;
}

function expand(data: readonly unknown[]): Record<string, unknown> {
  const [, type, style, functions, date, startTime, city, tier, setting, booked] = data;
  const [invited, budget, priorities, constraints, note, language] = data.slice(10);
  return {
    type: pick(EVENT_TYPES, type),
    style,
    functions,
    date,
    startTime,
    city,
    tier: pick(CITY_TIERS, tier),
    setting: pick(SETTINGS, setting),
    venueBooked: booked === 1 ? true : booked === 0 ? false : undefined,
    invited,
    budget,
    priorities,
    constraints: isList(constraints) ? constraints.map((id) => pick(CONSTRAINTS, id)) : undefined,
    note,
    language: pick(LANGUAGES, language),
  };
}

/**
 * Decodes a share fragment (with or without the leading "#") into a validated input, or null
 * when the fragment is malformed, from another version, or describes an invalid event (for
 * example one whose date has passed).
 */
export function decodeShare(fragment: string, today: number): EventInput | null {
  const payload = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (payload.length > MAX_FRAGMENT || !BASE64URL.test(payload)) return null;
  let data: unknown;
  try {
    data = JSON.parse(fromBase64Url(payload));
  } catch {
    return null;
  }
  if (!isList(data) || data[0] !== VERSION) return null;
  const result = validateInput(expand(data), today);
  return result.ok ? result.value : null;
}
