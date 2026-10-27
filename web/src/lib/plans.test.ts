import { getProfile, ideasOffline } from '@jashn/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage, TODAY, makeStore, sampleInput, savedPlan } from '../test-fixtures.ts';
import { PlanStore } from './plans.svelte.ts';
import { MAX_PLANS, readPlans, writePlans } from './storage.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PlanStore', () => {
  it('starts from the valid saved plans', () => {
    const storage = new MemoryStorage();
    writePlans(storage, [savedPlan({ id: 'kept' })]);
    expect(makeStore(storage).plans.map((plan) => plan.id)).toEqual(['kept']);
  });

  it('creates and opens a plan, deriving it with the loaded profile', async () => {
    const store = makeStore();
    expect(store.plan).toBeNull();
    const id = await store.create(sampleInput('kids-birthday'));
    expect(id).toBe('plan-1');
    expect(store.currentId).toBe('plan-1');
    expect(store.profile?.type).toBe('birthday');
    expect(store.plan?.input.type).toBe('birthday');
    expect(store.plan?.today).toBe(TODAY);
  });

  it('keeps the same plan object when only progress changes', async () => {
    const store = makeStore();
    await store.create(sampleInput());
    const plan = store.plan;
    store.setTask('book-venue', true);
    store.setVendorStatus('venue', 'quoted');
    expect(store.current?.checks).toEqual(['book-venue']);
    expect(store.current?.vendors).toEqual({ venue: 'quoted' });
    expect(store.plan).toBe(plan);
    store.setTask('book-venue', false);
    expect(store.current?.checks).toEqual([]);
  });

  it('opens, closes and edits plans, clearing stale state', async () => {
    const store = makeStore();
    const first = await store.create(sampleInput());
    await store.create(sampleInput('diwali-mela'));
    expect(await store.open(first ?? '')).toBe(true);
    expect(store.profile?.type).toBe('wedding');
    expect(await store.open('missing')).toBe(false);
    store.setTask('book-venue', true);
    const fresh = {
      ideas: ideasOffline(sampleInput()),
      source: 'fallback',
      language: 'en',
    } as const;
    store.setIdeas(fresh, store.plan?.input ?? sampleInput());
    expect(await store.edit({ ...sampleInput(), invited: 200 })).toBe(true);
    expect(store.current?.input.invited).toBe(200);
    expect(store.current?.ideas).toBeNull();
    expect(store.current?.checks).toEqual(['book-venue']);
    expect(await store.edit(sampleInput('kids-birthday'))).toBe(true);
    expect(store.current?.checks).toEqual([]);
    store.close();
    expect(store.current).toBeNull();
    expect(await store.edit(sampleInput())).toBe(false);
    store.setTask('ignored', true);
    expect(store.plans.every((plan) => !plan.checks.includes('ignored'))).toBe(true);
  });

  it('saves ideas only for the input they were made for', async () => {
    const store = makeStore();
    await store.create(sampleInput());
    const fresh = {
      ideas: ideasOffline(sampleInput()),
      source: 'fallback',
      language: 'en',
    } as const;
    store.setIdeas(fresh, sampleInput());
    expect(store.current?.ideas).toBeNull();
    store.setIdeas(fresh, store.plan?.input ?? sampleInput());
    expect(store.current?.ideas).toEqual(fresh);
  });

  it('applies a confirmed change and keeps ideas only while they respect the needs', async () => {
    const store = makeStore();
    await store.create({ ...sampleInput(), constraints: [] });
    const meaty = ideasOffline({ ...sampleInput(), constraints: [] });
    const withMeat = {
      ...meaty,
      menu: [{ title: 'Mutton korma', detail: 'Rich and slow-cooked.' }],
    };
    store.setIdeas(
      { ideas: withMeat, source: 'gemini', language: 'en' },
      store.plan?.input ?? sampleInput(),
    );
    store.applyChange({ invited: 300 });
    expect(store.current?.input.invited).toBe(300);
    expect(store.current?.ideas).not.toBeNull();
    store.applyChange({ constraints: ['vegetarian'] });
    expect(store.current?.ideas).toBeNull();
    store.setLanguage('hi');
    expect(store.plan?.input.language).toBe('hi');
  });

  it('keeps at most ten plans, newest first', async () => {
    const store = makeStore();
    for (let i = 0; i < MAX_PLANS + 2; i += 1) await store.create(sampleInput());
    expect(store.plans).toHaveLength(MAX_PLANS);
    expect(store.plans[0]?.id).toBe(`plan-${String(MAX_PLANS + 2)}`);
  });

  it('deletes one plan or everything, writing at once', async () => {
    const storage = new MemoryStorage();
    const store = makeStore(storage);
    const a = await store.create(sampleInput());
    await store.create(sampleInput('kids-birthday'));
    store.flush();
    expect(readPlans(storage, TODAY)).toHaveLength(2);
    store.remove('plan-2');
    expect(store.currentId).toBeNull();
    expect(readPlans(storage, TODAY).map((plan) => plan.id)).toEqual([a]);
    store.clearAll();
    expect(store.plans).toEqual([]);
    expect(readPlans(storage, TODAY)).toEqual([]);
  });

  it('reports a profile that fails to load', async () => {
    const store = new PlanStore({
      storage: null,
      today: TODAY,
      loadProfile: () => Promise.reject(new Error('offline')),
    });
    expect(await store.create(sampleInput('diwali-mela'))).toBeNull();
    expect(store.error).toMatch(/Could not load/);
  });

  it('ignores a profile that arrives after a newer request', async () => {
    const releases: (() => void)[] = [];
    const store = new PlanStore({
      storage: null,
      today: TODAY,
      loadProfile: (type) =>
        new Promise((resolve) => {
          releases.push(() => {
            resolve(getProfile(type));
          });
        }),
    });
    const first = store.create(sampleInput());
    const second = store.create(sampleInput('kids-birthday'));
    releases[1]?.();
    await second;
    releases[0]?.();
    await first;
    expect(store.profile?.type).toBe('birthday');
  });

  it('uses random ids by default', async () => {
    const store = new PlanStore({ storage: null, today: TODAY });
    const id = await store.create(sampleInput());
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reports whether plans are actually being stored', async () => {
    expect(new PlanStore({ storage: null, today: TODAY }).persisted).toBe(false);
    const storage = new MemoryStorage();
    const store = makeStore(storage);
    expect(store.persisted).toBe(true);
    storage.failWrites = true;
    await store.create(sampleInput());
    store.flush();
    expect(store.persisted).toBe(false);
  });

  it('does not open a plan whose profile request was overtaken', async () => {
    const releases: (() => void)[] = [];
    const store = new PlanStore({
      storage: null,
      today: TODAY,
      loadProfile: (type) =>
        new Promise((resolve) => {
          releases.push(() => {
            resolve(getProfile(type));
          });
        }),
    });
    const wedding = store.create(sampleInput());
    const birthday = store.create(sampleInput('kids-birthday'));
    releases[1]?.();
    releases[0]?.();
    expect(await birthday).not.toBeNull();
    expect(await wedding).toBeNull();
    expect(store.plan?.input.type).toBe('birthday');
  });

  it('clears a stale load error once a profile is in hand', async () => {
    let fail = true;
    const store = new PlanStore({
      storage: null,
      today: TODAY,
      loadProfile: (type) =>
        fail ? Promise.reject(new Error('offline')) : Promise.resolve(getProfile(type)),
    });
    expect(await store.fetchProfile('birthday')).toBeNull();
    expect(store.error).not.toBeNull();
    fail = false;
    await store.create(sampleInput());
    expect(store.error).toBeNull();
    fail = true;
    await store.fetchProfile('birthday');
    await store.create(sampleInput());
    expect(store.error).toBeNull();
  });
});
