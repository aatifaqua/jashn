import { describe, expect, it } from 'vitest';
import {
  SAFETY_THRESHOLDS,
  attendanceBasisPoints,
  expectedFor,
  expectedHeadcount,
  maxInvitedFor,
  volunteersNeeded,
} from './attendance.ts';
import { getProfile } from './profiles/all.ts';
import { sampleInput } from './test-fixtures.ts';
import type { StyleId } from './types.ts';

const wedding = getProfile('wedding');
const community = getProfile('community');

describe('expectedHeadcount', () => {
  it('applies the wedding turnout and rounds up', () => {
    expect(expectedHeadcount(sampleInput({ invited: 300 }), wedding)).toBe(255);
    expect(expectedHeadcount(sampleInput({ invited: 1 }), wedding)).toBe(1);
  });

  it('stays exact where floating point would drift', () => {
    // 100 × 0.85 is 85.00000000000001 in floating point.
    expect(expectedHeadcount(sampleInput({ invited: 100 }), wedding)).toBe(85);
  });

  it('applies the birthday turnout', () => {
    const input = sampleInput({ type: 'birthday', style: 'kids', functions: [], invited: 25 });
    expect(expectedHeadcount(input, getProfile('birthday'))).toBe(23);
  });

  it('adds the walk-in factor of each community style', () => {
    const base = sampleInput({ type: 'community', functions: [], invited: 1000 });
    const expected = { festival: 1500, fundraiser: 1200, meetup: 1100, 'clean-up': 1000 };
    for (const [style, count] of Object.entries(expected)) {
      expect(expectedHeadcount({ ...base, style: style as StyleId }, community)).toBe(count);
    }
  });

  it('treats an unknown style as having no walk-ins', () => {
    expect(attendanceBasisPoints(community, 'unknown')).toBe(10_000);
  });
});

describe('maxInvitedFor', () => {
  it('inverts expectedFor exactly', () => {
    const basisPoints = attendanceBasisPoints(wedding, 'traditional');
    for (const limit of [1, 85, 254, 255, 1000]) {
      const invited = maxInvitedFor(limit, basisPoints);
      expect(expectedFor(invited, basisPoints)).toBeLessThanOrEqual(limit);
      expect(expectedFor(invited + 1, basisPoints)).toBeGreaterThan(limit);
    }
  });

  it('never goes negative', () => {
    expect(maxInvitedFor(-5, 8500)).toBe(0);
  });
});

describe('volunteersNeeded', () => {
  it('is max(4, expected / 50 rounded up) for community events', () => {
    expect(volunteersNeeded('community', 10)).toBe(4);
    expect(volunteersNeeded('community', 200)).toBe(4);
    expect(volunteersNeeded('community', 201)).toBe(5);
    expect(volunteersNeeded('community', 1500)).toBe(30);
  });

  it('is zero for weddings and birthdays', () => {
    expect(volunteersNeeded('wedding', 500)).toBe(0);
    expect(volunteersNeeded('birthday', 50)).toBe(0);
  });
});

describe('SAFETY_THRESHOLDS', () => {
  it('is frozen and ordered', () => {
    expect(Object.isFrozen(SAFETY_THRESHOLDS)).toBe(true);
    expect(SAFETY_THRESHOLDS.largeCrowd).toBeLessThan(SAFETY_THRESHOLDS.publicGathering);
    expect(SAFETY_THRESHOLDS.publicGathering).toBeLessThan(SAFETY_THRESHOLDS.ambulance);
  });
});
