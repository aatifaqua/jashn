/** The rupee rounding shared by budget lines, trims and payments. */

/** Lines, trims and payments are whole multiples of this many rupees. */
export const ROUNDING_UNIT = 100;

/** Rounds rupees to the nearest ₹100, the precision every plan figure uses. */
export function roundRupees(value: number): number {
  return Math.round(value / ROUNDING_UNIT) * ROUNDING_UNIT;
}
