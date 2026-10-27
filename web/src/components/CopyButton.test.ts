import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CopyButton from './CopyButton.svelte';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CopyButton', () => {
  it('copies lazily built text and confirms in a status message', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const text = vi.fn(() => 'checklist');
    const { container } = render(CopyButton, {
      props: { text, label: 'Copy checklist', done: 'Checklist copied.' },
    });
    expect(text).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Copy checklist' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Checklist copied.');
    });
    expect(writeText).toHaveBeenCalledWith('checklist');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says when copying is blocked', async () => {
    vi.stubGlobal('navigator', {});
    render(CopyButton, { props: { text: () => 'x', label: 'Copy', done: 'Done.', icon: 'link' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/blocked/);
    });
  });
});
