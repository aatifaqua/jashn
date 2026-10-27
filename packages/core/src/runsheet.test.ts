import { describe, expect, it } from 'vitest';
import { buildRunSheet } from './runsheet.ts';
import { TODAY, sampleInput } from './test-fixtures.ts';
import type { FiredRule } from './rules.ts';
import type { StageInput } from './timeline.ts';
import type {
  EventContext,
  EventInput,
  FunctionDef,
  FunctionId,
  Profile,
  RunSheetSlot,
  SlotTemplate,
} from './types.ts';

const EVENT = TODAY + 100;

function context(startMinutes: number): EventContext {
  return {
    today: TODAY,
    eventDay: EVENT,
    daysToGo: 100,
    weekday: 6,
    midweek: false,
    month: 2,
    season: { peakWedding: true, monsoon: false, summer: false },
    spanDays: 1,
    expected: 100,
    startMinutes,
    flags: { outdoor: false, largeCrowd: false, publicGathering: false, shortNotice: false },
  };
}

function slot(title: string, offsetMin: number, durationMin: number): SlotTemplate {
  return { offsetMin, durationMin, title, owner: 'Host' };
}

function fn(id: FunctionId, runSheet: readonly SlotTemplate[], anchorMin = 18 * 60): FunctionDef {
  return { id, label: id, guestShare: 1, anchorMin, runSheet };
}

function profile(type: Profile['type'], extra: Partial<Profile>): Profile {
  return {
    type,
    label: type,
    styles: [],
    functions: [],
    categories: [],
    turnout: 1,
    floors: { metro: 150, tier2: 100, town: 60 },
    minLeadDays: 14,
    tasks: [],
    vendors: [],
    ...extra,
  };
}

function rule(slots?: readonly SlotTemplate[]): FiredRule {
  return {
    id: 'r',
    reason: { code: 'r', text: 'r' },
    effects: slots === undefined ? {} : { slots },
  };
}

interface Setup {
  readonly profile: Profile;
  readonly input: EventInput;
  readonly start: number;
  readonly fired?: readonly FiredRule[];
}

function run({ profile: p, input, start, fired = [] }: Setup): RunSheetSlot[] {
  const stage: StageInput = { profile: p, ctx: context(start), input, fired };
  return buildRunSheet(stage);
}

const brief = (slots: readonly RunSheetSlot[]): string[] =>
  slots.map((s) => `${String(s.day - EVENT)} ${s.start}-${s.end} ${s.title}`);

describe('buildRunSheet', () => {
  it('anchors the style template and rule slots to the start time in time order', () => {
    const birthday = profile('birthday', {
      styles: [
        {
          id: 'kids',
          label: 'Kids',
          startTime: '16:00',
          walkIn: 1,
          deltas: [],
          runSheet: [slot('Cake', 60, 30), slot('Games', 0, 60)],
        },
      ],
    });
    const input = sampleInput({ type: 'birthday', style: 'kids', functions: [] });
    const slots = run({
      profile: birthday,
      input,
      start: 16 * 60,
      fired: [rule([slot('Water', -30, 15)]), rule()],
    });
    expect(brief(slots)).toEqual([
      '0 15:30-15:45 Water',
      '0 16:00-17:00 Games',
      '0 17:00-17:30 Cake',
    ]);
    expect(slots[0]?.owner).toBe('Host');
    const unknownStyle = run({
      profile: birthday,
      input: { ...input, style: 'adult' },
      start: 960,
    });
    expect(unknownStyle).toEqual([]);
  });

  it('uses the style template as the whole frame of a community event', () => {
    const community = profile('community', {
      styles: [
        {
          id: 'festival',
          label: 'Festival',
          startTime: '10:00',
          walkIn: 1.5,
          deltas: [],
          runSheet: [slot('Set-up', -180, 120), slot('Opening', 0, 30), slot('Clean-up', 300, 90)],
        },
      ],
    });
    const input = sampleInput({ type: 'community', style: 'festival', functions: [] });
    expect(brief(run({ profile: community, input, start: 600 }))).toEqual([
      '0 07:00-09:00 Set-up',
      '0 10:00-10:30 Opening',
      '0 15:00-16:30 Clean-up',
    ]);
  });

  const style = (id: 'traditional' | 'intimate', runSheet: readonly SlotTemplate[]) => ({
    id,
    label: id,
    startTime: '18:00',
    walkIn: 1,
    deltas: [],
    runSheet,
  });
  const wedding = profile('wedding', {
    styles: [
      style('traditional', [slot('Baraat', -60, 60)]),
      style('intimate', [slot('Rituals', 0, 90)]),
    ],
    functions: [
      fn('reception', [slot('Stage check', -60, 60), slot('Reception dinner', 0, 120)]),
      fn('ceremony', [slot('Pheras', 0, 120)]),
      fn('haldi', [slot('Haldi', -60, 120)], 11 * 60),
      fn('mehndi', [slot('Mehndi', -120, 180)]),
    ],
  });

  it('puts earlier functions on consecutive days at their own customary hours', () => {
    const input = sampleInput({
      functions: ['ceremony', 'haldi', 'mehndi', 'sangeet', 'reception'],
    });
    const expected = [
      '-3 10:00-12:00 Haldi',
      '-2 16:00-19:00 Mehndi',
      '1 17:00-18:00 Stage check',
      '1 18:00-20:00 Reception dinner',
    ];
    for (const start of [7 * 60, 16 * 60, 21 * 60]) {
      const slots = brief(run({ profile: wedding, input, start }));
      expect(slots.filter((line) => !line.startsWith('0 '))).toEqual(expected);
    }
  });

  it('holds an early intimate reception that evening, after the main day ends', () => {
    const input = sampleInput({
      style: 'intimate',
      startTime: '11:00',
      functions: ['ceremony', 'reception'],
    });
    expect(brief(run({ profile: wedding, input, start: 11 * 60 }))).toEqual([
      '0 11:00-13:00 Pheras',
      '0 11:00-12:30 Rituals',
      '0 17:00-18:00 Stage check',
      '0 18:00-20:00 Reception dinner',
    ]);
    const plain = profile('wedding', {
      styles: wedding.styles,
      functions: [fn('reception', [slot('Dinner', 30, 60)], 12 * 60)],
    });
    expect(brief(run({ profile: plain, input, start: 11 * 60 }))).toEqual([
      '0 11:00-12:30 Rituals',
      '0 13:00-14:00 Dinner',
    ]);
  });

  it('moves a late intimate reception to the next evening instead of past midnight', () => {
    const input = sampleInput({
      style: 'intimate',
      startTime: '21:00',
      functions: ['ceremony', 'reception'],
    });
    expect(brief(run({ profile: wedding, input, start: 21 * 60 }))).toEqual([
      '0 21:00-23:00 Pheras',
      '0 21:00-22:30 Rituals',
      '1 17:00-18:00 Stage check',
      '1 18:00-20:00 Reception dinner',
    ]);
  });

  it('places slots that cross midnight on the day they start', () => {
    const input = sampleInput({ functions: ['ceremony'] });
    const slots = run({ profile: wedding, input, start: 23 * 60 + 30 });
    expect(brief(slots)).toEqual(['0 22:30-23:30 Baraat', '0 23:30-01:30 Pheras']);
  });

  it('skips the ceremony block when it is not chosen', () => {
    const input = sampleInput({ functions: ['mehndi'] });
    expect(brief(run({ profile: wedding, input, start: 10 * 60 }))).toEqual([
      '-1 16:00-19:00 Mehndi',
      '0 09:00-10:00 Baraat',
    ]);
  });
});
