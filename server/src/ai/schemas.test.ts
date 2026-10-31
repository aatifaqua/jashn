import {
  CONSTRAINTS,
  SAMPLE_IDS,
  buildPlan,
  getProfile,
  ideasOffline,
  sampleEvent,
  type Constraint,
} from '@jashn/core';
import { describe, expect, it } from 'vitest';
import { TODAY } from '../testing.ts';
import { ideasSchema } from './schemas.ts';

/** Every subset of the declared needs: 2^8 combinations, cheap to check. */
function everyNeedSet(): Constraint[][] {
  return Array.from({ length: 2 ** CONSTRAINTS.length }, (_, mask) =>
    CONSTRAINTS.filter((_, bit) => (mask & (1 << bit)) !== 0),
  );
}

describe('ideasSchema', () => {
  it('accepts the offline ideas for every sample and every combination of needs', () => {
    for (const id of SAMPLE_IDS) {
      const sample = sampleEvent(id, TODAY);
      const { budget } = buildPlan(sample, TODAY, getProfile(sample.type));
      for (const constraints of everyNeedSet()) {
        const input = { ...sample, constraints };
        expect(() => ideasSchema.parse(ideasOffline(input, budget))).not.toThrow();
      }
    }
  });
});
