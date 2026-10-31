/** POST /api/ideas: personalised ideas, cached per input, guarded for diet, links and prices. */
import { guardIdeas, ideasOffline, type Ideas, type Plan, type Sourced } from '@jashn/core';
import type { Handler } from 'hono';
import type { GeminiClient } from '../ai/gemini.ts';
import { IDEAS_SYSTEM, ideasContent } from '../ai/prompts.ts';
import { IDEAS_RESPONSE_SCHEMA, ideasRequestSchema, ideasSchema } from '../ai/schemas.ts';
import type { ResponseCache } from '../cache.ts';
import type { AppEnv } from '../env.ts';
import { assertClean, cachedRoute, type RouteDeps } from './common.ts';

/** Asks Gemini for ideas, then re-checks them with zod and the guards; throws on failure. */
export async function liveIdeas(gemini: GeminiClient, plan: Plan): Promise<Ideas> {
  const generation = await gemini.generate({
    endpoint: 'ideas',
    systemInstruction: IDEAS_SYSTEM,
    contents: ideasContent(plan),
    responseJsonSchema: IDEAS_RESPONSE_SCHEMA,
  });
  const ideas = ideasSchema.parse(JSON.parse(generation.text));
  assertClean(guardIdeas(ideas, plan.input.constraints));
  return ideas;
}

/** Handler for POST /api/ideas. */
export function ideasHandler(
  deps: RouteDeps & { readonly cache: ResponseCache<Sourced<Ideas>> },
): Handler<AppEnv> {
  return cachedRoute(deps, ideasRequestSchema, (_c, { plan }) => ({
    key: { endpoint: 'ideas', input: plan.input },
    live: (gemini) => liveIdeas(gemini, plan),
    fallback: () => ideasOffline(plan.input, plan.budget),
  }));
}
