import { SAMPLE_IDS, ideasOffline, type SampleId } from '@jashn/core';
import { describe, expect, it } from 'vitest';
import demoFile from './demo-genai.json';
import { TODAY, planFor, sampleInput } from '../test-fixtures.ts';
import { createDemo, matchSample } from './demo.ts';

const wedding = sampleInput('lucknow-wedding');
const ideas = ideasOffline(wedding);

const data = {
  version: 2,
  samples: {
    'lucknow-wedding': {
      ideas,
      drafts: { venue: 'Hello, we need a hall.' },
      answers: {
        'What is late?': { reply: 'Book the venue first.' },
        'Cut guests by 20': { reply: 'Fewer guests.', patch: { invited: 330 } },
        'Bad patch': { reply: 'Sure.', patch: { invited: -5 } },
      },
    },
  },
};

describe('matchSample', () => {
  it('matches a sample and nothing else', () => {
    expect(matchSample(wedding, TODAY)).toBe('lucknow-wedding');
    expect(matchSample(sampleInput('diwali-mela'), TODAY)).toBe('diwali-mela');
    expect(matchSample({ ...wedding, invited: 351 }, TODAY)).toBeNull();
  });
});

describe('createDemo', () => {
  const demo = createDemo(data);
  const plan = planFor(wedding);

  it('serves ideas for a matching sample', () => {
    expect(demo.ideas(wedding, TODAY)).toEqual(ideas);
    expect(demo.ideas({ ...wedding, city: 'Agra' }, TODAY)).toBeNull();
  });

  it('serves drafts and answers, validating patches', () => {
    expect(demo.draft(plan, 'venue')).toEqual({
      vendorId: 'venue',
      text: 'Hello, we need a hall.',
    });
    expect(demo.draft(plan, 'caterer')).toBeNull();
    expect(demo.answer(plan, ' What is late? ')).toEqual({ reply: 'Book the venue first.' });
    expect(demo.answer(plan, 'Cut guests by 20')).toEqual({
      reply: 'Fewer guests.',
      patch: { invited: 330 },
    });
    expect(demo.answer(plan, 'Bad patch')).toBeNull();
    expect(demo.answer(plan, 'constructor')).toBeNull();
  });

  it('ignores data of another version or shape', () => {
    expect(createDemo({ ...data, version: 1 }).ideas(wedding, TODAY)).toBeNull();
    expect(createDemo(null).answer(plan, 'What is late?')).toBeNull();
  });

  it('ships only ideas that pass the shape and dietary guards', () => {
    expect(demoFile.version).toBe(2);
    const shipped = demoFile as unknown as {
      samples: Partial<Record<SampleId, { ideas?: unknown }>>;
    };
    const demo = createDemo(demoFile);
    let served = 0;
    for (const id of SAMPLE_IDS) {
      if (shipped.samples[id]?.ideas === undefined) continue;
      expect(demo.ideas(sampleInput(id), TODAY), id).not.toBeNull();
      served += 1;
    }
    // The file may be partial (the docs say so), but never empty.
    expect(served).toBeGreaterThan(0);
  });
});
