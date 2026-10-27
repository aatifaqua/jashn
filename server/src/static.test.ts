import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { testApp, testConfig } from './testing.ts';

function site() {
  const root = mkdtempSync(join(tmpdir(), 'jashn-web-'));
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>Jashn</title>');
  writeFileSync(join(root, 'assets', 'app-1a2b.js'), 'console.log(1)');
  return testApp({ config: testConfig({ staticDir: root }) }).app;
}

describe('static hosting', () => {
  it('serves the app shell with the SPA policy and revalidation', async () => {
    const res = await site().request('/');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>Jashn</title>');
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('caches hashed assets as immutable', async () => {
    const res = await site().request('/assets/app-1a2b.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('falls back to the shell for page paths but not for assets or the API', async () => {
    const app = site();
    expect(await (await app.request('/plans/1')).text()).toContain('Jashn');
    expect((await app.request('/assets/missing.js')).status).toBe(404);
    const api = await app.request('/api/missing');
    expect(api.status).toBe(404);
    expect(api.headers.get('content-security-policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
  });

  it('keeps the API working alongside the app', async () => {
    const res = await site().request('/api/health');
    expect(res.status).toBe(200);
  });
});
