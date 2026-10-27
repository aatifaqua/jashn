import { render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import App from './App.svelte';

describe('App', () => {
  it('renders one top-level heading with no axe violations', async () => {
    const { container } = render(App);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Jashn');
    expect(await axe(container)).toHaveNoViolations();
  });
});
