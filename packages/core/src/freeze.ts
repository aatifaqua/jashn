/**
 * Freezes a value and everything reachable from it. Profile and rule tables are shared by every
 * plan, so an accidental write fails loudly instead of corrupting later plans.
 */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
