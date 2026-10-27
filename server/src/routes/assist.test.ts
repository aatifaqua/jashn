import { assistOffline, buildPlan, diffPlans, getProfile, type PlanDiff } from '@jashn/core';
import type { FunctionCall } from '@google/genai';
import { describe, expect, it } from 'vitest';
import { describeDiff } from './assist.ts';
import { fakeGenerate, post, sample, testApp, TODAY, type Scripted } from '../testing.ts';

const call = (
  args: Record<string, unknown>,
  name = 'update_event',
): { functionCalls: FunctionCall[] } => ({
  functionCalls: [{ name, args }],
});

async function assist(script: readonly Scripted[], message = 'Is my budget enough?') {
  const fake = fakeGenerate(script);
  const { app } = testApp({ generate: fake.generate });
  const history = [
    { role: 'user', text: 'Hi' },
    { role: 'assistant', text: 'Hello! How can I help?' },
  ];
  const res = await post(app, '/api/assist', { input: sample(), message, history });
  return { res, body: (await res.json()) as Record<string, unknown>, fake };
}

function offline(message: string) {
  const plan = buildPlan(sample(), TODAY, getProfile('wedding'));
  return assistOffline(message, plan);
}

describe('POST /api/assist', () => {
  it('answers a question from the plan with source gemini', async () => {
    const reply = 'Your budget is tight for 298 guests; consider trimming the guest list.';
    const { res, body, fake } = await assist([{ text: reply }]);
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ reply, source: 'gemini' });
    expect(body).not.toHaveProperty('patch');
    const params = fake.calls[0];
    expect(params?.config?.temperature).toBe(0.3);
    expect(params?.config?.tools).toHaveLength(1);
    expect(params?.contents).toEqual([
      { role: 'user', parts: [{ text: 'Hi' }] },
      { role: 'model', parts: [{ text: 'Hello! How can I help?' }] },
      { role: 'user', parts: [{ text: 'Is my budget enough?' }] },
    ]);
    expect(JSON.stringify(params?.config?.systemInstruction)).toContain('daysToGo');
  });

  it('turns a function call into a validated patch with a diff-based reply', async () => {
    const { body } = await assist([call({ invited: 200 })], 'Cut to 200 guests');
    expect(body).toMatchObject({ source: 'gemini', patch: { invited: 200 } });
    expect(String(body.reply)).toContain('expected guests 298 → 170');
  });

  it('keeps the model text with a patch when it passes the guards', async () => {
    const text = 'I can cut the guest list to 200 for you.';
    const { body } = await assist([{ text, ...call({ invited: 200 }) }], 'Cut to 200 guests');
    expect(body).toMatchObject({ reply: text, patch: { invited: 200 } });
  });

  it('allows the proposed budget in the reply', async () => {
    const text = 'With a budget of ₹20,00,000 the plan has more room.';
    const { body } = await assist([{ text, ...call({ budget: 2_000_000 }) }], 'Raise to 20 lakh');
    expect(body).toMatchObject({ source: 'gemini', reply: text, patch: { budget: 2_000_000 } });
  });

  it('replaces wording that quotes a figure the browser cannot check with the plan diff', async () => {
    const text = 'Catering would drop to ₹4,90,100.';
    const { body } = await assist([{ text, ...call({ invited: 200 }) }], 'Cut to 200 guests');
    expect(body).toMatchObject({ source: 'gemini', patch: { invited: 200 } });
    expect(String(body.reply)).toContain('expected guests 298 → 170');
  });

  it('falls back when the patch fails validation', async () => {
    const message = 'Cut to 250 guests';
    const { body } = await assist([call({ invited: 999_999 })], message);
    expect(body).toMatchObject({ ...offline(message), source: 'fallback' });
  });

  it('falls back when the model calls an unknown tool', async () => {
    const { body } = await assist([call({ invited: 200 }, 'delete_event')]);
    expect(body.source).toBe('fallback');
  });

  it('falls back when the reply invents an amount', async () => {
    const { body } = await assist([{ text: 'A DJ costs about ₹77,777.' }]);
    expect(body).toMatchObject({ ...offline('Is my budget enough?'), source: 'fallback' });
  });

  it('falls back when the reply invents a date', async () => {
    const { body } = await assist([{ text: 'Book the venue by 3 January 2029.' }]);
    expect(body.source).toBe('fallback');
  });

  it('allows the proposed date in a patch reply', async () => {
    const text = 'I can move it to 13 March 2027 for you.';
    const { body } = await assist([{ text, ...call({ date: '2027-03-13' }) }], 'Move it');
    expect(body).toMatchObject({ source: 'gemini', reply: text, patch: { date: '2027-03-13' } });
  });

  it('answers a wordless proposal in Hindi when the plan is in Hindi', async () => {
    const fake = fakeGenerate([call({ invited: 200 })]);
    const { app } = testApp({ generate: fake.generate });
    const input = { ...sample(), language: 'hi' };
    const res = await post(app, '/api/assist', { input, message: 'मेहमान 200 करें' });
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ source: 'gemini', patch: { invited: 200 } });
    expect(String(body.reply)).toMatch(/^मैंने यह बदलाव सुझाया है/);
  });

  it('falls back when the reply is empty', async () => {
    const { body } = await assist([{ text: '  ' }]);
    expect(body.source).toBe('fallback');
  });

  it('never passes on a link in a patch reply', async () => {
    const text = 'See www.example.com for more.';
    const { body } = await assist([{ text, ...call({ invited: 200 }) }]);
    expect(body).toMatchObject({ source: 'gemini', patch: { invited: 200 } });
    expect(String(body.reply)).not.toContain('example');
  });

  it('serves the offline assistant without a Gemini client', async () => {
    const { app } = testApp();
    const message = 'Cut to 250 guests';
    const res = await post(app, '/api/assist', { input: sample(), message });
    expect(await res.json()).toMatchObject({ ...offline(message), source: 'fallback' });
  });

  it('rejects an over-long message and too much history', async () => {
    const { app } = testApp();
    const long = await post(app, '/api/assist', { input: sample(), message: 'x'.repeat(501) });
    expect(await long.json()).toMatchObject({ fields: [{ field: 'message' }] });
    const history = Array.from({ length: 7 }, () => ({ role: 'user', text: 'hi' }));
    const many = await post(app, '/api/assist', { input: sample(), message: 'hi', history });
    expect(await many.json()).toMatchObject({ fields: [{ field: 'history' }] });
  });

  it('is never cached', async () => {
    const fake = fakeGenerate([{ text: 'Your plan looks good.' }]);
    const { app } = testApp({ generate: fake.generate });
    const body = { input: sample(), message: 'How is it going?' };
    await post(app, '/api/assist', body);
    await post(app, '/api/assist', body);
    expect(fake.calls).toHaveLength(2);
  });
});

describe('describeDiff', () => {
  it('says only that a change is ready when nothing user-facing moves', () => {
    const plan = buildPlan(sample(), TODAY, getProfile('wedding'));
    expect(describeDiff(diffPlans(plan, plan))).toBe(
      'Here is the proposed change. Preview it and apply it if it looks right.',
    );
  });

  it('lists verdict, budget lines and newly late tasks', () => {
    const plan = buildPlan(sample(), TODAY, getProfile('wedding'));
    const diff: PlanDiff = {
      expected: { before: 10, after: 10 },
      verdict: { before: 'tight', after: 'comfortable' },
      budget: [{ category: 'venue', before: 1, after: 2 }],
      newlyLate: [...plan.tasks.slice(0, 2)],
    };
    expect(describeDiff(diff)).toBe(
      'Here is the proposed change: budget verdict tight → comfortable; 1 budget line changes; ' +
        '2 tasks become late. Preview it and apply it if it looks right.',
    );
  });
});
