import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { weekday } from './days.ts';
import type { FiredRule } from './rules.ts';
import { TODAY, sampleInput } from './test-fixtures.ts';
import {
  buildTimeline,
  pinnedIds,
  remainingActions,
  topActions,
  type StageInput,
} from './timeline.ts';
import type { EventContext, Profile, RuleEffects, Task, TaskTemplate } from './types.ts';

const EVENT = TODAY + 100;

function context(eventDay: number): EventContext {
  return {
    today: TODAY,
    eventDay,
    daysToGo: eventDay - TODAY,
    weekday: weekday(eventDay),
    midweek: false,
    month: 2,
    season: { peakWedding: true, monsoon: false, summer: false },
    spanDays: 1,
    expected: 255,
    startMinutes: 18 * 60,
    flags: { outdoor: false, largeCrowd: true, publicGathering: false, shortNotice: false },
  };
}

function profile(tasks: readonly TaskTemplate[]): Profile {
  return {
    type: 'wedding',
    label: 'Wedding',
    styles: [],
    functions: [],
    categories: [],
    turnout: 0.85,
    floors: { metro: 3000, tier2: 2000, town: 1200 },
    minLeadDays: 60,
    tasks,
    vendors: [],
  };
}

function rule(id: string, effects: RuleEffects): FiredRule {
  return { id, reason: { code: id, text: `Because of ${id}.` }, effects };
}

function stage(
  tasks: readonly TaskTemplate[],
  fired: readonly FiredRule[] = [],
  eventDay = EVENT,
): StageInput {
  return { profile: profile(tasks), ctx: context(eventDay), input: sampleInput(), fired };
}

function byId(tasks: readonly Task[], id: string): Task {
  const task = tasks.find((t) => t.id === id);
  if (task === undefined) throw new Error(`missing task ${id}`);
  return task;
}

