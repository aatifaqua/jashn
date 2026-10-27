/**
 * Synchronous access to every profile, for the server and tests. Kept apart from loadProfile
 * so a browser bundle that only loads profiles on demand never imports all three statically.
 */
import type { EventType, Profile } from '../types.ts';
import { BIRTHDAY } from './birthday.ts';
import { COMMUNITY } from './community.ts';
import { WEDDING } from './wedding.ts';

/** Every profile by type, frozen at module load. */
const PROFILES: Readonly<Record<EventType, Profile>> = Object.freeze({
  wedding: WEDDING,
  birthday: BIRTHDAY,
  community: COMMUNITY,
});

/** The profile of an event type, synchronously; pulls every profile into the importing bundle. */
export function getProfile(type: EventType): Profile {
  return PROFILES[type];
}
