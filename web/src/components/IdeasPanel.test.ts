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

  it('keeps focus on the busy button and announces only a short status, not the ideas', async () => {
    let release: (() => void) | undefined;
    const base = fakeGenAi();
    const ideas = vi.fn(
      (current: Parameters<typeof base.ideas>[0]) =>
        new Promise<Awaited<ReturnType<typeof base.ideas>>>((resolve) => {
          release = () => void base.ideas(current).then(resolve);
        }),
    );
    const onideas = vi.fn();
    const { rerender } = render(IdeasPanel, {
      props: { plan, saved: null, genai: { ...base, ideas }, onideas, onlanguage: vi.fn() },
    });
    const button = screen.getByRole('button', { name: 'Generate ideas' });
    button.focus();
    await fireEvent.click(button);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(document.activeElement).toBe(button);
    await fireEvent.click(button);
    expect(ideas).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('Thinking up ideas…');
    release?.();
    await waitFor(() => {
      expect(onideas).toHaveBeenCalledOnce();
    });
    await rerender({ saved: onideas.mock.calls[0]?.[0] as SavedIdeas });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Ideas ready below.');
    expect(status.querySelector('h3')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Decor' }).closest('[aria-live]')).toBeNull();
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
