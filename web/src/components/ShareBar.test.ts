import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planFor, sampleInput } from '../test-fixtures.ts';
import ShareBar from './ShareBar.svelte';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ShareBar', () => {
  const plan = planFor();

  it('prints and copies the checklist', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const print = vi.fn();
    const { container } = render(ShareBar, {
      props: { plan, checks: new Set<string>(), print },
    });
    expect(screen.getByRole('group', { name: 'Take the plan with you' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledOnce();

    await fireEvent.click(screen.getByRole('button', { name: 'Copy checklist' }));
    await waitFor(() => {
      expect(screen.getByText('Checklist copied.')).toBeInTheDocument();
    });
    expect(writeText.mock.calls[0]?.[0]).toMatch(/^Jashn checklist/);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('copies every task by phase with ticks for done ones', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const birthday = planFor(sampleInput('kids-birthday'));
    const first = birthday.tasks.find((task) => task.status !== 'done');
    const booked = birthday.tasks.find((task) => task.status === 'done');
    if (first === undefined || booked === undefined) throw new Error('fixture changed');
    render(ShareBar, { props: { plan: birthday, checks: new Set([first.id]), print: vi.fn() } });
    await fireEvent.click(screen.getByRole('button', { name: 'Copy checklist' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledOnce();
    });
    const text = writeText.mock.calls[0]?.[0] ?? '';
    expect(text.split('\n')[0]).toMatch(/^Jashn checklist: children's birthday party, \w+day, /);
    expect(text).toContain(`[x] ${first.title} (due `);
    expect(text).toContain(`[x] ${booked.title}`);
    expect(text).toContain('Do now');
    expect(text.match(/^\[[ x]\]/gm)).toHaveLength(birthday.tasks.length);
  });
});
