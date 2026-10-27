import { render } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import Icon from './Icon.svelte';

describe('Icon', () => {
  it('references its sprite symbol and is hidden from assistive tech', async () => {
    const { container } = render(Icon, { props: { name: 'calendar' } });
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('use')?.getAttribute('href')).toBe('#i-calendar');
    expect(await axe(container)).toHaveNoViolations();
  });
});
