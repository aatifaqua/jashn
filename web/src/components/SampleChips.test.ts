import { fireEvent, render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import SampleChips from './SampleChips.svelte';

describe('SampleChips', () => {
  it('offers the three samples and reports the pick', async () => {
    const onpick = vi.fn();
    const { container } = render(SampleChips, { props: { onpick } });
    expect(screen.getAllByRole('button')).toHaveLength(3);
    await fireEvent.click(screen.getByRole('button', { name: 'Diwali mela' }));
    expect(onpick).toHaveBeenCalledWith('diwali-mela');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('can be disabled while a plan is being made', () => {
    render(SampleChips, { props: { onpick: vi.fn(), disabled: true } });
    expect(screen.getByRole('button', { name: '7th birthday' })).toBeDisabled();
  });
});
