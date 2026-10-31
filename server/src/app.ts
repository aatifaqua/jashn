/** The Hono app, built from injected dependencies so tests drive it with fakes and no network. */
import { indiaDay, type Draft, type Ideas, type Sourced } from '@jashn/core';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import {
  createGeminiClientFrom,
  DEFAULT_TIMINGS,
  type GenerateFn,
  type Timings,
} from './ai/gemini.ts';
import { createCache } from './cache.ts';
import type { Config } from './config.ts';
import type { AppEnv } from './env.ts';
import {
  internalError,
  jsonOnly,
  notFound,
  serverRequestId,
  sizeLimit,
} from './middleware/errors.ts';
import { requestLogger, stdoutSink, type LogSink } from './middleware/logger.ts';
import { clientShare, hourlyBudget } from './middleware/quota.ts';
import { clientKey, rateLimit, type SocketAddress } from './middleware/rateLimit.ts';
import { apiHeaders, corsAllowList } from './middleware/security.ts';
import { assistHandler } from './routes/assist.ts';
import { draftHandler } from './routes/draft.ts';
import { healthHandler } from './routes/health.ts';
import { ideasHandler } from './routes/ideas.ts';
import { mountStatic } from './static.ts';

/** Everything the app needs from the outside world, injected so tests can fake it. */
export interface AppDeps {
  readonly config: Config;
  /** The Gemini SDK call; null runs every generative route on its fallback. */
  readonly generate: GenerateFn | null;
  readonly now?: () => number;
  readonly socketAddress?: SocketAddress;
  readonly log?: LogSink;
  readonly timings?: Partial<Timings>;
}

/** Gemini needs a key and a non-zero hourly budget; otherwise everything reports "fallback". */
export function usesGemini(config: Config, generate: GenerateFn | null): generate is GenerateFn {
  return generate !== null && config.hourlyBudget > 0;
}

/** Middleware, the API routes and, when configured, the built web app. */
export function createApp(deps: AppDeps): Hono<AppEnv> {
  const { config } = deps;
  const now = deps.now ?? Date.now;
  const today = (): number => indiaDay(now());
  const gemini = !usesGemini(config, deps.generate)
    ? null
    : createGeminiClientFrom(deps.generate, {
        ...DEFAULT_TIMINGS,
        ...deps.timings,
        models: config.models,
        budget: hourlyBudget(config.hourlyBudget, now),
      });

  const app = new Hono<AppEnv>();
  app.use(serverRequestId());
  app.use(requestLogger(deps.log ?? stdoutSink, () => performance.now()));
  app.use(compress());
  app.use('/api/*', apiHeaders());
  app.use('/api/*', corsAllowList(config.corsOrigins));

  const keyOf = clientKey(config.trustProxy, deps.socketAddress ?? (() => undefined));
  const limiter = rateLimit({ ...config.rateLimit, now, keyOf });
  const share = clientShare(config.clientHourlyBudget, now, keyOf);
  const guards = [limiter, share, jsonOnly(), sizeLimit()] as const;

  app.get('/api/health', healthHandler(gemini !== null));
  app.post(
    '/api/ideas',
    ...guards,
    ideasHandler({ gemini, today, cache: createCache<Sourced<Ideas>>(now) }),
  );
  app.post(
    '/api/draft',
    ...guards,
    draftHandler({ gemini, today, cache: createCache<Sourced<Draft>>(now) }),
  );
  app.post('/api/assist', ...guards, assistHandler({ gemini, today }));

  if (config.staticDir !== undefined) mountStatic(app, config.staticDir);
  app.notFound(notFound);
  app.onError(internalError);
  return app;
}
