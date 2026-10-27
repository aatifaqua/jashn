/**
 * Access to the per-event-type profiles. The browser calls loadProfile so each type's tables
 * ship as their own chunk and load only when that type is chosen; the server and tests use
 * getProfile, where all three are already in memory.
 */
import type { EventType, Profile } from '../types.ts';

export { getProfile } from './all.ts';

/**
 * The profile of an event type, loaded on demand. Each branch is a literal dynamic import so
 * the bundler can split one chunk per type, keeping the first screen small.
 */
export async function loadProfile(type: EventType): Promise<Profile> {
  switch (type) {
    case 'wedding':
      return (await import('./wedding.ts')).WEDDING;
    case 'birthday':
      return (await import('./birthday.ts')).BIRTHDAY;
    case 'community':
      return (await import('./community.ts')).COMMUNITY;
  }
}
