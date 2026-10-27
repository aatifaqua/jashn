import { buildPlan, draftEnquiry, getProfile } from '@jashn/core';
import { describe, expect, it } from 'vitest';
import { fakeGenerate, post, sample, testApp, TODAY } from '../testing.ts';

const TEXT = 'Hello, we are planning a wedding in Lucknow and would like your availability.';

describe('POST /api/draft', () => {
  it('returns a Gemini draft for a vendor in the plan', async () => {
    const fake = fakeGenerate([{ text: JSON.stringify({ text: TEXT }) }]);
    const { app } = testApp({ generate: fake.generate });
    const res = await post(app, '/api/draft', { input: sample(), vendorId: 'caterer' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ vendorId: 'caterer', text: TEXT, source: 'gemini' });
    const config = fake.calls[0]?.config;
    expect(config?.temperature).toBe(0.5);
    expect(JSON.stringify(fake.calls[0]?.contents)).not.toContain('Kanpur');
  });

  it('serves the deterministic draft when Gemini quotes an amount not in the plan', async () => {
    const bad = `${TEXT} Our budget is ₹12,345.`;
    const fake = fakeGenerate([{ text: JSON.stringify({ text: bad }) }]);
    const { app } = testApp({ generate: fake.generate });
    const res = await post(app, '/api/draft', { input: sample(), vendorId: 'caterer' });
    const plan = buildPlan(sample(), TODAY, getProfile('wedding'));
    const vendor = plan.vendors.find((item) => item.id === 'caterer');
    expect(vendor).toBeDefined();
    if (vendor === undefined) return;
    expect(await res.json()).toMatchObject({
      ...draftEnquiry(plan, vendor),
      source: 'fallback',
    });
  });

  it('caches drafts per vendor', async () => {
    const fake = fakeGenerate([{ text: JSON.stringify({ text: TEXT }) }]);
    const { app } = testApp({ generate: fake.generate });
    await post(app, '/api/draft', { input: sample(), vendorId: 'caterer' });
    await post(app, '/api/draft', { input: sample(), vendorId: 'caterer' });
    await post(app, '/api/draft', { input: sample(), vendorId: 'venue' });
    expect(fake.calls).toHaveLength(2);
  });

  it('shares one draft between inputs that differ only in the note, which it leaves out', async () => {
    const fake = fakeGenerate([{ text: JSON.stringify({ text: TEXT }) }]);
    const { app } = testApp({ generate: fake.generate });
    await post(app, '/api/draft', { input: sample(), vendorId: 'caterer' });
    const renoted = { ...sample(), note: 'Another note entirely' };
    await post(app, '/api/draft', { input: renoted, vendorId: 'caterer' });
    expect(fake.calls).toHaveLength(1);
  });

  it('rejects a vendor the plan does not include', async () => {
    const { app } = testApp();
    const res = await post(app, '/api/draft', { input: sample(), vendorId: 'sanitation' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ fields: [{ field: 'vendorId' }] });
  });

  it('rejects an unknown vendor id', async () => {
    const { app } = testApp();
    const res = await post(app, '/api/draft', { input: sample(), vendorId: 'astrologer' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ fields: [{ field: 'vendorId', code: 'invalid' }] });
  });
});
