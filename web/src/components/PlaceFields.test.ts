import { render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { blankForm } from '../lib/form.ts';
import PlaceFields from './PlaceFields.svelte';

describe('PlaceFields', () => {
  it('offers city, size, setting, guests and venue status with hints', async () => {
    const { container } = render(PlaceFields, { props: { form: blankForm(), errors: {} } });
    expect(screen.getByLabelText('City')).toHaveAccessibleDescription(
      'Used only to personalise ideas.',
    );
    expect(screen.getByLabelText('City size')).toHaveValue('metro');
    expect(screen.getByRole('radio', { name: 'Indoor' })).toBeChecked();
    expect(screen.getByLabelText('Guests invited')).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByRole('checkbox', { name: /venue is already booked/ })).not.toBeChecked();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows field errors inline', () => {
    render(PlaceFields, {
      props: { form: blankForm(), errors: { invited: 'Guests invited is required.' } },
    });
    expect(screen.getByLabelText('Guests invited')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Guests invited is required.')).toBeInTheDocument();
  });

  it('falls back to a blank form when none is bound', () => {
    render(PlaceFields, { props: { errors: {} } });
    expect(screen.getByRole('group', { name: /Place and people/ })).toBeInTheDocument();
  });
});
