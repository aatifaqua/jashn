import { LANGUAGES, SAMPLE_IDS, ideasOffline, type Language, type SampleId } from '@jashn/core';
import { describe, expect, it } from 'vitest';
import demoFile from './demo-genai.json';
import { TODAY, planFor, sampleInput } from '../test-fixtures.ts';
import { createDemo, matchSample } from './demo.ts';

const wedding = sampleInput('lucknow-wedding');
const ideas = ideasOffline(wedding);

const data = {
  version: 1,
  samples: {
    'lucknow-wedding': {
      en: {
        ideas,
        drafts: { venue: 'Hello, we need a hall.' },
        answers: {
          'What is late?': { reply: 'Book the venue first.' },
          'Cut guests by 20': { reply: 'Fewer guests.', patch: { invited: 330 } },
          'Bad patch': { reply: 'Sure.', patch: { invited: -5 } },
        },
      },
      hi: { ideas: { ...ideas, theme: { ...ideas.theme, name: 'गेंदा और गुलाब' } } },
    },
  },
};

describe('matchSample', () => {
  it('matches a sample in either language and nothing else', () => {
    expect(matchSample(wedding, TODAY)).toBe('lucknow-wedding');
    expect(matchSample({ ...wedding, language: 'hi' }, TODAY)).toBe('lucknow-wedding');
    expect(matchSample(sampleInput('diwali-mela'), TODAY)).toBe('diwali-mela');
    expect(matchSample({ ...wedding, invited: 351 }, TODAY)).toBeNull();
  });
});

describe('createDemo', () => {
  const demo = createDemo(data);
  const plan = planFor(wedding);

  it('serves ideas per language for a matching sample', () => {
    expect(demo.ideas(wedding, TODAY)).toEqual(ideas);
    expect(demo.ideas({ ...wedding, language: 'hi' }, TODAY)?.theme.name).toBe('गेंदा और गुलाब');
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
    expect(createDemo({ ...data, version: 2 }).ideas(wedding, TODAY)).toBeNull();
    expect(createDemo(null).answer(plan, 'What is late?')).toBeNull();
  });

  it('ships only ideas that pass the shape and dietary guards', () => {
    expect(demoFile.version).toBe(1);
    const shipped = demoFile as unknown as {
      samples: Partial<Record<SampleId, Partial<Record<Language, { ideas?: unknown }>>>>;
    };
    const demo = createDemo(demoFile);
    for (const id of SAMPLE_IDS) {
      for (const language of LANGUAGES) {
        if (shipped.samples[id]?.[language]?.ideas === undefined) continue;
        expect(
          demo.ideas({ ...sampleInput(id), language }, TODAY),
          `${id} ${language}`,
        ).not.toBeNull();
      }
    }
  });
});
