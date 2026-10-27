import { render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import SourceBadge from './SourceBadge.svelte';

describe('SourceBadge', () => {
  it('labels Gemini and offline content in words', async () => {
    const { container, rerender } = render(SourceBadge, { props: { source: 'gemini' } });
    expect(screen.getByText('Written by Gemini')).toBeInTheDocument();
    await rerender({ source: 'fallback' });
    expect(screen.getByText('Offline suggestion')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
