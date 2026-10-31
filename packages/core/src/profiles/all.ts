/** Synchronous profiles for the server and tests; apart from loadProfile so lazy chunks stay split. */
import type { EventType, Profile } from '../types.ts';
import { BIRTHDAY } from './birthday.ts';
import { COMMUNITY } from './community.ts';
import { WEDDING } from './wedding.ts';

const PROFILES: Readonly<Record<EventType, Profile>> = Object.freeze({
  wedding: WEDDING,
  birthday: BIRTHDAY,
  community: COMMUNITY,
});

/** The profile of an event type; pulls every profile into the importing bundle. */
export function getProfile(type: EventType): Profile {
  return PROFILES[type];
}
