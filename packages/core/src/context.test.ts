import { describe, expect, it } from 'vitest';
import { deriveContext, functionDays } from './context.ts';
import { fromIso } from './days.ts';
import { getProfile } from './profiles/index.ts';
import { TODAY, sampleInput } from './test-fixtures.ts';
import type { EventInput } from './types.ts';

function contextOf(overrides: Partial<EventInput> = {}) {
  const input = sampleInput(overrides);
  return deriveContext(input, TODAY, getProfile(input.type));
}

describe('deriveContext', () => {
  it('derives dates, weekday and season for the sample wedding', () => {
    const ctx = contextOf();
    expect(ctx.today).toBe(TODAY);
    expect(ctx.eventDay).toBe(fromIso('2027-02-20'));
    expect(ctx.daysToGo).toBe(116);
    expect(ctx.weekday).toBe(6);
    expect(ctx.midweek).toBe(false);
    expect(ctx.month).toBe(2);
    expect(ctx.season).toEqual({ peakWedding: true, monsoon: false, summer: false });
    expect(ctx.expected).toBe(255);
    expect(ctx.startMinutes).toBe(18 * 60);
    expect(ctx.spanDays).toBe(3);
    expect(ctx.flags).toEqual({
      outdoor: false,
      largeCrowd: true,
      publicGathering: false,
      shortNotice: false,
    });
  });

  it('marks Monday to Thursday as midweek', () => {
    expect(contextOf({ date: '2027-02-15' }).midweek).toBe(true);
    expect(contextOf({ date: '2027-02-18' }).midweek).toBe(true);
    expect(contextOf({ date: '2027-02-19' }).midweek).toBe(false);
    expect(contextOf({ date: '2027-02-21' }).midweek).toBe(false);
  });

  it('covers the season boundaries', () => {
    expect(contextOf({ date: '2026-11-01' }).season.peakWedding).toBe(true);
    expect(contextOf({ date: '2027-03-31' }).season).toEqual({
      peakWedding: false,
      monsoon: false,
      summer: false,
    });
    expect(contextOf({ date: '2027-06-15' }).season).toEqual({
      peakWedding: false,
      monsoon: true,
      summer: true,
    });
    expect(contextOf({ date: '2027-09-30' }).season.monsoon).toBe(true);
    expect(contextOf({ date: '2027-10-01' }).season.monsoon).toBe(false);
    expect(contextOf({ date: '2027-04-01' }).season.summer).toBe(true);
  });

  it('flags outdoor and mixed settings', () => {
    expect(contextOf({ setting: 'outdoor' }).flags.outdoor).toBe(true);
    expect(contextOf({ setting: 'mixed' }).flags.outdoor).toBe(true);
  });

  it('flags short notice below the minimum lead time', () => {
    expect(contextOf({ date: '2027-01-24' }).flags.shortNotice).toBe(true);
    expect(contextOf({ date: '2027-01-25' }).flags.shortNotice).toBe(false);
  });

  it('flags community public gatherings by setting or size', () => {
    const base = { type: 'community', style: 'meetup', functions: [] } as const;
    expect(contextOf({ ...base, invited: 100 }).flags.publicGathering).toBe(false);
    expect(contextOf({ ...base, invited: 100, setting: 'outdoor' }).flags.publicGathering).toBe(
      true,
    );
    expect(contextOf({ ...base, invited: 455 }).flags.publicGathering).toBe(true);
    expect(contextOf({ invited: 1000, setting: 'outdoor' }).flags.publicGathering).toBe(false);
  });

  it('flags large crowds at 200 expected', () => {
    expect(contextOf({ invited: 234 }).flags.largeCrowd).toBe(false);
    expect(contextOf({ invited: 235 }).flags.largeCrowd).toBe(true);
  });

  it('stays total on malformed date and time', () => {
    const ctx = contextOf({ date: 'soon', startTime: 'late' });
    expect(ctx.eventDay).toBe(TODAY);
    expect(ctx.startMinutes).toBe(0);
  });

  it('spans one day for single-day events', () => {
    expect(contextOf({ functions: ['ceremony'] }).spanDays).toBe(1);
    expect(contextOf({ type: 'birthday', style: 'kids', functions: [] }).spanDays).toBe(1);
  });
});

describe('functionDays', () => {
  it('places earlier functions on consecutive days before the ceremony', () => {
    const days = functionDays(
      sampleInput({ functions: ['ceremony', 'haldi', 'mehndi', 'sangeet', 'reception'] }),
    );
    expect(days).toEqual([
      { functionId: 'haldi', offset: -3 },
      { functionId: 'mehndi', offset: -2 },
      { functionId: 'sangeet', offset: -1 },
      { functionId: 'ceremony', offset: 0 },
      { functionId: 'reception', offset: 1 },
    ]);
  });

  it('holds an intimate reception on the ceremony evening only when it starts by 15:00', () => {
    const at = (startTime: string) =>
      functionDays(sampleInput({ style: 'intimate', startTime, functions: ['reception'] }));
    expect(at('11:00')).toEqual([
      { functionId: 'ceremony', offset: 0 },
      { functionId: 'reception', offset: 0 },
    ]);
    expect(at('15:00').at(-1)?.offset).toBe(0);
    expect(at('15:01').at(-1)?.offset).toBe(1);
    expect(at('bad').at(-1)?.offset).toBe(0);
  });

  it('is empty for other event types', () => {
    expect(functionDays(sampleInput({ type: 'birthday', functions: ['mehndi'] }))).toEqual([]);
  });
});