describe('buildTimeline', () => {
  it('schedules backwards from the event day and assigns phases', () => {
    const tasks = buildTimeline(
      stage([
        { id: 'far', title: 'Far', leadDays: 90 },
        { id: 'weeks', title: 'Weeks', leadDays: 30, vendorId: 'caterer' },
        { id: 'fortnight', title: 'Fortnight', leadDays: 5 },
        { id: 'day', title: 'Day', leadDays: 0 },
        { id: 'thanks', title: 'Thanks', leadDays: -3 },
      ]),
    );
    expect(tasks.map((t) => [t.id, t.due, t.phase, t.status])).toEqual([
      ['far', EVENT - 90, 'months-out', 'upcoming'],
      ['weeks', EVENT - 30, 'weeks-out', 'upcoming'],
      ['fortnight', EVENT - 5, 'final-fortnight', 'upcoming'],
      ['day', EVENT, 'day-of', 'upcoming'],
      ['thanks', EVENT + 3, 'after', 'upcoming'],
    ]);
    expect(byId(tasks, 'weeks').vendorId).toBe('caterer');
    expect(byId(tasks, 'far')).not.toHaveProperty('vendorId');
    expect(byId(tasks, 'far').reasons[0]?.text).toContain('90 days before');
    expect(byId(tasks, 'day').reasons[0]?.text).toContain('on the day');
    expect(byId(tasks, 'thanks').reasons[0]?.text).toContain('3 days after');
  });

  it('marks overdue tasks late and spreads them one working day apart, skipping Sunday', () => {
    expect(weekday(TODAY)).toBe(2);
    const late = [200, 190, 180, 170, 160, 150].map((leadDays, i) => ({
      id: `late-${String(i)}`,
      title: 'Late',
      leadDays,
    }));
    const tasks = buildTimeline(stage(late));
    expect(tasks.map((t) => t.due - TODAY)).toEqual([0, 1, 2, 3, 4, 6]);
    for (const task of tasks) {
      expect(task.status).toBe('late');
      expect(task.phase).toBe('do-now');
      expect(task.reasons.at(-1)?.code).toBe('late');
    }
    expect(byId(tasks, 'late-0').reasons.at(-1)?.text).toContain('100 days ago');
  });

  it('spreads a pinned late task first, so it is due today', () => {
    const late = [
      { id: 'set-budget', title: 'Budget', leadDays: 200 },
      { id: 'book-venue', title: 'Venue', leadDays: 150 },
    ];
    const lock = { id: 'lock-venue', title: 'Lock the venue today', leadDays: 120 };
    const pin = rule('short-notice', { tasks: [lock], pinTasks: ['lock-venue'] });
    const tasks = buildTimeline(stage(late, [pin]));
    expect(byId(tasks, 'lock-venue').due).toBe(TODAY);
    expect(byId(tasks, 'set-budget').due).toBe(TODAY + 1);
    expect(byId(tasks, 'book-venue').due).toBe(TODAY + 2);
  });

  it('keeps dependencies in order and moves dependents after their prerequisite', () => {
    const tasks = buildTimeline(
      stage([
        { id: 'invites', title: 'Send invites', leadDays: 150, after: 'venue' },
        { id: 'venue', title: 'Book venue', leadDays: 120 },
        { id: 'ghost', title: 'Depends on nothing real', leadDays: 50, after: 'missing' },
      ]),
    );
    const venue = byId(tasks, 'venue');
    const invites = byId(tasks, 'invites');
    expect(venue.due).toBe(TODAY);
    expect(invites.due).toBeGreaterThan(venue.due);
    expect(byId(tasks, 'ghost').due).toBe(EVENT - 50);
  });

  it('breaks dependency cycles without dropping tasks', () => {
    const tasks = buildTimeline(
      stage([
        { id: 'a', title: 'A', leadDays: 40, after: 'b' },
        { id: 'b', title: 'B', leadDays: 30, after: 'a' },
      ]),
    );
    expect(tasks.map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('flags tasks pushed past their last workable day as at-risk and clamps to the event', () => {
    const tasks = buildTimeline(
      stage([
        { id: 'a', title: 'A', leadDays: 1 },
        { id: 'b', title: 'B', leadDays: 1, after: 'a', minLead: 1 },
        { id: 'c', title: 'C', leadDays: 0, after: 'b' },
        { id: 'd', title: 'D', leadDays: 0, after: 'c' },
      ]),
    );
    expect(byId(tasks, 'a').status).toBe('upcoming');
    expect(byId(tasks, 'b')).toMatchObject({ status: 'at-risk', due: EVENT });
    expect(byId(tasks, 'c')).toMatchObject({ status: 'at-risk', due: EVENT, phase: 'day-of' });
    expect(byId(tasks, 'd').due).toBe(EVENT);
    expect(byId(tasks, 'b').reasons.at(-1)?.code).toBe('at-risk');
  });

  it('flags a late task spread past its last workable day as at-risk with both reasons', () => {
    const late = [100, 99, 98].map((leadDays, i) => ({
      id: `late-${String(i)}`,
      title: 'Late',
      leadDays,
      minLead: 3,
    }));
    const tasks = buildTimeline(stage(late, [], TODAY + 4));
    expect(tasks.map((t) => [t.id, t.due - TODAY, t.status, t.phase])).toEqual([
      ['late-0', 0, 'late', 'do-now'],
      ['late-1', 1, 'late', 'do-now'],
      ['late-2', 2, 'at-risk', 'do-now'],
    ]);
    expect(
      byId(tasks, 'late-2')
        .reasons.slice(-2)
        .map((r) => r.code),
    ).toEqual(['late', 'at-risk']);
  });

  it('words single days in the singular', () => {
    const tasks = buildTimeline(
      stage(
        [
          { id: 'kit', title: 'Kit', leadDays: 1 },
          { id: 'settle', title: 'Settle', leadDays: -1 },
          { id: 'missed', title: 'Missed', leadDays: 101 },
        ],
        [],
        TODAY + 100,
      ),
    );
    expect(byId(tasks, 'kit').reasons[0]?.text).toBe('Usually done 1 day before the event.');
    expect(byId(tasks, 'settle').reasons[0]?.text).toBe('Done within 1 day after the event.');
    expect(byId(tasks, 'missed').reasons.at(-1)?.text).toMatch(/, 1 day ago\.$/);
  });

  it('stretches booking lead times by rule factors with the rule as the reason', () => {
    const peak = rule('peak-season', { leadFactor: { vendorIds: ['venue'], factor: 1.25 } });
    const double = rule('double', { leadFactor: { vendorIds: ['venue'], factor: 2 } });
    const tasks = buildTimeline(
      stage(
        [
          { id: 'venue', title: 'Book venue', leadDays: 40, vendorId: 'venue' },
          { id: 'settle', title: 'Settle venue', leadDays: -2, vendorId: 'venue' },
          { id: 'cake', title: 'Order cake', leadDays: 40, vendorId: 'baker' },
        ],
        [peak, double, rule('noop', {})],
      ),
    );
    expect(byId(tasks, 'venue').idealDue).toBe(EVENT - 100);
    expect(byId(tasks, 'venue').reasons.map((r) => r.code)).toEqual([
      'lead-time',
      'peak-season',
      'double',
    ]);
    expect(byId(tasks, 'settle').idealDue).toBe(EVENT + 2);
    expect(byId(tasks, 'cake').idealDue).toBe(EVENT - 40);
  });

  it('adds applicable rule tasks with their reason and never duplicates an id', () => {
    const tasks = buildTimeline(
      stage(
        [
          { id: 'base', title: 'Base', leadDays: 20 },
          { id: 'base', title: 'Duplicate base', leadDays: 2 },
          {
            id: 'outdoor-only',
            title: 'Tent',
            leadDays: 20,
            appliesWhen: { settings: ['outdoor'] },
          },
        ],
        [
          rule('extra', {
            tasks: [
              { id: 'base', title: 'Base again', leadDays: 5 },
              { id: 'ramp', title: 'Check ramp', leadDays: 10 },
              { id: 'skip', title: 'Skip', leadDays: 10, appliesWhen: { styles: ['intimate'] } },
            ],
          }),
          rule('empty', { tasks: [] }),
        ],
      ),
    );
    expect(tasks.map((t) => t.id)).toEqual(['base', 'ramp']);
    expect(byId(tasks, 'base').reasons.map((r) => r.code)).toEqual(['lead-time', 'extra']);
    expect(byId(tasks, 'ramp').reasons.map((r) => r.code)).toEqual(['lead-time', 'extra']);
  });

  it('marks completed tasks done without blocking their dependents', () => {
    const tasks = buildTimeline(
      stage(
        [
          { id: 'venue', title: 'Book venue', leadDays: 150, vendorId: 'venue' },
          { id: 'decor', title: 'Plan decor', leadDays: 100, after: 'venue' },
        ],
        [rule('venue-booked', { completeTasks: ['venue'] })],
      ),
    );
    const venue = byId(tasks, 'venue');
    expect(venue.status).toBe('done');
    expect(venue.phase).not.toBe('do-now');
    expect(venue.reasons.at(-1)?.code).toBe('venue-booked');
    expect(byId(tasks, 'decor')).toMatchObject({ due: TODAY, status: 'upcoming' });
  });

  it('never drops tasks, keeps them within today and the event, and respects dependencies', () => {
    const template = fc.record({
      leadDays: fc.integer({ min: -10, max: 400 }),
      minLead: fc.option(fc.integer({ min: 0, max: 30 }), { nil: undefined }),
      after: fc.option(fc.integer({ min: 0, max: 11 }), { nil: undefined }),
    });
    fc.assert(
      fc.property(
        fc.array(template, { maxLength: 12 }),
        fc.integer({ min: 0, max: 400 }),
        (raw, gap) => {
          const templates: TaskTemplate[] = raw.map(({ leadDays, minLead, after }, i) => ({
            id: `t${String(i)}`,
            title: 'Task',
            leadDays,
            ...(minLead === undefined ? {} : { minLead }),
            ...(after === undefined ? {} : { after: `t${String(after)}` }),
          }));
          const eventDay = TODAY + gap;
          const tasks = buildTimeline(stage(templates, [], eventDay));
          expect(tasks).toHaveLength(templates.length);
          const byTaskId = new Map(tasks.map((t) => [t.id, t]));
          const afterOf = new Map(templates.map((t) => [t.id, t.after]));
          const inCycle = (id: string): boolean => {
            let current = afterOf.get(id);
            for (let steps = 0; current !== undefined && steps <= templates.length; steps += 1) {
              if (current === id) return true;
              current = afterOf.get(current);
            }
            return false;
          };
          for (const task of tasks) {
            expect(task.due).toBeGreaterThanOrEqual(TODAY);
            if (task.phase !== 'after') expect(task.due).toBeLessThanOrEqual(eventDay);
            const after = afterOf.get(task.id);
            const before = after === undefined ? undefined : byTaskId.get(after);
            if (before === undefined || inCycle(task.id)) continue;
            if (before.phase === 'after' && task.phase !== 'after') continue;
            expect(task.due).toBeGreaterThanOrEqual(before.due);
          }
        },
      ),
    );
  });
});

describe('topActions', () => {
  const tasks = buildTimeline(
    stage(
      [
        { id: 'late', title: 'Late', leadDays: 150 },
        { id: 'soon', title: 'Soon', leadDays: 60 },
        { id: 'later', title: 'Later', leadDays: 30 },
        { id: 'last', title: 'Last', leadDays: 10 },
        { id: 'risky', title: 'Risky', leadDays: 5, after: 'last', minLead: 9 },
        { id: 'done', title: 'Done', leadDays: 50 },
      ],
      [rule('booked', { completeTasks: ['done'] })],
    ),
  );

  it('orders late, at-risk, then upcoming and stops at three', () => {
    expect(topActions(tasks, []).map((t) => t.id)).toEqual(['late', 'risky', 'soon']);
  });

  it('puts pinned tasks first, skipping unknown and done ids', () => {
    const pin = rule('short-notice', { pinTasks: ['later', 'missing', 'done', 'late'] });
    const pinned = pinnedIds([pin, rule('noop', {})]);
    expect(topActions(tasks, pinned).map((t) => t.id)).toEqual(['later', 'late', 'risky']);
  });
});

describe('remainingActions', () => {
  const tasks = buildTimeline(
    stage([
      { id: 'late', title: 'Late', leadDays: 150 },
      { id: 'soon', title: 'Soon', leadDays: 60 },
      { id: 'later', title: 'Later', leadDays: 30 },
      { id: 'last', title: 'Last', leadDays: 10 },
    ]),
  );
  const plan = { tasks, topActions: topActions(tasks, []) };

  it('drops ticked tasks and moves the next ones up, keeping the plan order', () => {
    expect(plan.topActions.map((t) => t.id)).toEqual(['late', 'soon', 'later']);
    expect(remainingActions(plan, new Set()).map((t) => t.id)).toEqual(['late', 'soon', 'later']);
    const ticked = new Set(['late']);
    expect(remainingActions(plan, ticked).map((t) => t.id)).toEqual(['soon', 'later', 'last']);
  });
});
