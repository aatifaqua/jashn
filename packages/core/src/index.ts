/**
 * Public API of @jashn/core: pure, deterministic planning logic shared by the server and web.
 * The package is side-effect free, so a bundle keeps only what it imports. Profiles are the
 * exception worth knowing: the browser should call loadProfile (one lazy chunk per event type)
 * and never getProfile, which pulls all three profiles into the importing chunk. Only what the
 * server and the web app use is exported; the planning stages stay internal to the package.
 */
export type * from './types.ts';
export * from './ids.ts';
export * from './days.ts';
export { ASSIST_LIMITS, FIELD_LABELS, INPUT_LIMITS } from './fields.ts';
export { applyPatch, canonicalKey, validateInput, validatePatch } from './input.ts';
export { loadProfile, getProfile } from './profiles/index.ts';
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
export { toIcs } from './ics.ts';
export { decodeShare, encodeShare } from './share.ts';
export { ideasOffline } from './fallback/ideas.ts';
export { draftEnquiry } from './fallback/draft.ts';
export { assistOffline } from './fallback/assistant.ts';
