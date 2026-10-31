import { fromIso, ideasOffline } from '@jashn/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage, TODAY, sampleInput, savedPlan } from '../test-fixtures.ts';
import {
  LEGACY_KEY,
  STORAGE_KEY,
  browserStorage,
  createWriter,
  loadPlan,
  planDay,
  readPlan,
  writePlan,
} from './storage.ts';

function stored(value: unknown): MemoryStorage {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(value));
  return storage;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('loadPlan', () => {
  it('round-trips the plan with its progress', () => {
    const storage = new MemoryStorage();
    const plan = savedPlan({ checks: ['book-venue'], vendors: { venue: 'quoted' } });
    expect(writePlan(storage, plan)).toBe(true);
    expect(loadPlan(storage, TODAY)).toEqual(plan);
  });

  it('returns null for missing or unparsable data', () => {
    expect(loadPlan(null, TODAY)).toBeNull();
    expect(loadPlan(new MemoryStorage(), TODAY)).toBeNull();
    const garbage = new MemoryStorage();
    garbage.setItem(STORAGE_KEY, '{not json');
    expect(loadPlan(garbage, TODAY)).toBeNull();
    expect(loadPlan(stored('plan'), TODAY)).toBeNull();
  });

  it.each([
    ['a bad id', { id: 'Bad Id' }],
    ['too many guests', { input: { ...sampleInput(), invited: 99_999 } }],
    ['an unknown type', { input: { ...sampleInput(), type: 'funeral' } }],
    ['a markup check', { checks: ['<img src=x>'] }],
    ['too many checks', { checks: Array.from({ length: 401 }, (_, i) => `t${String(i)}`) }],
    ['an unknown vendor status', { vendors: { venue: 'stolen' } }],
    ['a vendor list', { vendors: ['venue'] }],
  ])('drops a tampered plan with %s', (_, change) => {
    expect(loadPlan(stored({ ...savedPlan(), ...change }), TODAY)).toBeNull();
  });
});

describe('legacy migration', () => {
  function legacy(value: unknown): MemoryStorage {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_KEY, typeof value === 'string' ? value : JSON.stringify(value));
    return storage;
  }

  it('moves the newest valid plan of the old list to the new key and removes the list', () => {
    const older = { ...savedPlan({ id: 'older' }), updated: 1 };
    const newest = { ...savedPlan({ id: 'newest', checks: ['book-venue'] }), updated: 3 };
    const broken = { ...savedPlan({ id: 'Bad Id' }), updated: 9 };
    const storage = legacy({ version: 1, plans: [older, broken, newest] });
    expect(loadPlan(storage, TODAY)).toEqual(savedPlan({ id: 'newest', checks: ['book-venue'] }));
    expect(storage.getItem(LEGACY_KEY)).toBeNull();
    expect(loadPlan(storage, TODAY)?.id).toBe('newest');
  });

  it.each([
    ['unparsable', '{not json'],
    ['an unknown version', { version: 2, plans: [savedPlan()] }],
    ['no valid entry', { version: 1, plans: [{ id: 'Bad Id' }, 'plan'] }],
  ])('removes an old list that is %s and loads nothing', (_, value) => {
    const storage = legacy(value);
    expect(loadPlan(storage, TODAY)).toBeNull();
    expect(storage.getItem(LEGACY_KEY)).toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('keeps a plan already under the new key and still removes the old list', () => {
    const storage = legacy({ version: 1, plans: [{ ...savedPlan({ id: 'old' }), updated: 1 }] });
    writePlan(storage, savedPlan({ id: 'current' }));
    expect(loadPlan(storage, TODAY)?.id).toBe('current');
    expect(storage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('keeps the old list for a later load when storage refuses the write', () => {
    const storage = legacy({ version: 1, plans: [{ ...savedPlan(), updated: 1 }] });
    storage.failWrites = true;
    expect(loadPlan(storage, TODAY)).toBeNull();
    expect(storage.getItem(LEGACY_KEY)).not.toBeNull();
  });
});

describe('readPlan', () => {
  it('keeps a plan but drops ideas that are malformed or break its needs', () => {
    const input = sampleInput();
    const ideas = ideasOffline(input);
    const valid = { ideas, source: 'gemini' };
    const meaty = {
      ...valid,
      ideas: { ...ideas, menu: [{ title: 'Chicken tikka', detail: 'Grilled.' }] },
    };
    expect(readPlan({ ...savedPlan(), ideas: valid }, TODAY)?.ideas).toEqual(valid);
    expect(readPlan({ ...savedPlan(), ideas: meaty }, TODAY)?.ideas).toBeNull();
    expect(
      readPlan({ ...savedPlan(), ideas: { ...valid, source: 'other' } }, TODAY)?.ideas,
    ).toBeNull();
    expect(readPlan({ ...savedPlan(), ideas: undefined }, TODAY)?.ideas).toBeNull();
  });

  it('de-duplicates checks', () => {
    expect(readPlan({ ...savedPlan(), checks: ['a', 'a', 'b'] }, TODAY)?.checks).toEqual([
      'a',
      'b',
    ]);
  });

  it('keeps a plan whose event has passed, computed as of its own day', () => {
    const input = sampleInput();
    const eventDay = fromIso(input.date) ?? 0;
    expect(loadPlan(stored(savedPlan()), eventDay + 30)?.id).toBe('plan-1');
    expect(planDay(input, eventDay + 30)).toBe(eventDay);
    expect(planDay(input, TODAY)).toBe(TODAY);
    expect(readPlan({ ...savedPlan(), input: 'nonsense' }, TODAY)).toBeNull();
  });
});

describe('writePlan', () => {
  it('removes the key for no plan and reports failures', () => {
    const storage = stored(savedPlan());
    expect(writePlan(storage, null)).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    storage.failWrites = true;
    expect(writePlan(storage, savedPlan())).toBe(false);
    expect(writePlan(null, savedPlan())).toBe(false);
  });
});

describe('createWriter', () => {
  it('coalesces scheduled writes into one', () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const spy = vi.spyOn(storage, 'setItem');
    const writer = createWriter(storage, 100);
    writer.run(savedPlan({ id: 'a' }));
    writer.run(savedPlan({ id: 'b' }));
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(loadPlan(storage, TODAY)?.id).toBe('b');
  });

  it('flushes a pending write at once', () => {
    const storage = new MemoryStorage();
    const writer = createWriter(storage);
    writer.run(savedPlan());
    writer.flush();
    expect(loadPlan(storage, TODAY)).not.toBeNull();
  });

  it('reports each write result to the callback', () => {
    const storage = new MemoryStorage();
    const results: boolean[] = [];
    const writer = createWriter(storage, 10, (ok) => results.push(ok));
    writer.run(savedPlan());
    writer.flush();
    storage.failWrites = true;
    writer.run(savedPlan());
    writer.flush();
    expect(results).toEqual([true, false]);
  });
});

describe('browserStorage', () => {
  it('returns localStorage, or null when access throws', () => {
    expect(browserStorage()).toBe(window.localStorage);
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(browserStorage()).toBeNull();
  });
});
