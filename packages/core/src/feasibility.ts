/** Budget feasibility: cost floor per guest, verdict and when to offer trims (design 6.4). */
import { rankTrims } from './trims.ts';
import type {
  BudgetLine,
  EventContext,
  EventInput,
  Feasibility,
  Profile,
  Verdict,
} from './types.ts';

/** Each wedding function beyond the first raises the floor by this share, in percent. */
const FUNCTION_UPLIFT_PERCENT = 35;

interface TrimBasis {
  readonly lines: readonly BudgetLine[];
  /** Offer trims even when comfortable (the budget-strict rule). */
  readonly alwaysTrim: boolean;
}

/** Cost floor per guest; integer percent keeps 2,000 × 1.35 at exactly 2,700. */
export function costFloor(input: EventInput, profile: Profile): number {
  const extra = Math.max(0, input.functions.length - 1);
  return Math.round((profile.floors[input.tier] * (100 + FUNCTION_UPLIFT_PERCENT * extra)) / 100);
}

/** Compared on exact integer totals, so rounding the per-guest figure never flips a verdict. */
export function verdictFor(budget: number, expected: number, floor: number): Verdict {
  const need = floor * expected;
  if (2 * budget >= 3 * need) return 'comfortable';
  return budget >= need ? 'tight' : 'unrealistic';
}

/** Feasibility for the expected headcount, with ranked trims unless comfortable. */
export function assessFeasibility(
  input: EventInput,
  profile: Profile,
  ctx: EventContext,
  basis: TrimBasis,
): Feasibility {
  const floor = costFloor(input, profile);
  const verdict = verdictFor(input.budget, ctx.expected, floor);
  const show = verdict !== 'comfortable' || basis.alwaysTrim;
  return {
    verdict,
    perGuest: Math.round(input.budget / ctx.expected),
    floor,
    trims: show ? rankTrims({ input, profile, ctx, lines: basis.lines, floor, verdict }) : [],
  };
}
