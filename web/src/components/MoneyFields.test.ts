import { getProfile } from '@jashn/core/server';
import { render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { blankForm } from '../lib/form.ts';
import MoneyFields from './MoneyFields.svelte';

describe('MoneyFields', () => {
  it('offers budget, priorities, needs and note', async () => {
    const { container } = render(MoneyFields, {
      props: { form: blankForm(), profile: getProfile('wedding'), errors: {} },
    });
    expect(screen.getByLabelText('Total budget (₹)')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Catering' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Jain food' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Anything else/)).toHaveAttribute('maxlength', '300');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('disables further priorities once two are chosen', () => {
    const form = { ...blankForm(), priorities: ['catering', 'decor'] };
    render(MoneyFields, { props: { form, profile: getProfile('wedding'), errors: {} } });
    expect(screen.getByRole('checkbox', { name: 'Catering' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Venue' })).toBeDisabled();
  });

  it('hides priorities until the matching profile is loaded', () => {
    render(MoneyFields, {
      props: { form: blankForm(), profile: getProfile('birthday'), errors: {} },
    });
    expect(screen.queryByRole('group', { name: /Priorities/ })).toBeNull();
  });

  it('falls back to a blank form when none is bound', () => {
    render(MoneyFields, { props: { profile: null, errors: {} } });
    expect(screen.getByRole('group', { name: /Money and needs/ })).toBeInTheDocument();
  });
});
