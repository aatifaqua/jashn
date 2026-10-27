import { render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { planFor } from '../test-fixtures.ts';
import TopActions from './TopActions.svelte';

describe('TopActions', () => {
  it('lists the first actions with status and a Why? disclosure each', async () => {
    const plan = planFor();
    const { container } = render(TopActions, {
      props: { actions: plan.topActions, today: plan.today },
    });
    expect(container.querySelectorAll('.action')).toHaveLength(plan.topActions.length);
    expect(screen.getAllByText('Why?')).toHaveLength(plan.topActions.length);
    expect(screen.getAllByText(/days? late$/).length).toBeGreaterThan(0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says when nothing needs doing', () => {
    render(TopActions, { props: { actions: [], today: 0 } });
    expect(screen.getByText(/nothing needs doing yet/)).toBeInTheDocument();
  });
});
