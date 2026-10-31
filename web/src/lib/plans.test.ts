import { getProfile, ideasOffline } from '@jashn/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage, TODAY, makeStore, sampleInput, savedPlan } from '../test-fixtures.ts';
import { PlanStore } from './plans.svelte.ts';
import { loadPlan, writePlan } from './storage.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PlanStore', () => {
  it('starts from the saved plan', () => {
    const storage = new MemoryStorage();
    writePlan(storage, savedPlan({ id: 'kept' }));
    expect(makeStore(storage).current?.id).toBe('kept');
  });

  it('reloads a plan another tab saved, dropping its own pending write', async () => {
    const storage = new MemoryStorage();
    const store = new PlanStore({ storage, today: TODAY, writeDelayMs: 1_000 });
    await store.create(sampleInput());
    store.flush();
    store.setTask('book-venue', true);
    writePlan(storage, savedPlan({ id: 'other-tab', input: sampleInput('kids-birthday') }));
    await store.reload();
    expect(store.current?.id).toBe('other-tab');
    expect(store.profile?.type).toBe('birthday');
    store.flush();
    expect(loadPlan(storage, TODAY)?.id).toBe('other-tab');
    writePlan(storage, null);
    await store.reload();
    expect(store.current).toBeNull();
  });

  it('creates and opens a plan, deriving it with the loaded profile', async () => {
    const store = makeStore();
    expect(store.plan).toBeNull();
    expect(await store.create(sampleInput('kids-birthday'))).toBe(true);
    expect(store.current?.id).toBe('plan-1');
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

  it('opens the saved plan, edits it and clears it, dropping stale state', async () => {
    const storage = new MemoryStorage();
    expect(await makeStore(storage).open()).toBe(false);
    writePlan(storage, savedPlan());
    const store = makeStore(storage);
    expect(await store.open()).toBe(true);
    expect(store.profile?.type).toBe('wedding');
    store.setTask('book-venue', true);
    const fresh = {
      ideas: ideasOffline(sampleInput()),
      source: 'fallback',
    } as const;
    store.setIdeas(fresh, store.plan?.input ?? sampleInput());
    expect(await store.edit({ ...sampleInput(), invited: 200 })).toBe(true);
    expect(store.current?.input.invited).toBe(200);
    expect(store.current?.ideas).toBeNull();
    expect(store.current?.checks).toEqual(['book-venue']);
    expect(await store.edit(sampleInput('kids-birthday'))).toBe(true);
    expect(store.current?.checks).toEqual([]);
    store.clear();
    expect(store.current).toBeNull();
    expect(loadPlan(storage, TODAY)).toBeNull();
    expect(await store.edit(sampleInput())).toBe(false);
    store.setTask('ignored', true);
    expect(store.current).toBeNull();
  });

  it('saves ideas only for the input they were made for', async () => {
    const store = makeStore();
    await store.create(sampleInput());
    const fresh = {
      ideas: ideasOffline(sampleInput()),
      source: 'fallback',
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
    store.setIdeas({ ideas: withMeat, source: 'gemini' }, store.plan?.input ?? sampleInput());
    store.applyChange({ invited: 300 });
    expect(store.current?.input.invited).toBe(300);
    expect(store.current?.ideas).not.toBeNull();
    store.applyChange({ constraints: ['vegetarian'] });
    expect(store.current?.ideas).toBeNull();
  });

  it('moves to a new day and the plan follows', async () => {
    const store = makeStore();
    await store.create(sampleInput());
    store.setToday(TODAY);
    store.setToday(TODAY + 1);
    expect(store.today).toBe(TODAY + 1);
    expect(store.plan?.today).toBe(TODAY + 1);
  });

  it('retries the open that failed, not the form type', async () => {
    const storage = new MemoryStorage();
    writePlan(storage, savedPlan());
    let online = false;
    const store = new PlanStore({
      storage,
      today: TODAY,
      loadProfile: (type) =>
        online ? Promise.resolve(getProfile(type)) : Promise.reject(new Error('offline')),
    });
    expect(await store.retry()).toBeNull();
    expect(await store.open()).toBe(false);
    expect(store.error).not.toBeNull();
    online = true;
    expect(await store.retry()).toBe(true);
    expect(store.plan?.input.type).toBe('wedding');
    expect(store.error).toBeNull();
  });

  it('retries a failed create and a failed edit', async () => {
    let online = false;
    const store = new PlanStore({
      storage: null,
      today: TODAY,
      newId: () => 'plan-x',
      loadProfile: (type) =>
        online ? Promise.resolve(getProfile(type)) : Promise.reject(new Error('offline')),
    });
    expect(await store.create(sampleInput())).toBe(false);
    online = true;
    expect(await store.retry()).toBe(true);
    expect(store.current?.id).toBe('plan-x');
    online = false;
    expect(await store.edit(sampleInput('kids-birthday'))).toBe(false);
    online = true;
    expect(await store.retry()).toBe(true);
    expect(store.input?.type).toBe('birthday');
  });

  it('reports a profile that fails to load', async () => {
    const store = new PlanStore({
      storage: null,
      today: TODAY,
      loadProfile: () => Promise.reject(new Error('offline')),
    });
    expect(await store.create(sampleInput('diwali-mela'))).toBe(false);
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
    await store.create(sampleInput());
    expect(store.current?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reports whether the plan is actually being stored', async () => {
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
    expect(await birthday).toBe(true);
    expect(await wedding).toBe(false);
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
