import { SAMPLE_IDS, SUGGESTED_PROMPTS, VENDOR_IDS } from '@jashn/core';
import { describe, expect, it } from 'vitest';
import { apiError, fakeGenerate, GOOD_IDEAS, TODAY, type Scripted } from '../testing.ts';
import {
  BATCH_RESPONSE_SCHEMA,
  keepStored,
  pregenerate,
  readBatch,
  samplePlan,
  type DemoFile,
} from './batch.ts';
import { createGeminiClientFrom } from './gemini.ts';

const ENQUIRY = 'Hello, we are planning an event and would like your availability and a quote.';

/** A batch that answers every vendor and prompt, plus items each check must leave out. */
const BATCH = {
  ideas: GOOD_IDEAS,
  drafts: [
    ...VENDOR_IDS.map((vendorId) => ({ vendorId, text: ENQUIRY })),
    { vendorId: 'venue', text: 'A second venue draft is ignored.' },
  ],
  answers: [
    { message: 'What is late?', reply: 'Book the venue first.' },
    { message: 'How can I save money?', reply: 'A DJ costs ₹77,777.' },
    { message: 'What should I book first?', reply: 'See www.example.com.' },
    { message: 'When are payments due?', reply: 'Pay the venue advance first.', patch: {} },
    { message: 'Cut guests by 20', reply: '', patch: { invited: 30 } },
    { message: 'Something else', reply: 'Not a suggested prompt.' },
  ],
};

function run(script: readonly Scripted[], previous?: unknown) {
  const fake = fakeGenerate(script);
  const gemini = createGeminiClientFrom(fake.generate, {
    models: ['model-a'],
    callTimeoutMs: 50,
    deadlineMs: 200,
    backoffMs: 0,
    budget: { take: () => true },
  });
  const saved: DemoFile[] = [];
  const logs: string[] = [];
  const done = pregenerate({
    gemini,
    today: TODAY,
    previous,
    save: (file) => {
      saved.push(file);
      return Promise.resolve();
    },
    log: (line) => logs.push(line),
  });
  return { done, calls: fake.calls, saved, logs };
}

describe('pregenerate', () => {
  it('makes exactly one call per sample and keeps only the items the live checks pass', async () => {
    const { done, calls, saved } = run([{ text: JSON.stringify(BATCH) }]);
    const file = await done;
    expect(calls).toHaveLength(SAMPLE_IDS.length);
    expect(saved).toHaveLength(SAMPLE_IDS.length);
    expect(file.version).toBe(2);
    for (const id of SAMPLE_IDS) {
      const content = file.samples[id];
      const vendors = samplePlan(id, TODAY).vendors.map((vendor) => vendor.id);
      expect(content?.ideas).toEqual(GOOD_IDEAS);
      expect(Object.keys(content?.drafts ?? {}).sort()).toEqual([...vendors].sort());
      expect(content?.drafts.venue).toBe(ENQUIRY);
      expect(Object.keys(content?.answers ?? {}).sort()).toEqual([
        'Cut guests by 20',
        'What is late?',
      ]);
      expect(content?.answers['Cut guests by 20']?.patch).toEqual({ invited: 30 });
    }
  });

  it('sends the composed schema, every rule set, the vendors and the prompts', async () => {
    const { done, calls } = run([{ text: JSON.stringify(BATCH) }]);
    await done;
    const config = calls[0]?.config;
    expect(config?.responseJsonSchema).toEqual(BATCH_RESPONSE_SCHEMA);
    expect(config?.systemInstruction).toContain('three to five menu items');
    expect(config?.systemInstruction).toContain('ask every listed question');
    expect(config?.systemInstruction).toContain('put the fields that change in "patch"');
    const contents = JSON.stringify(calls[0]?.contents);
    expect(contents).toContain('caterer');
    for (const prompt of SUGGESTED_PROMPTS) expect(contents).toContain(prompt);
  });

  it('skips samples whose stored content is complete and still valid', async () => {
    const first = await run([{ text: JSON.stringify(BATCH) }]).done;
    const second = run([apiError(500)], JSON.parse(JSON.stringify(first)));
    expect(await second.done).toEqual(first);
    expect(second.calls).toHaveLength(0);
    expect(second.logs).toEqual(SAMPLE_IDS.map((id) => `${id}: kept`));
  });

  it('regenerates a sample with a stale item, and every sample of an older file', async () => {
    const first = await run([{ text: JSON.stringify(BATCH) }]).done;
    const stale = JSON.parse(JSON.stringify(first)) as DemoFile;
    const wedding = stale.samples['lucknow-wedding'];
    if (wedding) wedding.drafts.venue = 'Please confirm by 1 January 2020.';
    const again = run([{ text: JSON.stringify(BATCH) }], stale);
    expect((await again.done).samples['lucknow-wedding']?.drafts.venue).toBe(ENQUIRY);
    expect(again.calls).toHaveLength(1);
    const older = run([{ text: JSON.stringify(BATCH) }], { ...first, version: 1 });
    await older.done;
    expect(older.calls).toHaveLength(SAMPLE_IDS.length);
  });

  it('keeps what still holds when a call fails or returns no JSON, and carries on', async () => {
    const first = await run([{ text: JSON.stringify(BATCH) }]).done;
    const withoutIdeas = JSON.parse(JSON.stringify(first)) as DemoFile;
    delete withoutIdeas.samples['kids-birthday']?.ideas;
    const failed = run([apiError(400), { text: 'not json' }], withoutIdeas);
    const file = await failed.done;
    expect(failed.calls).toHaveLength(1);
    expect(file.samples['kids-birthday']?.drafts).toEqual(first.samples['kids-birthday']?.drafts);
    expect(file.samples['kids-birthday']?.ideas).toBeUndefined();
    expect(failed.logs.some((line) => line.startsWith('kids-birthday: failed'))).toBe(true);
    const broken = run([{ text: 'not json' }]);
    expect((await broken.done).samples['diwali-mela']).toEqual({ drafts: {}, answers: {} });
  });
});

describe('readBatch', () => {
  const plan = samplePlan('lucknow-wedding', TODAY);

  it('leaves out ideas that break the diet, and anything of the wrong shape', () => {
    const meat = { ...GOOD_IDEAS, menu: [...GOOD_IDEAS.menu, { title: 'Chicken', detail: 'x' }] };
    expect(readBatch({ ideas: meat, drafts: 'none', answers: [null] }, plan)).toEqual({
      drafts: {},
      answers: {},
    });
    expect(readBatch(null, plan)).toEqual({ drafts: {}, answers: {} });
  });
});

describe('keepStored', () => {
  const plan = samplePlan('lucknow-wedding', TODAY);

  it('drops ideas written in another season and reports the sample incomplete', () => {
    const stored = { ideas: GOOD_IDEAS, drafts: { venue: ENQUIRY }, answers: {} };
    expect(keepStored(stored, plan, true).complete).toBe(true);
    const moved = keepStored(stored, plan, false);
    expect(moved.complete).toBe(false);
    expect(moved.content).toEqual({ drafts: { venue: ENQUIRY }, answers: {} });
  });

  it('re-checks stored answers like new ones', () => {
    const stored = { ideas: GOOD_IDEAS, drafts: {}, answers: { 'What is late?': 'text' } };
    expect(keepStored(stored, plan, true)).toEqual({
      content: { ideas: GOOD_IDEAS, drafts: {}, answers: {} },
      complete: false,
    });
  });
});
