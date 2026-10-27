/** Deep freezing for the module-scope tables of the decision engine. */

/**
 * Freezes a value and everything reachable from it, then returns it with its type unchanged.
 * Profile and rule tables are shared by every plan, so freezing them once at load time makes
 * an accidental write fail loudly instead of corrupting later plans.
 */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
