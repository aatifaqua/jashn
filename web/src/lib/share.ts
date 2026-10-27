/**
 * Share links. The event description travels in the URL fragment, which browsers never send
 * to a server, and is validated by the core on open exactly like the form.
 */
import { decodeShare, encodeShare, type EventInput } from '@jashn/core';

/**
 * Marks a fragment as a shared plan, so ordinary in-page anchors such as the skip link
 * (#main) are never mistaken for a damaged share link.
 */
const PREFIX = '#plan=';

/** A link that opens this event's plan, built from the current page address. */
export function shareLink(input: EventInput, page: Pick<Location, 'origin' | 'pathname'>): string {
  return `${page.origin}${page.pathname}${PREFIX}${encodeShare(input)}`;
}

/** What a page fragment holds: nothing, a valid shared event, or something unusable. */
export type SharedFragment =
  | { readonly kind: 'none' }
  | { readonly kind: 'event'; readonly input: EventInput }
  | { readonly kind: 'invalid' };

/**
 * Reads a location hash. Only a `#plan=` fragment is a share link; any other hash (an in-page
 * anchor) is ignored, while a malformed or expired share link is reported.
 */
export function readFragment(hash: string, today: number): SharedFragment {
  if (!hash.startsWith(PREFIX)) return { kind: 'none' };
  const input = decodeShare(hash.slice(PREFIX.length), today);
  return input === null ? { kind: 'invalid' } : { kind: 'event', input };
}

/**
 * Removes the fragment from the address bar once it has been read, so a reload or a later
 * share does not re-import an event the user may since have changed.
 */
export function clearFragment(page: Pick<Location, 'pathname' | 'search'>, history: History): void {
  history.replaceState(history.state, '', `${page.pathname}${page.search}`);
}
