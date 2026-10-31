import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import ConfirmButton from './ConfirmButton.svelte';

function setup() {
  const onconfirm = vi.fn();
  const view = render(ConfirmButton, {
    props: {
      label: 'Delete',
      name: 'Delete the Pune party',
      question: 'Start a new plan?',
      confirmLabel: 'Yes, delete',
      onconfirm,
    },
  });
  return { ...view, onconfirm };
}

describe('ConfirmButton', () => {
  it('asks first, focuses the confirm button, then acts', async () => {
    const { container, onconfirm } = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Delete the Pune party' }));
    expect(onconfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Start a new plan?' })).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Yes, delete' });
    expect(document.activeElement).toBe(confirm);
    expect(await axe(container)).toHaveNoViolations();
    await fireEvent.click(confirm);
    expect(onconfirm).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Delete the Pune party' })).toBeInTheDocument();
  });

  it('backs out on Cancel', async () => {
    const { onconfirm } = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Delete the Pune party' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onconfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('group')).toBeNull();
    // Focus returns to the button that asked, not to the page.
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Delete the Pune party' }),
      );
    });
  });
});
