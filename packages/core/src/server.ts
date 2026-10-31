/**
 * The `@jashn/core/server` entry, for Node code (the server, its scripts and tests). It loads
 * every event type's profile eagerly, so the browser bundle never imports it.
 */
export { getProfile } from './profiles/all.ts';
