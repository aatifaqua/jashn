/**
 * Environment validated with zod at start-up, so a typo fails fast by name. Values (the key
 * above all) are never echoed in errors or logs.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';

// STATIC_DIR is relative to the repo root, so it means the same folder from root or server/.
const REPO_ROOT = resolve(import.meta.dirname, '../..');

const DEFAULT_MODELS = 'gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash';

/** Used when PORT is unset. */
export const DEFAULT_PORT = 8787;

const list = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');

const count = (fallback: number, min = 1) => z.coerce.number().int().min(min).default(fallback);

// Scheme, host and port only, exactly as browsers send an Origin.
const ORIGIN = /^https?:\/\/[a-z0-9.-]+(?::\d{1,5})?$/i;
const MODEL = /^[a-z0-9][a-z0-9.-]*$/i;

const envSchema = z.object({
  GEMINI_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  PORT: z.coerce.number().int().min(1).max(65_535).default(DEFAULT_PORT),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform(list)
    .pipe(z.array(z.string().regex(ORIGIN))),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  GEMINI_MODELS: z
    .string()
    .default(DEFAULT_MODELS)
    .transform(list)
    .pipe(z.array(z.string().regex(MODEL)).min(1)),
  RATE_LIMIT_MAX: count(20),
  RATE_LIMIT_WINDOW_MS: count(60_000, 1000),
  GEMINI_HOURLY_BUDGET: count(600, 0),
  GEMINI_CLIENT_HOURLY: count(30),
  STATIC_DIR: z
    .string()
    .trim()
    .optional()
    .transform((value) =>
      value === undefined || value === '' ? undefined : resolve(REPO_ROOT, value),
    )
    .refine((dir) => dir === undefined || existsSync(join(dir, 'index.html')), {
      message: 'STATIC_DIR must contain index.html',
    }),
});

/** Validated server settings. */
export interface Config {
  /** Absent means fallback-only mode. */
  readonly geminiApiKey: string | undefined;
  readonly port: number;
  readonly corsOrigins: readonly string[];
  /** Read the client address from X-Forwarded-For; only safe behind a proxy that sets it. */
  readonly trustProxy: boolean;
  readonly models: readonly string[];
  readonly rateLimit: { readonly max: number; readonly windowMs: number };
  /** Gemini calls per clock hour across all clients. */
  readonly hourlyBudget: number;
  /** One client's hourly share, so no client can spend the whole budget. */
  readonly clientHourlyBudget: number;
  readonly staticDir: string | undefined;
}

/** Throws naming the bad variables, never their values, because the message reaches logs. */
export function loadConfig(env: Readonly<Record<string, string | undefined>>): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid environment variables: ${names.join(', ')}`);
  }
  const value = parsed.data;
  return {
    geminiApiKey: value.GEMINI_API_KEY,
    port: value.PORT,
    corsOrigins: value.CORS_ORIGINS,
    trustProxy: value.TRUST_PROXY,
    models: value.GEMINI_MODELS,
    rateLimit: { max: value.RATE_LIMIT_MAX, windowMs: value.RATE_LIMIT_WINDOW_MS },
    hourlyBudget: value.GEMINI_HOURLY_BUDGET,
    clientHourlyBudget: value.GEMINI_CLIENT_HOURLY,
    staticDir: value.STATIC_DIR,
  };
}

/** Loads a .env file if present with Node's built-in loader; existing variables win. */
export function loadLocalEnv(path: string): boolean {
  if (!existsSync(path)) return false;
  process.loadEnvFile(path);
  return true;
}
