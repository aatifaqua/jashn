import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_PORT, loadConfig, loadLocalEnv } from './config.ts';

describe('loadConfig', () => {
  it('runs in fallback-only mode with defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({
      geminiApiKey: undefined,
      port: DEFAULT_PORT,
      corsOrigins: [],
      trustProxy: false,
      models: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'],
      rateLimit: { max: 20, windowMs: 60_000 },
      hourlyBudget: 600,
      clientHourlyBudget: 30,
      staticDir: undefined,
    });
  });

  it('reads every variable', () => {
    const site = mkdtempSync(join(tmpdir(), 'jashn-site-'));
    writeFileSync(join(site, 'index.html'), '<!doctype html>');
    const config = loadConfig({
      GEMINI_API_KEY: ' key ',
      PORT: '9000',
      CORS_ORIGINS: 'https://a.example, http://localhost:5173',
      TRUST_PROXY: 'true',
      GEMINI_MODELS: 'm-1,m-2',
      RATE_LIMIT_MAX: '5',
      RATE_LIMIT_WINDOW_MS: '2000',
      GEMINI_HOURLY_BUDGET: '0',
      GEMINI_CLIENT_HOURLY: '7',
      STATIC_DIR: site,
    });
    expect(config).toEqual({
      geminiApiKey: 'key',
      port: 9000,
      corsOrigins: ['https://a.example', 'http://localhost:5173'],
      trustProxy: true,
      models: ['m-1', 'm-2'],
      rateLimit: { max: 5, windowMs: 2000 },
      hourlyBudget: 0,
      clientHourlyBudget: 7,
      staticDir: site,
    });
  });

  it('reads STATIC_DIR from the repository root and fails fast when it has no index.html', () => {
    const root = resolve(import.meta.dirname, '../..');
    const relative = mkdtempSync(join(root, 'tmp-site-'));
    try {
      writeFileSync(join(relative, 'index.html'), '<!doctype html>');
      const name = relative.slice(root.length + 1);
      expect(loadConfig({ STATIC_DIR: name }).staticDir).toBe(relative);
    } finally {
      rmSync(relative, { recursive: true, force: true });
    }
    expect(() => loadConfig({ STATIC_DIR: 'web/dsit' })).toThrow('STATIC_DIR');
  });

  it('treats empty strings as unset', () => {
    const config = loadConfig({ GEMINI_API_KEY: '', STATIC_DIR: ' ' });
    expect(config.geminiApiKey).toBeUndefined();
    expect(config.staticDir).toBeUndefined();
  });

  it('names bad variables without echoing their values', () => {
    const run = () =>
      loadConfig({ PORT: 'abc', CORS_ORIGINS: 'https://a.example/path', GEMINI_API_KEY: 's3cret' });
    expect(run).toThrow('Invalid environment variables: PORT, CORS_ORIGINS');
    expect(run).not.toThrow(/s3cret|path/);
  });

  it('rejects an empty model chain and a bad trust-proxy switch', () => {
    expect(() => loadConfig({ GEMINI_MODELS: ' , ' })).toThrow('GEMINI_MODELS');
    expect(() => loadConfig({ TRUST_PROXY: 'yes' })).toThrow('TRUST_PROXY');
  });
});

describe('loadLocalEnv', () => {
  const keys = ['JASHN_TEST_A', 'JASHN_TEST_B'];
  afterEach(() => {
    for (const key of keys) Reflect.deleteProperty(process.env, key);
  });

  it('returns false when there is no file', () => {
    expect(loadLocalEnv(join(tmpdir(), 'jashn-missing', '.env'))).toBe(false);
  });

  it('loads variables without overriding ones already set', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jashn-env-'));
    const file = join(dir, '.env');
    writeFileSync(file, 'JASHN_TEST_A=from-file\nJASHN_TEST_B=from-file\n');
    process.env.JASHN_TEST_B = 'from-env';
    expect(loadLocalEnv(file)).toBe(true);
    expect(process.env.JASHN_TEST_A).toBe('from-file');
    expect(process.env.JASHN_TEST_B).toBe('from-env');
  });
});
