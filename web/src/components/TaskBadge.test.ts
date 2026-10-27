import { render, screen } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import TaskBadge from './TaskBadge.svelte';

describe('TaskBadge', () => {
  it('words each status, with the days for late tasks', async () => {
    const { container, rerender } = render(TaskBadge, {
      props: { status: 'late', idealDue: 90, today: 100 },
    });
    expect(screen.getByText('10 days late')).toBeInTheDocument();
    await rerender({ status: 'at-risk', idealDue: 120, today: 100 });
    expect(screen.getByText('At risk')).toBeInTheDocument();
    await rerender({ status: 'done', idealDue: 120, today: 100 });
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows nothing for upcoming tasks', () => {
    const { container } = render(TaskBadge, {
      props: { status: 'upcoming', idealDue: 120, today: 100 },
    });
    expect(container.querySelector('.badge')).toBeNull();
  });
});
