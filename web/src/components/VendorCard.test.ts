import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { fakeGenAi, planFor, sampleInput } from '../test-fixtures.ts';
import VendorCard from './VendorCard.svelte';

describe('VendorCard', () => {
  const plan = planFor();
  const caterer = plan.vendors.find((vendor) => vendor.id === 'caterer');
  if (caterer === undefined) throw new Error('fixture has no caterer');

  it('shows book-by date, questions and payments, and reports progress', async () => {
    const onstatus = vi.fn();
    const { container } = render(VendorCard, {
      props: { vendor: caterer, plan, status: 'to-contact', genai: fakeGenAi(), onstatus },
    });
    expect(screen.getByRole('heading', { name: caterer.label })).toBeInTheDocument();
    expect(container.querySelector('.vendor-head')).toHaveTextContent(/Book by \w{3}, \d+ \w{3}/);
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(caterer.questions.length);
    expect(screen.getByText(/^Deposit/)).toBeInTheDocument();
    expect(screen.getByText(/^Balance/)).toBeInTheDocument();
    const select = screen.getByLabelText('Progress');
    await fireEvent.change(select, { target: { value: 'quoted' } });
    expect(onstatus).toHaveBeenCalledWith('quoted');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('drafts an enquiry, labels its source and language, and offers to copy it', async () => {
    const genai = fakeGenAi();
    const hindi = planFor({ ...sampleInput(), language: 'hi' });
    const vendor = hindi.vendors.find((item) => item.id === 'caterer') ?? caterer;
    const { container } = render(VendorCard, {
      props: { vendor, plan: hindi, status: 'quoted', genai, onstatus: vi.fn() },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Draft enquiry' }));
    await waitFor(() => {
      expect(screen.getByText(`Hello ${vendor.label}`)).toHaveAttribute('lang', 'hi');
    });
    expect(genai.calls).toEqual(['draft:caterer']);
    expect(screen.getByText('Written by Gemini')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy message' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Draft again' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('marks a vendor the input says is booked', () => {
    const booked = planFor(sampleInput('kids-birthday'));
    const venue = booked.vendors.find((vendor) => vendor.booked);
    if (venue === undefined) throw new Error('fixture has no booked vendor');
    render(VendorCard, {
      props: {
        vendor: venue,
        plan: booked,
        status: 'booked',
        genai: fakeGenAi(),
        onstatus: vi.fn(),
      },
    });
    expect(screen.getByText('Already booked')).toBeInTheDocument();
  });

  it('ignores a status outside the known list', async () => {
    const onstatus = vi.fn();
    render(VendorCard, {
      props: { vendor: caterer, plan, status: 'to-contact', genai: fakeGenAi(), onstatus },
    });
    const select = screen.getByLabelText('Progress');
    const option = document.createElement('option');
    option.value = 'stolen';
    select.append(option);
    await fireEvent.change(select, { target: { value: 'stolen' } });
    expect(onstatus).not.toHaveBeenCalled();
  });

  it('leaves out the payments heading when none are scheduled', () => {
    render(VendorCard, {
      props: {
        vendor: caterer,
        plan: { ...plan, payments: [] },
        status: 'to-contact',
        genai: fakeGenAi(),
        onstatus: vi.fn(),
      },
    });
    expect(screen.queryByRole('heading', { name: 'Payments' })).toBeNull();
  });

  it('hides a draft written for older event details', async () => {
    const { rerender } = render(VendorCard, {
      props: { vendor: caterer, plan, status: 'quoted', genai: fakeGenAi(), onstatus: vi.fn() },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Draft enquiry' }));
    await screen.findByRole('button', { name: 'Copy message' });
    await rerender({ plan: planFor({ ...sampleInput(), invited: 300 }) });
    expect(screen.queryByRole('button', { name: 'Copy message' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Draft enquiry' })).toBeInTheDocument();
  });
});
