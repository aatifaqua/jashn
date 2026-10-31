/**
 * Public API of @jashn/core. Side-effect free; the browser uses loadProfile (one lazy chunk per
 * type), never getProfile, which pulls all three profiles into the importing chunk.
 */
export type * from './types.ts';
export * from './ids.ts';
export * from './days.ts';
export { ASSIST_LIMITS, FIELD_LABELS, INPUT_LIMITS } from './fields.ts';
export { applyPatch, canonicalKey, validateInput, validatePatch } from './input.ts';
export { getProfile } from './profiles/all.ts';
export { loadProfile } from './profiles/index.ts';
export { seasonOf } from './context.ts';
export { buildPlan, diffPlans } from './plan.ts';
export { remainingActions } from './timeline.ts';
export { planSummary } from './summary.ts';
export {
  SAMPLE_IDS,
  SUGGESTED_PROMPTS,
  sampleEvent,
  sampleLabel,
  type SampleId,
} from './samples.ts';
export {
  countWord,
  formatCount,
  formatDay,
  formatLongDay,
  formatRupees,
  occasion,
} from './text.ts';
export { GUARD_LIMITS, guardDraft, guardIdeas, guardReply } from './guards.ts';
export { ideasOffline } from './fallback/ideas.ts';
export { draftEnquiry } from './fallback/draft.ts';
export { assistOffline } from './fallback/assistant.ts';
