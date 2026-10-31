import { getProfile } from '@jashn/core/server';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { blankForm } from '../lib/form.ts';
import { TODAY } from '../test-fixtures.ts';
import EventFields from './EventFields.svelte';

function setup(errors = {}) {
  const onType = vi.fn();
  const onStyle = vi.fn();
  const view = render(EventFields, {
    props: {
      form: blankForm(),
      profile: getProfile('wedding'),
      errors,
      today: TODAY,
      onType,
      onStyle,
    },
  });
  return { ...view, onType, onStyle };
}

describe('EventFields', () => {
  it('offers types, styles, functions, date and time with visible labels', async () => {
    const { container } = setup();
    expect(screen.getByRole('group', { name: /The event/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Birthday/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Destination' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Wedding ceremony' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Wedding ceremony' })).toBeChecked();
    expect(screen.getByLabelText('Date')).toHaveAttribute('min', '2026-11-02');
    expect(screen.getByLabelText('Start time')).toHaveValue('18:00');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reports type and style choices to the parent', async () => {
    const { onType, onStyle } = setup();
    await fireEvent.click(screen.getByRole('radio', { name: /Community event/ }));
    expect(onType).toHaveBeenCalledWith('community');
    await fireEvent.click(screen.getByRole('radio', { name: 'Intimate' }));
    expect(onStyle).toHaveBeenCalledWith(expect.objectContaining({ id: 'intimate' }));
  });

  it('marks invalid fields and links them to their messages', () => {
    setup({ date: 'Date cannot be in the past.' });
    const date = screen.getByLabelText('Date');
    expect(date).toHaveAttribute('aria-invalid', 'true');
    expect(date).toHaveAccessibleDescription('Date cannot be in the past.');
  });

  it('waits for the profile before offering styles', () => {
    render(EventFields, {
      props: {
        form: blankForm(),
        profile: null,
        errors: {},
        today: TODAY,
        onType: vi.fn(),
        onStyle: vi.fn(),
      },
    });
    expect(screen.getByRole('status')).toHaveTextContent(/Loading the choices/);
    expect(screen.queryByRole('radio', { name: 'Intimate' })).toBeNull();
  });

  it('falls back to a blank form when none is bound', () => {
    render(EventFields, {
      props: { profile: null, errors: {}, today: TODAY, onType: vi.fn(), onStyle: vi.fn() },
    });
    expect(screen.getByRole('group', { name: /The event/ })).toBeInTheDocument();
  });
});
