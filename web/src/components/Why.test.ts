import { render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import Why from './Why.svelte';

describe('Why', () => {
  it('discloses the reasons in a native details element', async () => {
    const reasons = [
      { code: 'peak-season', text: 'Peak wedding season.' },
      { code: 'peak-season', text: 'Prices run higher.' },
    ];
    const { container } = render(Why, { props: { reasons } });
    expect(screen.getByText('Why?').tagName).toBe('SUMMARY');
    expect(container.querySelector('details')?.open).toBe(false);
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders nothing without reasons', () => {
    const { container } = render(Why, { props: { reasons: [], label: 'Because' } });
    expect(container.querySelector('details')).toBeNull();
  });
});
