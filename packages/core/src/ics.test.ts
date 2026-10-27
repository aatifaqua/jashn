import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EVENT_DAY, samplePlan, task } from './fallback/plan.fixture.ts';
import { escapeText, foldLine, toIcs } from './ics.ts';
import { TODAY } from './test-fixtures.ts';

/** 2026-10-27T09:05:03Z */
const STAMP = Date.UTC(2026, 9, 27, 9, 5, 3);
const ENCODER = new TextEncoder();

function unfold(text: string): string[] {
  return text.replace(/\r\n /g, '').split('\r\n');
}

describe('escapeText', () => {
  it('escapes backslash, semicolon, comma and every newline form', () => {
    expect(escapeText('a\\b;c,d\ne\r\nf\rg')).toBe('a\\\\b\\;c\\,d\\ne\\nf\\ng');
  });
});

describe('foldLine', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:Short')).toBe('SUMMARY:Short');
  });

  it('folds at 75 octets with CRLF and a leading space', () => {
    const folded = foldLine(`SUMMARY:${'x'.repeat(100)}`);
    const lines = folded.split('\r\n');
    expect(lines[0]).toHaveLength(75);
    expect(lines[1]?.startsWith(' ')).toBe(true);
    expect(lines.join('').replace(/ /g, '')).toBe(`SUMMARY:${'x'.repeat(100)}`);
  });

  it('never splits a multi-byte character, including astral ones', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 300 }), (text) => {
        const folded = foldLine(text);
        for (const line of folded.split('\r\n')) {
          expect(ENCODER.encode(line).length).toBeLessThanOrEqual(75);
        }
        expect(folded.replace(/\r\n /g, '')).toBe(text);
      }),
    );
  });

  it('counts octets, not characters', () => {
    const lines = foldLine('é'.repeat(50)).split('\r\n');
    expect(ENCODER.encode(lines[0]).length).toBe(74);
    expect(foldLine('ह'.repeat(30)).split('\r\n')[0]).toHaveLength(25);
  });
});

describe('toIcs', () => {
  const ics = toIcs(samplePlan(), { stampMs: STAMP });
  const lines = unfold(ics);

  it('is a CRLF-terminated VCALENDAR with lines of at most 75 octets', () => {
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    for (const line of ics.split('\r\n')) {
      expect(ENCODER.encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(lines.slice(0, 5)).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Jashn//Event planner//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ]);
  });

  it('spans the event over its run-sheet days, as one busy all-day entry', () => {
    const start = lines.indexOf('BEGIN:VEVENT');
    expect(lines.slice(start, start + 9)).toEqual([
      'BEGIN:VEVENT',
      expect.stringMatching(/^UID:event\.[a-z0-9]+@jashn$/),
      'DTSTAMP:20261027T090503Z',
      'DTSTART;VALUE=DATE:20270219',
      'DTEND;VALUE=DATE:20270221',
      'SUMMARY:Traditional wedding in Lucknow',
      'DESCRIPTION:Starts at 18:00. About 255 guests expected.',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    ]);
  });

  it('exports open tasks as free all-day entries and skips done ones', () => {
    expect(lines.filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(4);
    expect(lines).not.toContain('SUMMARY:Shortlist dates');
    expect(lines).toContain('SUMMARY:Book the venue');
    expect(lines).toContain('DTSTART;VALUE=DATE:20261027');
    expect(lines).toContain('DESCRIPTION:Part of every wedding plan.');
    expect(lines.filter((line) => line === 'TRANSP:TRANSPARENT')).toHaveLength(3);
  });

  it('keeps UIDs stable across date changes and distinct across plan ids', () => {
    const uids = (text: string): string[] => unfold(text).filter((line) => line.startsWith('UID'));
    const moved = toIcs(samplePlan({ daysToGo: 200 }, { date: '2027-05-15' }), { stampMs: 0 });
    expect(uids(moved)).toEqual(uids(ics));
    const other = toIcs(samplePlan(), { stampMs: STAMP, planId: 'plan 7/x' });
    expect(uids(other)[0]).toBe('UID:event.plan-7-x@jashn');
    expect(new Set(uids(ics)).size).toBe(4);
  });

  it('escapes task text and handles a plan without city or run sheet', () => {
    const plan = samplePlan(
      {
        runSheet: [],
        tasks: [task({ id: 'odd id', title: 'Venue; hall, lawn', due: TODAY + 1, reasons: [] })],
      },
      { city: '' },
    );
    const out = unfold(toIcs(plan, { stampMs: STAMP }));
    expect(out).toContain('SUMMARY:Traditional wedding');
    expect(out).toContain('SUMMARY:Venue\\; hall\\, lawn');
    expect(out).toContain('DTSTART;VALUE=DATE:20270220');
    expect(out.some((line) => line.startsWith('UID:task.odd-id.'))).toBe(true);
    expect(EVENT_DAY).toBe(TODAY + samplePlan().daysToGo);
  });
});
