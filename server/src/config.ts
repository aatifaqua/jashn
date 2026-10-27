/**
 * Server configuration read once from the environment and validated with zod at start-up, so a
 * typo fails fast with the variable's name instead of surfacing later as odd behaviour. Values
 * (the Gemini key above all) are never echoed in errors or logs.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';

/**
 * STATIC_DIR is read relative to the repository root, so "web/dist" means the same folder
 * whether the server runs from the root (Docker) or from server/ (npm start -w server).
 */
const REPO_ROOT = resolve(import.meta.dirname, '../..');

/** Newest flash model first; each later one is tried only when the previous is overloaded. */
export const DEFAULT_MODELS = 'gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash';

/** Port used when PORT is unset. */
export const DEFAULT_PORT = 8787;

const list = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');

const count = (fallback: number, min = 1) => z.coerce.number().int().min(min).default(fallback);

/** An origin is scheme and host (and port) only, exactly as browsers send it. */
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
  /** Absent means fallback-only mode: every generative endpoint serves the core fallbacks. */
  readonly geminiApiKey: string | undefined;
  readonly port: number;
  /** Exact origins allowed to call the API from a browser. */
  readonly corsOrigins: readonly string[];
  /** Read the client address from X-Forwarded-For; only safe behind a proxy that sets it. */
  readonly trustProxy: boolean;
  /** Model chain, tried in order. */
  readonly models: readonly string[];
  readonly rateLimit: { readonly max: number; readonly windowMs: number };
  /** Gemini calls allowed per clock hour across all clients; past it, fallbacks are served. */
  readonly hourlyBudget: number;
  /** Gemini requests one client may start per hour, so no client can spend the whole budget. */
  readonly clientHourlyBudget: number;
  /** Built web app to serve from the same origin, if any. */
  readonly staticDir: string | undefined;
}

/**
 * Validates the environment. Throws an error naming the bad variables, never their values,
 * because the message reaches start-up logs.
 */
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

/**
 * Loads a local .env file into process.env when one exists, using Node's built-in loader (no
 * dotenv dependency). Variables already set in the environment win. Returns whether a file
 * was read.
 */
export function loadLocalEnv(path: string): boolean {
  if (!existsSync(path)) return false;
  process.loadEnvFile(path);
  return true;
}
