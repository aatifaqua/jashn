import { afterEach, describe, expect, it, vi } from 'vitest';
import { planFor } from '../test-fixtures.ts';
import { calendarText, downloadCalendar } from './calendar.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('calendar export', () => {
  const plan = planFor();

  it('writes an RFC 5545 calendar with stable UIDs per plan', () => {
    const text = calendarText(plan, 'plan-1', Date.UTC(2026, 10, 2));
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(text).toContain('DTSTAMP:20261102T000000Z');
    expect(calendarText(plan, 'plan-1', 0).match(/UID:.*/g)).toEqual(
      calendarText(plan, 'plan-1', 5).match(/UID:.*/g),
    );
  });

  it('downloads through a temporary object URL and revokes it', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:jashn');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    downloadCalendar(plan, 'plan-1');
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:jashn');
  });
});
