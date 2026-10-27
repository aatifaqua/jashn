/**
 * Optional hosting of the built web app from the API's origin (one container, one origin, so
 * the SPA needs no CORS). Pages get the SPA Content-Security-Policy as a header with framing
 * denied; hashed build assets are cached as immutable, everything else is revalidated.
 */
import { serveStatic } from '@hono/node-server/serve-static';
import type { Context, Hono, MiddlewareHandler } from 'hono';
import type { AppEnv } from './env.ts';
import { spaHeaders } from './middleware/security.ts';

/** Vite puts content-hashed files here, so they can be cached for a year without revalidation. */
const ASSETS = '/assets/';
const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

const isApi = (c: Context<AppEnv>): boolean => c.req.path.startsWith('/api/');

/** Adds the caching policy to a file the handler found (serveStatic builds its own Response). */
function cached(serve: MiddlewareHandler<AppEnv>): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const res = await serve(c, next);
    if (res instanceof Response) {
      res.headers.set('Cache-Control', c.req.path.startsWith(ASSETS) ? IMMUTABLE : REVALIDATE);
    }
    return res;
  };
}

/**
 * Serves `root` for GET requests outside /api. Unknown page paths fall back to index.html;
 * unknown /assets/ paths stay 404 so a stale chunk is never answered with HTML.
 */
export function mountStatic(app: Hono<AppEnv>, root: string): void {
  const headers = spaHeaders();
  const files = cached(serveStatic<AppEnv>({ root }));
  const shell = cached(serveStatic<AppEnv>({ root, path: 'index.html' }));
  const pageHeaders: MiddlewareHandler<AppEnv> = (c, next) =>
    isApi(c) ? next() : headers(c, next);
  const page: MiddlewareHandler<AppEnv> = (c, next) => (isApi(c) ? next() : files(c, next));
  const fallback: MiddlewareHandler<AppEnv> = (c, next) =>
    isApi(c) || c.req.path.startsWith(ASSETS) ? next() : shell(c, next);
  app.use('*', pageHeaders);
  app.get('*', page, fallback);
}
