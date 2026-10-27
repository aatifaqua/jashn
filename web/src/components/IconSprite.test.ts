import { render } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES } from '../lib/icons.ts';
import IconSprite from './IconSprite.svelte';

describe('IconSprite', () => {
  it('defines a symbol for every icon name', async () => {
    const { container } = render(IconSprite);
    for (const name of ICON_NAMES) {
      expect(container.querySelector(`symbol#i-${name}`)).not.toBeNull();
    }
    expect(container.querySelectorAll('symbol')).toHaveLength(ICON_NAMES.length);
    expect(await axe(container)).toHaveNoViolations();
  });
});
