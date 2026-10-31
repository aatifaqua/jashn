import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import Icon, { ICON_NAMES } from './Icon.svelte';

describe('Icon', () => {
  it('references its sprite symbol and is hidden from assistive tech', async () => {
    const { container } = render(Icon, { props: { name: 'print' } });
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('use')?.getAttribute('href')).toBe('#i-print');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has a symbol in the index.html sprite for every icon name', () => {
    const html = readFileSync(join(import.meta.dirname, '../../index.html'), 'utf8');
    const ids = [...html.matchAll(/<symbol id="i-([a-z]+)"/g)].map((match) => match[1]);
    expect(ids).toEqual([...ICON_NAMES]);
  });
});
