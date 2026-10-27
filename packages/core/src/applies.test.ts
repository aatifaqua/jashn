import { describe, expect, it } from 'vitest';
import { applies } from './applies.ts';
import { sampleInput } from './test-fixtures.ts';

const wedding = sampleInput({ functions: ['ceremony', 'mehndi'], constraints: ['vegetarian'] });

describe('applies', () => {
  it('matches anything without conditions', () => {
    expect(applies(undefined, wedding)).toBe(true);
    expect(applies({}, wedding)).toBe(true);
  });

  it('checks styles and settings', () => {
    expect(applies({ styles: ['traditional'] }, wedding)).toBe(true);
    expect(applies({ styles: ['intimate'] }, wedding)).toBe(false);
    expect(applies({ settings: ['indoor', 'mixed'] }, wedding)).toBe(true);
    expect(applies({ settings: ['outdoor'] }, wedding)).toBe(false);
  });

  it('needs at least one listed function', () => {
    expect(applies({ functions: ['mehndi', 'haldi'] }, wedding)).toBe(true);
    expect(applies({ functions: ['sangeet'] }, wedding)).toBe(false);
  });

  it('handles required and excluded constraints', () => {
    expect(applies({ anyConstraint: ['vegetarian', 'jain'] }, wedding)).toBe(true);
    expect(applies({ anyConstraint: ['halal'] }, wedding)).toBe(false);
    expect(applies({ noConstraint: ['alcohol-free'] }, wedding)).toBe(true);
    expect(applies({ noConstraint: ['vegetarian'] }, wedding)).toBe(false);
  });

  it('requires every present condition', () => {
    expect(applies({ styles: ['traditional'], settings: ['outdoor'] }, wedding)).toBe(false);
  });
});
