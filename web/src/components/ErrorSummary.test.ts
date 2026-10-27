import { fireEvent, render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import ErrorSummary from './ErrorSummary.svelte';

describe('ErrorSummary', () => {
  it('lists errors as links that focus their field without touching the URL', async () => {
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.name = 'city';
    input.setAttribute('aria-label', 'City');
    form.append(input);
    document.body.append(form);
    const { container } = render(ErrorSummary, {
      target: form,
      props: {
        errors: [
          { field: 'city', code: 'invalid', message: 'Use letters only.' },
          { field: 'patch', code: 'invalid', message: 'The proposed change is not valid.' },
        ],
      },
    });
    expect(screen.getByRole('heading', { name: /fix these/ })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'City: Use letters only.' });
    expect(screen.getByText('The proposed change is not valid.')).toBeInTheDocument();
    const before = location.hash;
    await fireEvent.click(link);
    expect(document.activeElement).toBe(input);
    expect(location.hash).toBe(before);
    expect(await axe(container)).toHaveNoViolations();
    form.remove();
  });

  it('renders nothing when there are no errors', () => {
    const { container } = render(ErrorSummary, { props: { errors: [] } });
    expect(container.querySelector('.error-summary')).toBeNull();
  });

  it('uses the singular heading for one error', () => {
    render(ErrorSummary, {
      props: { errors: [{ field: 'date', code: 'past', message: 'Date cannot be in the past.' }] },
    });
    expect(screen.getByRole('heading', { name: /fix this/ })).toBeInTheDocument();
    // A named group, so the heading is announced as the summary's name when focus lands on it.
    expect(screen.getByRole('group', { name: /fix this before planning/ })).toBeInTheDocument();
  });
});
