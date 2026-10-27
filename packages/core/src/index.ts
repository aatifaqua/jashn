/**
 * Public API of @jashn/core: pure, deterministic planning logic shared by the server and web.
 * The package is side-effect free, so a bundle keeps only what it imports. Profiles are the
 * exception worth knowing: the browser should call loadProfile (one lazy chunk per event type)
 * and never getProfile, which pulls all three profiles into the importing chunk.
 */
export type * from './types.ts';
export * from './ids.ts';
export * from './days.ts';
export { FIELD_LABELS, INPUT_FIELDS, INPUT_LIMITS } from './fields.ts';
export { applyPatch, canonicalKey, normaliseInput, validateInput, validatePatch } from './input.ts';
export { applies } from './applies.ts';
export { ROUNDING_UNIT, roundRupees } from './money.ts';
export { loadProfile, getProfile } from './profiles/index.ts';
export {
  SAFETY_THRESHOLDS,
  expectedHeadcount,
  maxInvitedFor,
  volunteersNeeded,
} from './attendance.ts';
export { deriveContext, functionDays, seasonOf, type FunctionDay } from './context.ts';
export { RULES, fireRules, type FiredRule } from './rules.ts';
export {
  DEFAULT_CONTINGENCY,
  PRIORITY_FACTOR,
  allocateBudget,
  planBudget,
  type BudgetAllocation,
  type BudgetResult,
} from './budget.ts';
export { assessFeasibility, costFloor, verdictFor, type TrimBasis } from './feasibility.ts';
export { rankTrims, type TrimContext } from './trims.ts';
export { buildTimeline, topActions, type StageInput } from './timeline.ts';
export { buildPayments, buildVendors } from './vendors.ts';
export { buildRunSheet } from './runsheet.ts';
export { buildPlan, diffPlans } from './plan.ts';
export { planSummary, type PlanSummary, type SummaryPayment, type SummaryTask } from './summary.ts';
export { SAMPLE_IDS, sampleEvent, sampleLabel, type SampleId } from './samples.ts';
export {
  formatCount,
  formatDay,
  formatIsoDate,
  formatLongDay,
  formatRupees,
  formatShortIso,
  occasion,
  weekdayName,
} from './text.ts';
export {
  GUARD_LIMITS,
  dietConflicts,
  guardDraft,
  guardIdeas,
  guardReply,
  hasLink,
  inventedAmounts,
  planAmounts,
  type DietConflict,
  type GuardCode,
  type GuardIssue,
} from './guards.ts';
export { escapeText, foldLine, toIcs, type IcsOptions } from './ics.ts';
export { decodeShare, encodeShare } from './share.ts';
export { ideasOffline } from './fallback/ideas.ts';
export { draftEnquiry } from './fallback/draft.ts';
export { assistOffline, parseChanges } from './fallback/assistant.ts';
