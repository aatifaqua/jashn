import { fromIso, ideasOffline } from '@jashn/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage, TODAY, sampleInput, savedPlan } from '../test-fixtures.ts';
import {
  MAX_PLANS,
  STORAGE_KEY,
  browserStorage,
  createWriter,
  planDay,
  readPlan,
  readPlans,
  writePlans,
} from './storage.ts';

function stored(plans: unknown, version: unknown = 1): MemoryStorage {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify({ version, plans }));
  return storage;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('readPlans', () => {
  it('round-trips valid plans, newest first', () => {
    const storage = new MemoryStorage();
    const older = savedPlan({ id: 'a', updated: 1 });
    const newer = savedPlan({
      id: 'b',
      updated: 2,
      checks: ['book-venue'],
      vendors: { venue: 'quoted' },
    });
    expect(writePlans(storage, [older, newer])).toBe(true);
    expect(readPlans(storage, TODAY).map((plan) => plan.id)).toEqual(['b', 'a']);
    expect(readPlans(storage, TODAY)[0]).toEqual(newer);
  });

  it('returns nothing for missing, unparsable or other-version data', () => {
    expect(readPlans(null, TODAY)).toEqual([]);
    expect(readPlans(new MemoryStorage(), TODAY)).toEqual([]);
    const garbage = new MemoryStorage();
    garbage.setItem(STORAGE_KEY, '{not json');
    expect(readPlans(garbage, TODAY)).toEqual([]);
    expect(readPlans(stored([savedPlan()], 2), TODAY)).toEqual([]);
    expect(readPlans(stored('plans'), TODAY)).toEqual([]);
  });

  it('drops tampered entries and keeps the valid ones', () => {
    const good = savedPlan({ id: 'good' });
    const tampered = [
      { ...good, id: 'Bad Id' },
      { ...good, id: 'neg', updated: -1 },
      { ...good, id: 'nan', updated: 'soon' },
      { ...good, id: 'guests', input: { ...good.input, invited: 99_999 } },
      { ...good, id: 'extra', input: { ...good.input, type: 'funeral' } },
      { ...good, id: 'checks', checks: ['<img src=x>'] },
      { ...good, id: 'many', checks: Array.from({ length: 401 }, (_, i) => `t${String(i)}`) },
      { ...good, id: 'vendors', vendors: { venue: 'stolen' } },
      { ...good, id: 'vendor-list', vendors: ['venue'] },
      'string entry',
      null,
    ];
    const plans = readPlans(stored([...tampered, good, { ...good, updated: 5 }]), TODAY);
    expect(plans.map((plan) => plan.id)).toEqual(['good']);
  });

  it('keeps a plan but drops ideas that are malformed or break its needs', () => {
    const input = sampleInput();
    const ideas = ideasOffline(input);
    const valid = { ideas, source: 'gemini', language: 'en' };
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

  it('de-duplicates checks and caps the list at the plan limit', () => {
    expect(readPlan({ ...savedPlan(), checks: ['a', 'a', 'b'] }, TODAY)?.checks).toEqual([
      'a',
      'b',
    ]);
    const many = Array.from({ length: MAX_PLANS + 3 }, (_, i) =>
      savedPlan({ id: `p${String(i)}`, updated: i }),
    );
    expect(readPlans(stored(many), TODAY)).toHaveLength(MAX_PLANS);
  });
});

describe('writePlans', () => {
  it('removes the key when no plans remain and reports failures', () => {
    const storage = stored([savedPlan()]);
    expect(writePlans(storage, [])).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    storage.failWrites = true;
    expect(writePlans(storage, [savedPlan()])).toBe(false);
    expect(writePlans(null, [savedPlan()])).toBe(false);
  });
});

describe('createWriter', () => {
  it('coalesces scheduled writes into one', () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const spy = vi.spyOn(storage, 'setItem');
    const writer = createWriter(storage, 100);
    writer.schedule([savedPlan({ id: 'a' })]);
    writer.schedule([savedPlan({ id: 'b' })]);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(readPlans(storage, TODAY).map((plan) => plan.id)).toEqual(['b']);
  });

  it('flushes a pending write at once and is a no-op when idle', () => {
    const storage = new MemoryStorage();
    const writer = createWriter(storage);
    expect(writer.flush()).toBe(true);
    writer.schedule([savedPlan()]);
    expect(writer.flush()).toBe(true);
    expect(readPlans(storage, TODAY)).toHaveLength(1);
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

  describe('past events', () => {
    it('keeps a plan whose event has passed, computed as of its own day', () => {
      const input = sampleInput();
      const eventDay = fromIso(input.date) ?? 0;
      const plans = readPlans(stored([savedPlan()]), eventDay + 30);
      expect(plans.map((plan) => plan.id)).toEqual(['plan-1']);
      expect(planDay(input, eventDay + 30)).toBe(eventDay);
      expect(planDay(input, TODAY)).toBe(TODAY);
      expect(readPlan({ ...savedPlan(), input: 'nonsense' }, TODAY)).toBeNull();
    });

    it('reports each write result to the writer callback', () => {
      const storage = new MemoryStorage();
      const results: boolean[] = [];
      const writer = createWriter(storage, 10, (ok) => results.push(ok));
      writer.schedule([savedPlan()]);
      writer.flush();
      storage.failWrites = true;
      writer.schedule([savedPlan()]);
      writer.flush();
      expect(results).toEqual([true, false]);
    });
  });
});
