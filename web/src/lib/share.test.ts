import { encodeShare } from '@jashn/core';
import { describe, expect, it, vi } from 'vitest';
import { TODAY, sampleInput } from '../test-fixtures.ts';
import { clearFragment, readFragment, shareLink } from './share.ts';

describe('share links', () => {
  const input = sampleInput('diwali-mela');

  it('builds a link whose fragment decodes back to the same event', () => {
    const link = shareLink(input, { origin: 'https://jashn.example', pathname: '/jashn/' });
    expect(link.startsWith('https://jashn.example/jashn/#plan=')).toBe(true);
    expect(readFragment(new URL(link).hash, TODAY)).toEqual({ kind: 'event', input });
  });

  it('distinguishes no fragment from a bad one', () => {
    expect(readFragment('', TODAY)).toEqual({ kind: 'none' });
    expect(readFragment('#', TODAY)).toEqual({ kind: 'none' });
    expect(readFragment('#main', TODAY)).toEqual({ kind: 'none' });
    expect(readFragment('#plan=not-a-plan', TODAY)).toEqual({ kind: 'invalid' });
    expect(readFragment(`#plan=${encodeShare(input)}`, TODAY + 400)).toEqual({ kind: 'invalid' });
  });

  it('clears the fragment while keeping path and query', () => {
    const replaceState = vi.fn();
    const history = { state: { keep: true }, replaceState } as unknown as History;
    clearFragment({ pathname: '/jashn/', search: '?x=1' }, history);
    expect(replaceState).toHaveBeenCalledWith({ keep: true }, '', '/jashn/?x=1');
  });
});
