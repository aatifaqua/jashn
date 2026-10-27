/** POST /api/ideas: personalised ideas, cached per input, guarded for diet, links and prices. */
import { guardIdeas, ideasOffline, type Ideas, type Plan, type Sourced } from '@jashn/core';
import type { Handler } from 'hono';
import type { GeminiClient } from '../ai/gemini.ts';
import { IDEAS_SYSTEM, ideasContent } from '../ai/prompts.ts';
import { IDEAS_RESPONSE_SCHEMA, ideasRequestSchema, ideasSchema } from '../ai/schemas.ts';
import { cacheKey, type ResponseCache } from '../cache.ts';
import type { AppEnv } from '../env.ts';
import { assertClean, readEvent, sendSourced, sourced } from './common.ts';

/** What the ideas route needs. */
export interface IdeasDeps {
  readonly gemini: GeminiClient | null;
  readonly today: () => number;
  readonly cache: ResponseCache<Sourced<Ideas>>;
}

/** Re-validates generated ideas with zod and the guards; throws when they fail either. */
export function checkIdeas(raw: unknown, plan: Plan): Ideas {
  const ideas = ideasSchema.parse(raw);
  assertClean(guardIdeas(ideas, plan.input.constraints));
  return ideas;
}

/** Asks Gemini for schema-constrained ideas, then checks them with checkIdeas. */
export async function liveIdeas(gemini: GeminiClient, plan: Plan): Promise<Ideas> {
  const generation = await gemini.generate({
    endpoint: 'ideas',
    systemInstruction: IDEAS_SYSTEM,
    contents: ideasContent(plan),
    responseJsonSchema: IDEAS_RESPONSE_SCHEMA,
  });
  return checkIdeas(JSON.parse(generation.text), plan);
}

/** Handler for POST /api/ideas. */
export function ideasHandler(deps: IdeasDeps): Handler<AppEnv> {
  return async (c) => {
    const today = deps.today();
    const request = await readEvent(c, ideasRequestSchema, today);
    if (!request.ok) return request.response;
    const { plan } = request;
    const key = cacheKey({ endpoint: 'ideas', input: plan.input });
    const result = await deps.cache.run(key, () =>
      sourced(
        c,
        deps.gemini,
        (gemini) => liveIdeas(gemini, plan),
        () => ideasOffline(plan.input),
      ),
    );
    return sendSourced(c, result);
  };
}
