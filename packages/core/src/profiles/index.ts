/**
 * Lazy profile loading. The synchronous getProfile lives in all.ts so a browser bundle that
 * loads profiles on demand never imports all three statically.
 */
import type { EventType, Profile } from '../types.ts';

/**
 * The profile of an event type, loaded on demand. Each branch is a literal dynamic import so
 * the bundler splits one chunk per type, keeping the first screen small.
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
