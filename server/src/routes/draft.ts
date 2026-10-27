/** POST /api/draft: a vendor enquiry for one vendor of the plan, cached per input and vendor. */
import {
  draftEnquiry,
  guardDraft,
  type Draft,
  type Plan,
  type Sourced,
  type VendorItem,
} from '@jashn/core';
import type { Handler } from 'hono';
import type { GeminiClient } from '../ai/gemini.ts';
import { draftContent, draftSystem } from '../ai/prompts.ts';
import { DRAFT_RESPONSE_SCHEMA, draftRequestSchema, draftTextSchema } from '../ai/schemas.ts';
import { cacheKey, type ResponseCache } from '../cache.ts';
import type { AppEnv } from '../env.ts';
import { invalidRequest } from '../middleware/errors.ts';
import { assertClean, readEvent, sendSourced, sourced } from './common.ts';

/** What the draft route needs. */
export interface DraftDeps {
  readonly gemini: GeminiClient | null;
  readonly today: () => number;
  readonly cache: ResponseCache<Sourced<Draft>>;
}

/** Asks Gemini for the enquiry text, then checks length, links and amounts. */
export async function liveDraft(
  gemini: GeminiClient,
  plan: Plan,
  vendor: VendorItem,
): Promise<Draft> {
  const generation = await gemini.generate({
    endpoint: 'draft',
    systemInstruction: draftSystem(plan.input.language),
    contents: draftContent(plan, vendor),
    responseJsonSchema: DRAFT_RESPONSE_SCHEMA,
  });
  const { text } = draftTextSchema.parse(JSON.parse(generation.text));
  assertClean(guardDraft(text, plan));
  return { vendorId: vendor.id, text };
}

/** Handler for POST /api/draft; a vendor the plan does not include is a 400. */
export function draftHandler(deps: DraftDeps): Handler<AppEnv> {
  return async (c) => {
    const today = deps.today();
    const request = await readEvent(c, draftRequestSchema, today);
    if (!request.ok) return request.response;
    const { plan, body } = request;
    const vendor = plan.vendors.find((item) => item.id === body.vendorId);
    if (vendor === undefined) {
      return invalidRequest(c, [
        { field: 'vendorId', code: 'invalid', message: 'This vendor is not part of the plan.' },
      ]);
    }
    const key = cacheKey({ endpoint: 'draft', input: plan.input, today, vendorId: vendor.id });
    const result = await deps.cache.run(key, () =>
      sourced(
        deps.gemini,
        (gemini) => liveDraft(gemini, plan, vendor),
        () => draftEnquiry(plan, vendor),
      ),
    );
    return sendSourced(c, result);
  };
}
