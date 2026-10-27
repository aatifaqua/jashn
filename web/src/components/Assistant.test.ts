import { assistOffline, getProfile } from '@jashn/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import type { GenAi } from '../lib/genai.ts';
import { fakeGenAi, planFor } from '../test-fixtures.ts';
import Assistant from './Assistant.svelte';

const plan = planFor();
const profile = getProfile('wedding');
const labelOf = (id: string): string => profile.categories.find((c) => c.id === id)?.label ?? id;

function setup(genai: GenAi = fakeGenAi((message, current) => assistOffline(message, current))) {
  const onapply = vi.fn();
  const view = render(Assistant, { props: { plan, profile, genai, labelOf, onapply } });
  return { ...view, onapply };
}

async function ask(text: string): Promise<void> {
  await fireEvent.input(screen.getByLabelText('Your message'), { target: { value: text } });
  await fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}

describe('Assistant', () => {
  it('answers a question in a polite live log with its source', async () => {
    const { container } = setup();
    const log = container.querySelector('.chat-log');
    expect(log).toHaveAttribute('aria-live', 'polite');
    await fireEvent.click(screen.getByRole('button', { name: 'What is late?' }));
    await waitFor(() => {
      expect(screen.getByText(/tasks are late/)).toBeInTheDocument();
    });
    expect(screen.getByText('What is late?', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Offline suggestion')).toBeInTheDocument();
    expect(log).toHaveAttribute('aria-busy', 'false');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('previews a proposed change and applies it only on confirmation', async () => {
    const { container, onapply } = setup();
    await ask('Cut guests by 20');
    const preview = await screen.findByRole('group', { name: 'Proposed change' });
    const rows = within(preview).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Guests invited350330');
    expect(within(preview).getByText('Expected guests')).toBeInTheDocument();
    expect(onapply).not.toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
    // The preview takes focus, so a screen-reader user hears that a decision is waiting.
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Proposed change' }));
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Apply change' }));
    expect(onapply).toHaveBeenCalledWith({ invited: 330 });
    expect(screen.queryByRole('group', { name: 'Proposed change' })).toBeNull();
    expect(screen.getByText(/plan now includes that change/)).toBeInTheDocument();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText('Your message'));
    });
  });

  it('drops a proposal on Dismiss and returns focus to the message field', async () => {
    const { onapply } = setup();
    await ask('Cut the budget by 10%');
    await screen.findByRole('group', { name: 'Proposed change' });
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('group', { name: 'Proposed change' })).toBeNull();
    expect(onapply).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText('Your message'));
    });
  });

  it('keeps each reply in the language it was written in, and user text unlabelled', async () => {
    const genai = fakeGenAi(() => ({ reply: 'Reply.', source: 'gemini' }));
    const view = setup(genai);
    await ask('Hello');
    await screen.findByText('Reply.');
    await view.rerender({ plan: planFor({ ...plan.input, language: 'hi' }) });
    expect(screen.getByText('Reply.')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('Hello', { selector: 'p' })).not.toHaveAttribute('lang');
  });

  it('ignores blank messages and never previews an invalid patch', async () => {
    const genai = fakeGenAi(() => ({ reply: 'Sure.', patch: { invited: -1 } }));
    setup(genai);
    await ask('   ');
    expect(genai.calls).toEqual([]);
    await ask('Make it bigger');
    await waitFor(() => {
      expect(screen.getByText('Sure.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('group', { name: 'Proposed change' })).toBeNull();
  });

  it('sends earlier turns as history and shows a busy state while waiting', async () => {
    let release: (() => void) | undefined;
    const assist = vi.fn(
      () =>
        new Promise<{ reply: string; source: 'gemini' }>((resolve) => {
          release = () => {
            resolve({ reply: 'Done thinking.', source: 'gemini' });
          };
        }),
    );
    const genai: GenAi = { ...fakeGenAi(), assist };
    const { container } = setup(genai);
    await ask('First question');
    expect(container.querySelector('.chat-log')).toHaveAttribute('aria-busy', 'true');
    // Busy, yet still focusable: aria-disabled instead of disabled, and a press does nothing.
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toHaveAttribute('aria-disabled', 'true');
    expect(send).not.toBeDisabled();
    await fireEvent.click(send);
    expect(assist).toHaveBeenCalledOnce();
    release?.();
    await screen.findByText('Done thinking.');
    await ask('Second question');
    expect(assist).toHaveBeenLastCalledWith(plan, 'Second question', [
      { role: 'user', text: 'First question' },
      { role: 'assistant', text: 'Done thinking.' },
    ]);
  });
});
