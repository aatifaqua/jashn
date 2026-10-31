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
import { DRAFT_SYSTEM, draftContent } from '../ai/prompts.ts';
import { DRAFT_RESPONSE_SCHEMA, draftRequestSchema, draftTextSchema } from '../ai/schemas.ts';
import type { ResponseCache } from '../cache.ts';
import type { AppEnv } from '../env.ts';
import { invalidRequest } from '../middleware/errors.ts';
import { assertClean, cachedRoute, type RouteDeps } from './common.ts';

/** Asks Gemini for the enquiry, then re-checks its shape and guards; throws on failure. */
export async function liveDraft(
  gemini: GeminiClient,
  plan: Plan,
  vendor: VendorItem,
): Promise<Draft> {
  const generation = await gemini.generate({
    endpoint: 'draft',
    systemInstruction: DRAFT_SYSTEM,
    contents: draftContent(plan, vendor),
    responseJsonSchema: DRAFT_RESPONSE_SCHEMA,
  });
  const { text } = draftTextSchema.parse(JSON.parse(generation.text));
  assertClean(guardDraft(text, plan));
  return { vendorId: vendor.id, text };
}

/** Handler for POST /api/draft; a vendor the plan does not include is a 400. */
export function draftHandler(
  deps: RouteDeps & { readonly cache: ResponseCache<Sourced<Draft>> },
): Handler<AppEnv> {
  return cachedRoute(deps, draftRequestSchema, (c, { body, plan, today }) => {
    const vendor = plan.vendors.find((item) => item.id === body.vendorId);
    if (vendor === undefined) {
      return invalidRequest(c, [
        { field: 'vendorId', code: 'invalid', message: 'This vendor is not part of the plan.' },
      ]);
    }
    // The prompt leaves the note out, so the key does too: inputs differing only there share one.
    const input = { ...plan.input, note: '' };
    return {
      key: { endpoint: 'draft', input, today, vendorId: vendor.id },
      live: (gemini) => liveDraft(gemini, plan, vendor),
      fallback: () => draftEnquiry(plan, vendor),
    };
  });
}
