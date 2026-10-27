import { render } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import Logo from './Logo.svelte';

describe('Logo', () => {
  it('draws the decorative Jashn mark', async () => {
    const { container } = render(Logo);
    expect(container.querySelector('svg.logo-mark')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.logo-tick')).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });
});
