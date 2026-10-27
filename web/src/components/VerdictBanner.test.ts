import { render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import VerdictBanner from './VerdictBanner.svelte';

describe('VerdictBanner', () => {
  it('shows the verdict as an icon and a word, never colour alone', async () => {
    const feasibility = { verdict: 'tight', perGuest: 4027, floor: 3500, trims: [] } as const;
    const { container, rerender } = render(VerdictBanner, { props: { feasibility } });
    expect(screen.getByText('Tight')).toBeInTheDocument();
    expect(container.querySelector('use')?.getAttribute('href')).toBe('#i-alert');
    expect(screen.getByText(/₹4,027 per expected guest/)).toBeInTheDocument();
    await rerender({ feasibility: { ...feasibility, verdict: 'unrealistic' } });
    expect(screen.getByText('Unrealistic')).toBeInTheDocument();
    expect(container.querySelector('use')?.getAttribute('href')).toBe('#i-stop');
    expect(await axe(container)).toHaveNoViolations();
  });
});
