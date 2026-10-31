import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS, EVENT_TYPES, STYLE_IDS, VENDOR_IDS, WEDDING_FUNCTIONS } from '../ids.ts';
import { parseTime } from '../days.ts';
import { getProfile } from './all.ts';
import { deepFreeze } from '../freeze.ts';
import { slot } from '../templates.ts';
import { loadProfile } from './index.ts';
import type { Applicability, Profile } from '../types.ts';

const PROFILES: readonly Profile[] = EVENT_TYPES.map(getProfile);

describe.each(PROFILES)('$type profile', (profile) => {
  it('defines exactly the shared style and category ids', () => {
    expect(profile.styles.map((style) => style.id)).toEqual(STYLE_IDS[profile.type]);
    expect(profile.categories.map((category) => category.id)).toEqual(CATEGORY_IDS[profile.type]);
  });

  it('has base weights summing to 90 and sane style deltas', () => {
    const base = profile.categories.reduce((sum, category) => sum + category.weight, 0);
    expect(base).toBe(90);
    const categories = new Set<string>(CATEGORY_IDS[profile.type]);
    for (const style of profile.styles) {
      for (const delta of style.deltas) {
        expect(categories.has(delta.category)).toBe(true);
        const weight = profile.categories.find((c) => c.id === delta.category)?.weight ?? 0;
        expect(weight + delta.points).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('has valid start times, walk-in factors and run sheets', () => {
    for (const style of profile.styles) {
      expect(parseTime(style.startTime)).not.toBeNull();
      expect(style.walkIn).toBeGreaterThanOrEqual(1);
      expect(style.runSheet.length).toBeGreaterThan(0);
      for (const entry of style.runSheet) expect(entry.durationMin).toBeGreaterThan(0);
    }
  });

  it('has unique task ids and dependencies only on tasks that always apply', () => {
    const ids = profile.tasks.map((task) => task.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const task of profile.tasks) {
      if (task.after === undefined) continue;
      const before = profile.tasks.find((other) => other.id === task.after);
      expect(before?.appliesWhen).toBeUndefined();
      expect(before?.leadDays).toBeGreaterThan(task.leadDays);
    }
  });

  it('books every vendor through a task that applies whenever the vendor does', () => {
    const vendors = profile.vendors.map((vendor) => vendor.id);
    expect(new Set(vendors).size).toBe(vendors.length);
    for (const vendor of profile.vendors) {
      expect(VENDOR_IDS).toContain(vendor.id);
      expect(CATEGORY_IDS[profile.type]).toContain(vendor.category);
      const task = profile.tasks.find((candidate) => candidate.id === vendor.taskId);
      expect(task?.vendorId).toBe(vendor.id);
      expect<Applicability | undefined>(task?.appliesWhen).toEqual(vendor.appliesWhen);
      expect(vendor.questions.length).toBeGreaterThan(1);
      expect(vendor.depositShare).toBeGreaterThan(0);
      expect(vendor.depositShare).toBeLessThanOrEqual(0.3);
    }
  });

  it('has the venue booked by the shared book-venue task', () => {
    expect(profile.tasks.find((task) => task.id === 'book-venue')?.vendorId).toBe('venue');
  });

  it('is deeply frozen', () => {
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.tasks)).toBe(true);
    expect(Object.isFrozen(profile.styles[0]?.runSheet[0])).toBe(true);
  });

  it('loads the same profile on demand', async () => {
    await expect(loadProfile(profile.type)).resolves.toBe(profile);
  });
});

describe('wedding functions', () => {
  it('defines every function with the design guest shares', () => {
    const wedding = getProfile('wedding');
    expect(wedding.functions.map((def) => [def.id, def.guestShare])).toEqual([
      ['haldi', 0.4],
      ['mehndi', 0.6],
      ['sangeet', 0.8],
      ['ceremony', 1],
      ['reception', 1],
    ]);
    expect(wedding.functions.map((def) => def.id)).toEqual(WEDDING_FUNCTIONS);
    const ceremony = wedding.functions.find((def) => def.id === 'ceremony');
    expect(ceremony?.runSheet).toEqual([]);
  });

  it('is empty for other types', () => {
    expect(getProfile('birthday').functions).toEqual([]);
    expect(getProfile('community').functions).toEqual([]);
  });
});

describe('community run sheets', () => {
  it('start set-up three hours before and end with clean-up', () => {
    for (const style of getProfile('community').styles) {
      expect(style.runSheet[0]?.offsetMin).toBe(-180);
      expect(style.runSheet.at(-1)?.title).toMatch(/^Clean-up/);
    }
  });
});

describe('helpers', () => {
  it('slot builds plain data', () => {
    expect(slot(-30, 15, 'Check', 'Host')).toEqual({
      offsetMin: -30,
      durationMin: 15,
      title: 'Check',
      owner: 'Host',
    });
  });

  it('deepFreeze freezes nested values and leaves primitives alone', () => {
    const value = deepFreeze({ list: [{ id: 1 }] });
    expect(Object.isFrozen(value.list[0])).toBe(true);
    expect(deepFreeze(3)).toBe(3);
    expect(deepFreeze(null)).toBeNull();
  });
});
