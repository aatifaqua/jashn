import { render } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import FieldError from './FieldError.svelte';

describe('FieldError', () => {
  it('renders the message with an id the field can reference', async () => {
    const { container } = render(FieldError, { props: { field: 'city', message: 'Too long.' } });
    expect(container.querySelector('#city-error')).toHaveTextContent('Too long.');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders nothing without a message', () => {
    const { container } = render(FieldError, { props: { field: 'city', message: undefined } });
    expect(container.querySelector('.field-error')).toBeNull();
  });
});
