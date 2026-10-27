import { ideasOffline } from '@jashn/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import type { SavedIdeas } from '../lib/storage.ts';
import { fakeGenAi, planFor, sampleInput } from '../test-fixtures.ts';
import IdeasPanel from './IdeasPanel.svelte';

describe('IdeasPanel', () => {
  const plan = planFor({ ...sampleInput(), language: 'hi' });

  it('generates ideas and hands them up with their source and language', async () => {
    const onideas = vi.fn();
    const genai = fakeGenAi();
    const { container } = render(IdeasPanel, {
      props: { plan, saved: null, genai, onideas, onlanguage: vi.fn() },
    });
    expect(screen.getByText(/Ideas for a theme/)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Generate ideas' }));
    await waitFor(() => {
      expect(onideas).toHaveBeenCalledOnce();
    });
    const saved = onideas.mock.calls[0]?.[0] as SavedIdeas;
    expect(saved.source).toBe('gemini');
    expect(saved.language).toBe('hi');
    expect(saved.ideas).toEqual(ideasOffline(plan.input));
    expect(onideas.mock.calls[0]?.[1]).toBe(plan.input);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows saved ideas with lang="hi" on Gemini Hindi text only', async () => {
    const ideas = ideasOffline(plan.input);
    const saved: SavedIdeas = { ideas, source: 'gemini', language: 'hi' };
    const { container, rerender } = render(IdeasPanel, {
      props: { plan, saved, genai: fakeGenAi(), onideas: vi.fn(), onlanguage: vi.fn() },
    });
    expect(screen.getByRole('button', { name: 'Regenerate ideas' })).toBeInTheDocument();
    expect(screen.getByText(ideas.invitation)).toHaveAttribute('lang', 'hi');
    expect(screen.getByRole('heading', { name: 'Decor' })).not.toHaveAttribute('lang');
    expect(screen.getByText('Written by Gemini')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await rerender({ saved: { ...saved, source: 'fallback' } });
    expect(screen.getByText(ideas.invitation)).toHaveAttribute('lang', 'en');
  });

  it('switches the language for the next generation', async () => {
    const onlanguage = vi.fn();
    render(IdeasPanel, {
      props: { plan, saved: null, genai: fakeGenAi(), onideas: vi.fn(), onlanguage },
    });
    const select = screen.getByLabelText('Language');
    expect(select).toHaveValue('hi');
    await fireEvent.change(select, { target: { value: 'en' } });
    expect(onlanguage).toHaveBeenCalledWith('en');
    const option = document.createElement('option');
    option.value = 'fr';
    select.append(option);
    await fireEvent.change(select, { target: { value: 'fr' } });
    expect(onlanguage).toHaveBeenCalledTimes(1);
  });
});
