import { decodeShare } from '@jashn/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TODAY, planFor } from '../test-fixtures.ts';
import ShareBar from './ShareBar.svelte';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ShareBar', () => {
  const plan = planFor();
  const page = { origin: 'https://jashn.example', pathname: '/jashn/' };

  it('prints, copies the checklist and copies a share link', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const print = vi.fn();
    const { container } = render(ShareBar, {
      props: { plan, checks: new Set<string>(), page, print },
    });
    expect(screen.getByRole('group', { name: 'Take the plan with you' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledOnce();

    await fireEvent.click(screen.getByRole('button', { name: 'Copy checklist' }));
    await waitFor(() => {
      expect(screen.getByText('Checklist copied.')).toBeInTheDocument();
    });
    expect(writeText.mock.calls[0]?.[0]).toMatch(/^Jashn checklist/);

    await fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    await waitFor(() => {
      expect(screen.getByText(/Link copied/)).toBeInTheDocument();
    });
    const link = new URL(writeText.mock.calls[1]?.[0] ?? '');
    expect(link.pathname).toBe('/jashn/');
    expect(decodeShare(link.hash.replace('#plan=', ''), TODAY)).toEqual(plan.input);
    expect(await axe(container)).toHaveNoViolations();
  });
});
