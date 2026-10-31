/**
 * Public API of @jashn/core. Side-effect free; profiles load lazily through loadProfile, one
 * chunk per event type. The eager getProfile lives in the `@jashn/core/server` entry.
 */
export type * from './types.ts';
export type * from './engine-types.ts';
export * from './ids.ts';
export * from './days.ts';
export { ASSIST_LIMITS, FIELD_LABELS, INPUT_LIMITS } from './fields.ts';
export { applyPatch, canonicalKey, isPatchField, validateInput, validatePatch } from './input.ts';
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
